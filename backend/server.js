const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const flagsData = require('./src/data/flags.json');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Geliştirme aşaması için herkese açık, prod için domain ile kısıtlayın
    methods: ["GET", "POST"]
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

let matchmakingPool = [];
const activeGames = new Map(); // roomId -> gameData

// Rastgele 4 şıklı soru üreten fonksiyon
function generateQuestion() {
  const shuffled = [...flagsData].sort(() => 0.5 - Math.random());
  const selectedFlags = shuffled.slice(0, 4);
  const correctFlag = selectedFlags[Math.floor(Math.random() * 4)];
  
  return {
    correctId: correctFlag.id,
    flagUrl: correctFlag.flagUrl,
    options: selectedFlags.map(f => ({ id: f.id, name: f.name }))
  };
}

io.on('connection', (socket) => {
  console.log(`[Yeni Bağlantı] Oyuncu: ${socket.id}`);

  // Eşleştirme İsteği
  socket.on('find_match', (data) => {
    const playerName = data?.playerName || `Oyuncu_${socket.id.substring(0,4)}`;
    console.log(`${playerName} (${socket.id}) eşleşme arıyor.`);
    
    // Zaten arıyorsa tekrar ekleme
    if (matchmakingPool.find(p => p.id === socket.id)) return;

    if (matchmakingPool.length > 0) {
      const opponent = matchmakingPool.pop();
      const roomId = `room_${socket.id}_${opponent.id}`;
      
      socket.join(roomId);
      opponent.socket.join(roomId);

      const gameData = {
        roomId,
        players: {
          [socket.id]: { id: socket.id, name: playerName, hp: 3 },
          [opponent.id]: { id: opponent.id, name: opponent.name, hp: 3 }
        },
        currentQuestion: generateQuestion()
      };
      activeGames.set(roomId, gameData);

      // İki tarafa da maçın bulunduğunu bildir
      io.to(roomId).emit('match_found', { 
        roomId, 
        players: Object.values(gameData.players),
      });

      // 2 saniye sonra ilk soruyu gönder
      setTimeout(() => {
        io.to(roomId).emit('new_question', getPublicQuestionData(gameData.currentQuestion));
      }, 2000);
      
      console.log(`Eşleşme bulundu: ${roomId}`);
    } else {
      matchmakingPool.push({ id: socket.id, socket: socket, name: playerName });
    }
  });

  // Cevap gönderimi
  socket.on('submit_answer', (data) => {
    const { roomId, answerId } = data;
    const game = activeGames.get(roomId);
    
    if (!game) return;

    const isCorrect = answerId === game.currentQuestion.correctId;
    
    // Karşı tarafı bul
    const opponentId = Object.keys(game.players).find(id => id !== socket.id);
    
    if (isCorrect) {
      // Doğru cevaplandı, rakibin canını düşür
      game.players[opponentId].hp -= 1;
      
      io.to(roomId).emit('answer_result', {
        playerId: socket.id,
        isCorrect: true,
        correctAnswerId: game.currentQuestion.correctId,
        players: Object.values(game.players)
      });

      if (game.players[opponentId].hp <= 0) {
        // Oyun bitti
        setTimeout(() => {
          io.to(roomId).emit('game_over', {
            winnerId: socket.id,
            loserId: opponentId
          });
          activeGames.delete(roomId);
          // Odaları boşalt
          socket.leave(roomId);
          if (io.sockets.sockets.get(opponentId)) {
             io.sockets.sockets.get(opponentId).leave(roomId);
          }
        }, 1500);
      } else {
        // Yeni soru gönder
        game.currentQuestion = generateQuestion();
        setTimeout(() => {
          io.to(roomId).emit('new_question', getPublicQuestionData(game.currentQuestion));
        }, 2000); // 2 saniye bekleme süresi
      }
    } else {
      // Yanlış cevap verdi
      socket.emit('answer_result', {
        playerId: socket.id,
        isCorrect: false,
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Bağlantı Koptu] Oyuncu: ${socket.id}`);
    matchmakingPool = matchmakingPool.filter(p => p.id !== socket.id);
    
    // Eğer aktif bir oyundaysa, oyunu bitir ve rakibi kazandır
    for (const [roomId, game] of activeGames.entries()) {
      if (game.players[socket.id]) {
        const opponentId = Object.keys(game.players).find(id => id !== socket.id);
        io.to(roomId).emit('game_over', {
          winnerId: opponentId,
          loserId: socket.id,
          reason: 'opponent_disconnected'
        });
        activeGames.delete(roomId);
        break;
      }
    }
  });
});

function getPublicQuestionData(question) {
  // correctId'yi client'a göndermiyoruz, hile yapılmasın
  return {
    flagUrl: question.flagUrl,
    options: question.options
  };
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Sunucu port ${PORT} üzerinde çalışıyor.`);
});
