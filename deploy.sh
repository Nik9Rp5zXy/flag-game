#!/bin/bash

# ==============================================================================
# DEĞİŞKENLER VE GİRİŞ
# ==============================================================================
SSH_USER="akif"
SSH_IP="193.164.4.57"
SSH_PASS="L0calappdata"
DOMAIN="game.m4u.pro"
APP_NAME="flag-game-backend"
GITHUB_REPO="https://github.com/Nik9Rp5zXy/flag-game.git"
GITHUB_BRANCH="main"

# ==============================================================================
# 1. YEREL AŞAMA (LOCAL DEPLOYMENT - GIT PUSH)
# ==============================================================================
echo "====================================================================="
echo "==> [Yerel] Git işlemleri başlatılıyor..."
echo "====================================================================="

if [ ! -d ".git" ]; then
    echo "HATA: Bu dizinde bir Git deposu bulunamadı. Lütfen önce 'git init' yapın."
    echo "Kurulum iptal edildi."
    exit 1
fi

echo "==> Değişiklikler ekleniyor (git add .)..."
git add .

echo "==> Commit yapılıyor..."
# Commit işleminde değişiklik yoksa hata vermemesi için "|| echo" eklendi
git commit -m "Auto deploy update: $(date +'%Y-%m-%d %H:%M:%S')" || echo "Commit edilecek yeni değişiklik yok, devam ediliyor."

echo "==> GitHub'a push ediliyor ($GITHUB_BRANCH)..."
git push origin $GITHUB_BRANCH

if [ $? -ne 0 ]; then
    echo "HATA: GitHub'a push işlemi başarısız oldu! İnternet bağlantınızı veya depo yetkilerinizi kontrol edin."
    exit 1
fi

echo "==> [Yerel] Git push işlemi başarıyla tamamlandı."

# ==============================================================================
# 2. SUNUCU AŞAMASI (SSH BĞLANTISI VE KURULUM ADIMLARI)
# ==============================================================================
echo "====================================================================="
echo "==> [Sunucu] SSH ile sunucuya bağlanılıyor ve dağıtım başlatılıyor..."
echo "====================================================================="

