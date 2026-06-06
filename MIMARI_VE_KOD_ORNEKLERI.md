# Multiplayer Bayrak Bilmece Düello Oyunu - Mimari ve Geliştirme Kiti

Bu belge, oyununuzun AŞAMA 1 (Geliştirme Kiti ve Mimarisi) gereksinimlerini içermektedir. Belirtilen teknolojiler ve estetik detaylarla oyunun temel kurulumunu nasıl yapacağınızı anlatır.

## 1. Proje Dizin Mimarisi

Dağıtım (deployment) senaryosunun kusursuz çalışması için proje dosyalarınızın aşağıdaki gibi yapılandırılması gerekir. `deploy.sh` bu yapıya göre `frontend` ve `backend` klasörlerinde çalışacaktır.

```text
flag-game/
├── frontend/                 # React.js (Vite) projesi
│   ├── public/
│   │   ├── sounds/           # howler.js için stok ses efektleri (slam.mp3, error.mp3 vb.)
│   │   └── index.html
│   ├── src/
│   │   ├── components/       # GameBoard, PlayerCard, FlagImage vb.
│   │   ├── context/          # Socket Context, Game State Context
│   │   ├── utils/            # Ses yöneticisi (soundManager.js)
│   │   ├── App.jsx
│   │   └── index.css         # TailwindCSS ve Custom Animasyonlar
│   ├── package.json
│   └── vite.config.js
├── backend/                  # Node.js, Express, Socket.io projesi
│   ├── src/
│   │   ├── controllers/      # Matchmaking, Game Logic
│   │   ├── models/           # MongoDB veya PostgreSQL şemaları
│   │   ├── sockets/          # Socket.io olay dinleyicileri (game.socket.js)
│   │   └── utils/            # Elo hesaplama algoritmaları
│   ├── server.js             # Ana giriş noktası ve Nginx'in yönleneceği 5000 portu
│   └── package.json
├── deploy.sh                 # Otomatik Dağıtım Scripti
└── README.md
```

## 2. Tasarım ve Estetik (Frontend - Tailwind & CSS)

Sert ve rekabetçi e-spor havasını vermek için koyu antrasit (`#0f1015`), neon kırmızı (`#ff2a2a`) ve mavi (`#2a2aff`) renk paletleri kullanılmalıdır. Ekran sarsılması (shake) ve çarpma (slam) gibi etkiler için CSS animasyonları çok önemlidir.

**`frontend/src/index.css` Örneği:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-dark: #0f1015;
  --neon-red: #ff2a2a;
  --neon-blue: #2a2aff;
}

body {
  background-color: var(--bg-dark);
  color: white;
  font-family: 'Inter', sans-serif;
  overflow-x: hidden; /* Sarsıntı sırasında scroll çıkmasını önler */
}

/* Ekran Sarsıntı (Shake) Animasyonu - Hatalı cevapta veya hasar alındığında tetiklenir */
@keyframes shake {
  0% { transform: translate(1px, 1px) rotate(0deg); }
  10% { transform: translate(-1px, -2px) rotate(-1deg); }
  20% { transform: translate(-3px, 0px) rotate(1deg); }
  30% { transform: translate(3px, 2px) rotate(0deg); }
  40% { transform: translate(1px, -1px) rotate(1deg); }
  50% { transform: translate(-1px, 2px) rotate(-1deg); }
  60% { transform: translate(-3px, 1px) rotate(0deg); }
  70% { transform: translate(3px, 1px) rotate(-1deg); }
  80% { transform: translate(-1px, -1px) rotate(1deg); }
  90% { transform: translate(1px, 2px) rotate(0deg); }
  100% { transform: translate(1px, -2px) rotate(-1deg); }
}

.animate-shake {
  animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
}

