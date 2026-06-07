const { Client } = require('ssh2');

const conn = new Client();
const config = {
  host: '193.164.4.57',
  port: 22,
  username: 'akif',
  password: 'L0calappdata',
  readyTimeout: 30000
};

const SSH_COMMANDS = `
    export DOMAIN="game.m4u.pro"
    export APP_NAME="flag-game-backend"
    export GITHUB_REPO="https://github.com/Nik9Rp5zXy/flag-game.git"
    export GITHUB_BRANCH="main"
    export SERVER_DIR="/var/www/$DOMAIN"
    export SUDO_ASKPASS=/bin/false
    export PASS="L0calappdata"

    echo "==> [Sunucu] Dizin kontrolü yapılıyor: $SERVER_DIR"
    if [ ! -d "$SERVER_DIR" ]; then
        echo "==> [Sunucu] Klasör yok, GitHub'dan yeni klon (clone) alınıyor..."
        echo "$PASS" | sudo -S mkdir -p "$SERVER_DIR"
        echo "$PASS" | sudo -S chown -R $USER:$USER "$SERVER_DIR"
        git clone "$GITHUB_REPO" "$SERVER_DIR"
        cd "$SERVER_DIR"
        git checkout "$GITHUB_BRANCH"
    else
        echo "==> [Sunucu] Klasör zaten mevcut, GitHub'dan son değişiklikler çekiliyor (pull)..."
        cd "$SERVER_DIR"
        git fetch origin
        git reset --hard "origin/$GITHUB_BRANCH"
    fi

    echo "==> [Sunucu] Frontend bağımlılıkları kuruluyor ve build alınıyor..."
    if [ -d "$SERVER_DIR/frontend" ]; then
        cd "$SERVER_DIR/frontend"
        npm install
        npm run build
        echo "==> [Sunucu] Frontend build işlemi başarılı."
    else
        echo "==> [HATA] Frontend klasörü bulunamadı."
    fi

    echo "==> [Sunucu] Backend bağımlılıkları kuruluyor..."
    if [ -d "$SERVER_DIR/backend" ]; then
        cd "$SERVER_DIR/backend"
        npm install
        
        echo "==> [Sunucu] PM2 süreçleri yönetiliyor ($APP_NAME)..."
        if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
            echo "==> [Sunucu] $APP_NAME adında aktif PM2 süreci bulundu. Uygulama yenileniyor (reload)..."
            pm2 reload "$APP_NAME" --update-env
        else
            echo "==> [Sunucu] PM2 süreci bulunamadı. İlk kez başlatılıyor..."
            pm2 start server.js --name "$APP_NAME"
        fi
        pm2 save
    else
        echo "==> [HATA] Backend klasörü bulunamadı."
    fi

    echo "==> [Sunucu] Nginx konfigürasyonu ayarlanıyor..."
    NGINX_CONF_PATH="/etc/nginx/sites-available/$DOMAIN"
    
    echo "$PASS" | sudo -S bash -c "cat > $NGINX_CONF_PATH" << NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN;

    root /var/www/$DOMAIN/frontend/dist;
    index index.html;

    location / {
        try_files \\$uri \\$uri/ /index.html;
    }

    # Disable cache for index.html to prevent V8/V9 cache bug
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    location ~* ^/(api|socket\\.io) {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_bypass_cache;
        
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
    }
}
NGINX_EOF

    echo "==> [Sunucu] Nginx symlink kontrol ediliyor..."
    if [ ! -L "/etc/nginx/sites-enabled/$DOMAIN" ]; then
        echo "$PASS" | sudo -S ln -s "$NGINX_CONF_PATH" /etc/nginx/sites-enabled/
    fi

    echo "==> [Sunucu] Nginx servisi yeniden yükleniyor..."
    echo "$PASS" | sudo -S systemctl reload nginx

    echo "====================================================================="
    echo "==> [Sunucu] BAŞARIYLA TAMAMLANDI!"
    echo "==> Uygulamanız yayında: http://$DOMAIN"
    echo "====================================================================="
`;

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(SSH_COMMANDS, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
  console.error('Connection error:', err);
}).connect(config);