# Sunucu üzerinde çalıştırılacak tüm komutları tek bir değişkende topluyoruz.
# Heredoc ('EOF') kullanılarak değişkenlerin sunucuya geçmesi sağlanır.
SSH_COMMANDS=$(cat << 'EOF'
    # Sunucu tarafı değişkenleri
    DOMAIN="game.m4u.pro"
    APP_NAME="flag-game-backend"
    GITHUB_REPO="https://github.com/Nik9Rp5zXy/flag-game.git"
    GITHUB_BRANCH="main"
    SERVER_DIR="/var/www/$DOMAIN"

    echo "==> [Sunucu] Dizin kontrolü yapılıyor: $SERVER_DIR"
    if [ ! -d "$SERVER_DIR" ]; then
        echo "==> [Sunucu] Klasör yok, GitHub'dan yeni klon (clone) alınıyor..."
        sudo mkdir -p "$SERVER_DIR"
        sudo chown -R $USER:$USER "$SERVER_DIR"
        git clone "$GITHUB_REPO" "$SERVER_DIR"
        cd "$SERVER_DIR"
        git checkout "$GITHUB_BRANCH"
    else
        echo "==> [Sunucu] Klasör zaten mevcut, GitHub'dan son değişiklikler çekiliyor (pull)..."
        cd "$SERVER_DIR"
        # Olası git conflict'lerini önlemek ve sunucuyu tamamen repoyla eşitlemek için:
        git fetch origin
        git reset --hard "origin/$GITHUB_BRANCH"
    fi

    # --------------------------------------------------------------------------
    # FRONTEND (REACT/VITE) KURULUM VE BUILD İŞLEMLERİ
    # --------------------------------------------------------------------------
    echo "==> [Sunucu] Frontend bağımlılıkları kuruluyor ve build alınıyor..."
    if [ -d "$SERVER_DIR/frontend" ]; then
        cd "$SERVER_DIR/frontend"
        npm install
        npm run build
        echo "==> [Sunucu] Frontend build işlemi başarılı."
    else
        echo "==> [UYARI] frontend klasörü bulunamadı! Lütfen dizin yapısını kontrol edin."
    fi

    # --------------------------------------------------------------------------
    # BACKEND (NODE.JS) KURULUM VE PM2 YAPILANDIRMASI
    # --------------------------------------------------------------------------
    echo "==> [Sunucu] Backend bağımlılıkları kuruluyor..."
    if [ -d "$SERVER_DIR/backend" ]; then
        cd "$SERVER_DIR/backend"
        npm install
        
        echo "==> [Sunucu] PM2 süreçleri yönetiliyor ($APP_NAME)..."
        # PM2 ile mevcut uygulamanın durumu kontrol ediliyor.
        # "pm2 delete all" gibi komutlar asla kullanılmaz, sadece "flag-game-backend" hedeflenir.
        if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
            echo "==> [Sunucu] $APP_NAME adında aktif PM2 süreci bulundu. Uygulama yenileniyor (reload)..."
            pm2 reload "$APP_NAME" --update-env
        else
            echo "==> [Sunucu] PM2 süreci bulunamadı. İlk kez başlatılıyor..."
            pm2 start server.js --name "$APP_NAME"
        fi
        
        echo "==> [Sunucu] PM2 başlangıç listesi kaydediliyor (pm2 save)..."
        pm2 save
    else
        echo "==> [UYARI] backend klasörü bulunamadı! Lütfen dizin yapısını kontrol edin."
    fi

    # --------------------------------------------------------------------------
    # NGINX YAPILANDIRMASI
    # --------------------------------------------------------------------------
    echo "==> [Sunucu] Nginx konfigürasyonu ayarlanıyor..."
    NGINX_CONF_PATH="/etc/nginx/sites-available/$DOMAIN"
    
    # Nginx konfigürasyon dosyasını oluşturur / ezer. 
    # Global nginx.conf dosyasına ve diğer projelere dokunulmaz.
    sudo bash -c "cat > $NGINX_CONF_PATH" << NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend Statik Dosyaları (npm run build çıktısı)
    root /var/www/$DOMAIN/frontend/dist;
    index index.html;

    # React/Vite için History API Fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API ve Socket.io Reverse Proxy Yönlendirmesi
    location ~* ^/(api|socket\.io) {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_bypass_cache;
        
        # Ek güvenlik ve IP geçiş başlıkları
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_EOF

    echo "==> [Sunucu] Nginx symlink kontrol ediliyor..."
    if [ ! -L "/etc/nginx/sites-enabled/$DOMAIN" ]; then
        sudo ln -s "$NGINX_CONF_PATH" /etc/nginx/sites-enabled/
    fi

    echo "==> [Sunucu] Nginx servisi yeniden yükleniyor..."
    sudo systemctl reload nginx

    echo "====================================================================="
    echo "==> [Sunucu] BAŞARIYLA TAMAMLANDI!"
    echo "==> Uygulamanız yayında: http://$DOMAIN"
    echo "====================================================================="
EOF
)

# sshpass veya standart SSH kullanımı.
# Şifreyi script içerisinden okutmak için sshpass kullanılır.
if command -v sshpass &> /dev/null; then
    sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_IP" "$SSH_COMMANDS"
else
    echo "UYARI: 'sshpass' uygulaması sisteminizde yüklü değil."
    echo "Bu nedenle SSH şifresini komut satırından manuel girmeniz istenebilir."
    echo "Yüklemek için (Windows MSYS2 veya WSL üzerinde) paket yöneticinizi kullanabilirsiniz."
    ssh -o StrictHostKeyChecking=no "$SSH_USER@$SSH_IP" "$SSH_COMMANDS"
fi

echo "==> TÜM DEPLOYMENT İŞLEMİ BİTTİ."