/* Bayrak Çarpma (Slam) Animasyonu - Bayrak ekrana sertçe gelirken */
@keyframes slam {
  0% { transform: scale(3); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.animate-slam {
  animation: slam 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

/* Hasar/Kritik Vuruş için kırmızı flaş efekti */
@keyframes flash-red {
  0%, 100% { box-shadow: inset 0 0 0px var(--neon-red); }
  50% { box-shadow: inset 0 0 100px var(--neon-red); }
}

.animate-flash-red {
  animation: flash-red 0.5s ease-in-out;
}
```

## 3. Ses Yönetimi (Howler.js)

Rekabetçi oyunlarda seslerin gecikmesiz çalışması şarttır. Bu nedenle Howler.js kullanılmalıdır. Oyun yüklenirken (Loading ekranı) sesler önbelleğe (preload) alınır.

**`frontend/src/utils/soundManager.js` Örneği:**
```javascript
import { Howl } from 'howler';

// Ses dosyalarını preload ederek gecikmeyi (latency) önlüyoruz
export const sounds = {
  slam: new Howl({ src: ['/sounds/slam.mp3'], volume: 0.8, preload: true }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.6, preload: true }),
  wrong: new Howl({ src: ['/sounds/error.mp3'], volume: 0.9, preload: true }), // Tok hata sesi
  damage: new Howl({ src: ['/sounds/hit.mp3'], volume: 0.7, preload: true }),
  bgMusic: new Howl({ src: ['/sounds/esports-bg.mp3'], volume: 0.2, loop: true })
};

export const playSound = (soundName) => {
  if (sounds[soundName]) {
    // Sesin baştan çalmasını sağlar (spam tıklamalara karşı)
    sounds[soundName].stop();
    sounds[soundName].play();
  }
};
```

## 4. Backend (Socket.io) Temel Mantığı

Gerçek zamanlı düello etkileşimi, Elo/Rank eşleştirmeleri ve 3 Can (HP) sistemi Socket.io ile yönetilecektir.

**`backend/server.js` Örneği:**
```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS Ayarları: Nginx ters proxy kullanacağımız için
// domainimizi buraya eklemeliyiz.
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://game.m4u.pro", "https://game.m4u.pro"],
    methods: ["GET", "POST"]
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Eşleştirme için basit bir havuz (Matchmaking Pool)
let matchmakingPool = [];

io.on('connection', (socket) => {
  console.log(`[Yeni Bağlantı] Oyuncu: ${socket.id}`);

  // Eşleştirme İsteği
  socket.on('find_match', (data) => {
    console.log(`${socket.id} eşleşme arıyor. Elo: ${data.elo}`);
    // Basit mantık: Havuzda biri varsa eşleştir
    if (matchmakingPool.length > 0) {
      const opponent = matchmakingPool.pop();
      const roomId = `room_${socket.id}_${opponent.id}`;
      
      socket.join(roomId);
      opponent.socket.join(roomId);

      io.to(roomId).emit('match_found', { 
        roomId, 
        players: [{id: socket.id}, {id: opponent.id}],
        hp: 3 // 3 Can (HP) sistemi
      });
      
      console.log(`Eşleşme bulundu: ${roomId}`);
    } else {
      matchmakingPool.push({ id: socket.id, socket: socket, elo: data.elo });
    }
  });

  // Cevap gönderimi
  socket.on('submit_answer', (data) => {
    // Örnek data: { roomId: '...', answer: 'tr', isCorrect: true, timeTaken: 1.2 }
    // Oyun mantığı: Hızlı yazma veya seçme. İlk doğru cevaplayan can (HP) düşürür.
    io.to(data.roomId).emit('answer_result', {
      playerId: socket.id,
      isCorrect: data.isCorrect,
      timeTaken: data.timeTaken
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Bağlantı Koptu] Oyuncu: ${socket.id}`);
    matchmakingPool = matchmakingPool.filter(p => p.id !== socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Sunucu port ${PORT} üzerinde çalışıyor.`);
});
```

## Nasıl Başlanır?
Projeyi başlatmak için sırasıyla:
1. `npx create-vite frontend --template react` ile frontend'i oluşturun.
2. `mkdir backend && cd backend && npm init -y` ile backend'i kurun.
3. Repoyu GitHub'a `git push` ile gönderin.
4. Terminalde `deploy.sh` scriptini çalıştırarak otomatik dağıtımı izleyin.
