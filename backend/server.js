const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const flagsData = require('./src/data/flags.json');
const capitalsData = require('./src/data/capitals.json');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// matchmakingPool: { flag: [], capital: [], math: [] }
let matchmakingPool = {
  flag: [],
  capital: [],
  math: []
};
const activeGames = new Map(); // roomId -> gameData

function generateQuestion(gameMode) {
  if (gameMode === 'flag') {
    const shuffled = [...flagsData].sort(() => 0.5 - Math.random());
    const selectedFlags = shuffled.slice(0, 4);
    const correctFlag = selectedFlags[Math.floor(Math.random() * 4)];
    return {
      type: 'flag',
      correctId: correctFlag.id,
      questionData: { flagUrl: correctFlag.flagUrl },
      options: selectedFlags.map(f => ({ id: f.id, text: f.name }))
    };
  } 
  else if (gameMode === 'capital') {
    const shuffled = [...capitalsData].sort(() => 0.5 - Math.random());
    const selectedCapitals = shuffled.slice(0, 4);
    const correctCapital = selectedCapitals[Math.floor(Math.random() * 4)];
    return {
      type: 'capital',
      correctId: correctCapital.id,
      questionData: { text: `${correctCapital.country} başkenti neresidir?` },
      options: selectedCapitals.map(c => ({ id: c.id, text: c.capital }))
    };
  }
  else if (gameMode === 'math') {
    // Basic math generation
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = Math.floor(Math.random() * 20) + 1;
    let b = Math.floor(Math.random() * 20) + 1;
    
    // Avoid negative answers for subtraction
    if (op === '-' && a < b) { const temp = a; a = b; b = temp; }
    // Make multiplication easier
    if (op === '*') { a = Math.floor(Math.random() * 10) + 1; b = Math.floor(Math.random() * 10) + 1; }

    let correctAns = 0;
    if (op === '+') correctAns = a + b;
    if (op === '-') correctAns = a - b;
    if (op === '*') correctAns = a * b;

    // Generate wrong options
    const optionsSet = new Set([correctAns]);
    while(optionsSet.size < 4) {
      const wrongAns = correctAns + (Math.floor(Math.random() * 10) - 5);
      if (wrongAns !== correctAns && wrongAns >= 0) optionsSet.add(wrongAns);
    }
    
    const optionsArray = Array.from(optionsSet).sort(() => 0.5 - Math.random());
    
    return {
      type: 'math',
      correctId: correctAns.toString(),
      questionData: { text: `${a} ${op} ${b} = ?` },
      options: optionsArray.map(opt => ({ id: opt.toString(), text: opt.toString() }))
    };
  }
}

io.on('connection', (socket) => {
  console.log(`[Yeni Bağlantı] Oyuncu: ${socket.id}`);

  // Eşleştirme İsteği
  socket.on('find_match', (data) => {
    const playerName = data?.playerName || `Oyuncu_${socket.id.substring(0,4)}`;
    const gameMode = data?.gameMode || 'flag';
    console.log(`${playerName} (${socket.id}) eşleşme arıyor. Mod: ${gameMode}`);
    
    // Zaten arıyorsa tekrar ekleme
    for (const mode in matchmakingPool) {
      matchmakingPool[mode] = matchmakingPool[mode].filter(p => p.id !== socket.id);
    }

    if (!matchmakingPool[gameMode]) matchmakingPool[gameMode] = [];

    if (matchmakingPool[gameMode].length > 0) {
      const opponent = matchmakingPool[gameMode].pop();
      const roomId = `room_${socket.id}_${opponent.id}`;
      
      socket.join(roomId);
      opponent.socket.join(roomId);

      const gameData = {
        roomId,
        gameMode,
        players: {
          [socket.id]: { id: socket.id, name: playerName, hp: 3 },
          [opponent.id]: { id: opponent.id, name: opponent.name, hp: 3 }
        },
        currentQuestion: generateQuestion(gameMode)
      };
      activeGames.set(roomId, gameData);

      io.to(roomId).emit('match_found', { 
        roomId, 
        gameMode,
        players: Object.values(gameData.players),
      });

      setTimeout(() => {
        io.to(roomId).emit('new_question', getPublicQuestionData(gameData.currentQuestion));
      }, 2000);
      
      console.log(`Eşleşme bulundu: ${roomId} [${gameMode}]`);
    } else {
      matchmakingPool[gameMode].push({ id: socket.id, socket: socket, name: playerName });
    }
  });

  // Emote Gönderimi
  socket.on('send_emote', (data) => {
    const { roomId, emote } = data;
    // Rakibe gönder
    socket.to(roomId).emit('receive_emote', {
      senderId: socket.id,
      emote
    });
  });

  // Cevap gönderimi
  socket.on('submit_answer', (data) => {
    const { roomId, answerId } = data;
    const game = activeGames.get(roomId);
    
    if (!game) return;

    const isCorrect = answerId === game.currentQuestion.correctId;
    const opponentId = Object.keys(game.players).find(id => id !== socket.id);
    
    if (isCorrect) {
      game.players[opponentId].hp -= 1;
      
      io.to(roomId).emit('answer_result', {
        playerId: socket.id,
        isCorrect: true,
        correctAnswerId: game.currentQuestion.correctId,
        players: Object.values(game.players)
      });

      if (game.players[opponentId].hp <= 0) {
        setTimeout(() => {
          io.to(roomId).emit('game_over', {
            winnerId: socket.id,
            loserId: opponentId
          });
          activeGames.delete(roomId);
          socket.leave(roomId);
          if (io.sockets.sockets.get(opponentId)) {
             io.sockets.sockets.get(opponentId).leave(roomId);
          }
        }, 1500);
      } else {
        game.currentQuestion = generateQuestion(game.gameMode);
        setTimeout(() => {
          io.to(roomId).emit('new_question', getPublicQuestionData(game.currentQuestion));
        }, 2000);
      }
    } else {
      socket.emit('answer_result', {
        playerId: socket.id,
        isCorrect: false,
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Bağlantı Koptu] Oyuncu: ${socket.id}`);
    for (const mode in matchmakingPool) {
      matchmakingPool[mode] = matchmakingPool[mode].filter(p => p.id !== socket.id);
    }
    
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
  return {
    type: question.type,
    questionData: question.questionData,
    options: question.options
  };
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Sunucu port ${PORT} üzerinde çalışıyor.`);
});
