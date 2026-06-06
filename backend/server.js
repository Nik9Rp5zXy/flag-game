const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const flagsData = require('./src/data/flags.json');
const capitalsData = require('./src/data/capitals.json');
const shopItems = require('./src/data/shop_items.json');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 30000,
  pingInterval: 10000
});

// ============================================================
// IN-MEMORY STATE
// ============================================================
let matchmakingPool = { flag: [], capital: [], math: [] };
const activeGames = new Map();       // roomId -> GameState
const playerProfiles = new Map();    // socketId -> profile (session-only)
const disconnectedPlayers = new Map(); // socketId -> { gameRoomId, timeout, profile }
const rateLimitMap = new Map();      // socketId -> lastAnswerTimestamp

// ============================================================
// CONSTANTS
// ============================================================
const QUESTION_TIME_LIMIT = 10000;   // 10 saniye
const RATE_LIMIT_MS = 500;           // 500ms minimum cevap arası
const AFK_WARNING_ROUNDS = 1;        // 1 tur AFK sonrası uyarı
const AFK_KICK_ROUNDS = 2;           // 2 tur AFK sonrası otomatik yenilgi
const RECONNECT_TIMEOUT = 15000;     // 15 saniye reconnect süresi
const COMBO_SPEED_THRESHOLD = 2000;  // 2sn altı = hızlı cevap
const COMBO_FIRE_THRESHOLD = 3;      // 3 art arda hızlı = ON FIRE
const ON_FIRE_DAMAGE_MULTIPLIER = 2; // ON FIRE hasar çarpanı
const BASE_WIN_COINS = 50;
const BASE_LOSE_COINS = 10;
const BASE_XP_PER_CORRECT = 25;
const SPEED_BONUS_MAX = 15;          // Hız bonusu max XP

// ============================================================
// HELPER: XP & LEVEL
// ============================================================
function xpToNextLevel(level) {
  return level * 100;
}

function calculateXpGain(stats) {
  let xp = stats.correctAnswers * BASE_XP_PER_CORRECT;
  xp += Math.min(stats.speedBonus, SPEED_BONUS_MAX * stats.correctAnswers);
  xp += stats.maxCombo * 10;
  if (stats.isWinner) xp = Math.floor(xp * 1.5);
  return Math.max(xp, 10);
}

function calculateCoins(isWinner, winStreak) {
  let coins = isWinner ? BASE_WIN_COINS : BASE_LOSE_COINS;
  if (isWinner && winStreak >= 3) coins = Math.floor(coins * 2);
  else if (isWinner && winStreak >= 2) coins = Math.floor(coins * 1.5);
  return coins;
}

// ============================================================
// HELPER: QUESTION GENERATION
// ============================================================
function generateQuestion(gameMode) {
  if (gameMode === 'flag') {
    const shuffled = [...flagsData].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 4);
    const correct = selected[Math.floor(Math.random() * 4)];
    return {
      type: 'flag',
      correctId: correct.id,
      questionData: { flagUrl: correct.flagUrl },
      options: selected.map(f => ({ id: f.id, text: f.name })),
      createdAt: Date.now()
    };
  }
  else if (gameMode === 'capital') {
    const shuffled = [...capitalsData].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 4);
    const correct = selected[Math.floor(Math.random() * 4)];
    return {
      type: 'capital',
      correctId: correct.id,
      questionData: { text: `${correct.country} başkenti neresidir?` },
      options: selected.map(c => ({ id: c.id, text: c.capital })),
      createdAt: Date.now()
    };
  }
  else if (gameMode === 'math') {
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = Math.floor(Math.random() * 20) + 1;
    let b = Math.floor(Math.random() * 20) + 1;
    if (op === '-' && a < b) { const t = a; a = b; b = t; }
    if (op === '*') { a = Math.floor(Math.random() * 10) + 1; b = Math.floor(Math.random() * 10) + 1; }

    let correctAns = 0;
    if (op === '+') correctAns = a + b;
    if (op === '-') correctAns = a - b;
    if (op === '*') correctAns = a * b;

    const optionsSet = new Set([correctAns]);
    while (optionsSet.size < 4) {
      const wrong = correctAns + (Math.floor(Math.random() * 10) - 5);
      if (wrong !== correctAns && wrong >= 0) optionsSet.add(wrong);
    }
    const optionsArray = Array.from(optionsSet).sort(() => 0.5 - Math.random());

    return {
      type: 'math',
      correctId: correctAns.toString(),
      questionData: { text: `${a} ${op} ${b} = ?` },
      options: optionsArray.map(o => ({ id: o.toString(), text: o.toString() })),
      createdAt: Date.now()
    };
  }
}

function getPublicQuestionData(question) {
  return {
    type: question.type,
    questionData: question.questionData,
    options: question.options
  };
}

// ============================================================
// HELPER: SEND NEW QUESTION WITH TIMER
// ============================================================
function sendNewQuestion(game) {
  // Önceki timer'ı temizle
  if (game.questionTimer) clearTimeout(game.questionTimer);

  game.currentQuestion = generateQuestion(game.gameMode);
  game.roundAnswered = {}; // her tur başında sıfırla

  // Her iki oyuncunun AFK sayacını kontrol et
  for (const pid of Object.keys(game.players)) {
    const p = game.players[pid];
    if (!p.answeredThisRound) {
      p.afkRounds = (p.afkRounds || 0) + 1;
    } else {
      p.afkRounds = 0;
    }
    p.answeredThisRound = false;
  }

  io.to(game.roomId).emit('new_question', getPublicQuestionData(game.currentQuestion));

  // 10 saniye süre zamanlayıcısı
  game.questionTimer = setTimeout(() => {
    handleTimeUp(game);
  }, QUESTION_TIME_LIMIT);
}

function handleTimeUp(game) {
  if (!activeGames.has(game.roomId)) return;

  io.to(game.roomId).emit('time_up', {
    correctAnswerId: game.currentQuestion.correctId
  });

  // AFK kontrolü
  for (const pid of Object.keys(game.players)) {
    const p = game.players[pid];
    if (!p.answeredThisRound) {
      p.afkRounds = (p.afkRounds || 0) + 1;
      if (p.afkRounds >= AFK_WARNING_ROUNDS && p.afkRounds < AFK_KICK_ROUNDS) {
        const sock = io.sockets.sockets.get(pid);
        if (sock) sock.emit('afk_warning');
      }
      if (p.afkRounds >= AFK_KICK_ROUNDS) {
        const opponentId = Object.keys(game.players).find(id => id !== pid);
        endGame(game, opponentId, pid, 'afk');
        return;
      }
    }
    // Kombo kırılır
    p.combo = 0;
    p.isOnFire = false;
  }

  // Yeni soru gönder
  setTimeout(() => {
    if (activeGames.has(game.roomId)) {
      sendNewQuestion(game);
    }
  }, 2000);
}

// ============================================================
// HELPER: END GAME
// ============================================================
function endGame(game, winnerId, loserId, reason) {
  if (game.questionTimer) clearTimeout(game.questionTimer);
  if (game.reconnectTimeout) clearTimeout(game.reconnectTimeout);

  const winnerPlayer = game.players[winnerId];
  const loserPlayer = game.players[loserId];

  // Profil istatistikleri güncelle
  const winnerProfile = playerProfiles.get(winnerId) || {};
  const loserProfile = playerProfiles.get(loserId) || {};

  winnerProfile.winStreak = (winnerProfile.winStreak || 0) + 1;
  loserProfile.winStreak = 0;

  // XP hesapla
  const winnerXp = calculateXpGain({
    correctAnswers: winnerPlayer.correctAnswers || 0,
    speedBonus: winnerPlayer.totalSpeedBonus || 0,
    maxCombo: winnerPlayer.maxCombo || 0,
    isWinner: true
  });
  const loserXp = calculateXpGain({
    correctAnswers: loserPlayer.correctAnswers || 0,
    speedBonus: loserPlayer.totalSpeedBonus || 0,
    maxCombo: loserPlayer.maxCombo || 0,
    isWinner: false
  });

  // Coin hesapla
  const winnerCoins = calculateCoins(true, winnerProfile.winStreak || 1);
  const loserCoins = calculateCoins(false, 0);

  // Profillere ekle
  winnerProfile.xp = (winnerProfile.xp || 0) + winnerXp;
  winnerProfile.coins = (winnerProfile.coins || 0) + winnerCoins;
  loserProfile.xp = (loserProfile.xp || 0) + loserXp;
  loserProfile.coins = (loserProfile.coins || 0) + loserCoins;

  // Level-up kontrolü
  let winnerLevelUp = false;
  let loserLevelUp = false;
  while (winnerProfile.xp >= xpToNextLevel(winnerProfile.level || 1)) {
    winnerProfile.xp -= xpToNextLevel(winnerProfile.level || 1);
    winnerProfile.level = (winnerProfile.level || 1) + 1;
    winnerLevelUp = true;
  }
  while (loserProfile.xp >= xpToNextLevel(loserProfile.level || 1)) {
    loserProfile.xp -= xpToNextLevel(loserProfile.level || 1);
    loserProfile.level = (loserProfile.level || 1) + 1;
    loserLevelUp = true;
  }

  playerProfiles.set(winnerId, winnerProfile);
  playerProfiles.set(loserId, loserProfile);

  // game_summary event'i gönder
  const summaryBase = {
    winnerId,
    loserId,
    reason: reason || 'knockout'
  };

  // Kazanana özel veri
  const winSock = io.sockets.sockets.get(winnerId);
  if (winSock) {
    winSock.emit('game_summary', {
      ...summaryBase,
      yourStats: {
        isWinner: true,
        xpGained: winnerXp,
        coinsGained: winnerCoins,
        correctAnswers: winnerPlayer.correctAnswers || 0,
        maxCombo: winnerPlayer.maxCombo || 0,
        newLevel: winnerProfile.level || 1,
        newXp: winnerProfile.xp,
        newCoins: winnerProfile.coins,
        xpToNext: xpToNextLevel(winnerProfile.level || 1),
        levelUp: winnerLevelUp,
        winStreak: winnerProfile.winStreak || 1
      }
    });
  }

  // Kaybedene özel veri
  const loseSock = io.sockets.sockets.get(loserId);
  if (loseSock) {
    loseSock.emit('game_summary', {
      ...summaryBase,
      yourStats: {
        isWinner: false,
        xpGained: loserXp,
        coinsGained: loserCoins,
        correctAnswers: loserPlayer.correctAnswers || 0,
        maxCombo: loserPlayer.maxCombo || 0,
        newLevel: loserProfile.level || 1,
        newXp: loserProfile.xp,
        newCoins: loserProfile.coins,
        xpToNext: xpToNextLevel(loserProfile.level || 1),
        levelUp: loserLevelUp,
        winStreak: 0
      }
    });
  }

  activeGames.delete(game.roomId);
}

// ============================================================
// SHOP API
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

app.get('/api/shop', (req, res) => {
  res.json(shopItems);
});

app.post('/api/purchase', (req, res) => {
  const { socketId, itemId } = req.body;
  const profile = playerProfiles.get(socketId);
  if (!profile) return res.status(400).json({ error: 'Profil bulunamadı' });

  const item = shopItems.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: 'Ürün bulunamadı' });

  if ((profile.coins || 0) < item.price) {
    return res.status(400).json({ error: 'Yetersiz bakiye' });
  }

  if (profile.ownedItems && profile.ownedItems.includes(itemId)) {
    return res.status(400).json({ error: 'Bu ürüne zaten sahipsiniz' });
  }

  profile.coins -= item.price;
  if (!profile.ownedItems) profile.ownedItems = [];
  profile.ownedItems.push(itemId);
  playerProfiles.set(socketId, profile);

  // Socket üzerinden de bildir
  const sock = io.sockets.sockets.get(socketId);
  if (sock) {
    sock.emit('profile_update', {
      coins: profile.coins,
      ownedItems: profile.ownedItems
    });
  }

  res.json({ success: true, coins: profile.coins, ownedItems: profile.ownedItems });
});

// ============================================================
// SOCKET.IO CONNECTIONS
// ============================================================
io.on('connection', (socket) => {
  console.log(`[+] Bağlantı: ${socket.id}`);

  // Oyuncu profilini başlat
  if (!playerProfiles.has(socket.id)) {
    playerProfiles.set(socket.id, {
      level: 1, xp: 0, coins: 0,
      winStreak: 0, ownedItems: [], equippedItems: {}
    });
  }

  // Profil bilgilerini gönder
  socket.emit('profile_update', playerProfiles.get(socket.id));

  // ── RECONNECT ──
  socket.on('attempt_reconnect', (data) => {
    const { oldSocketId } = data;
    const dcData = disconnectedPlayers.get(oldSocketId);
    if (!dcData) {
      socket.emit('reconnect_failed');
      return;
    }

    clearTimeout(dcData.timeout);
    disconnectedPlayers.delete(oldSocketId);

    const game = activeGames.get(dcData.gameRoomId);
    if (!game) {
      socket.emit('reconnect_failed');
      return;
    }

    // Eski ID'yi yeni ID ile değiştir
    const oldPlayer = game.players[oldSocketId];
    if (oldPlayer) {
      oldPlayer.id = socket.id;
      game.players[socket.id] = oldPlayer;
      delete game.players[oldSocketId];
    }

    // Profili aktar
    const oldProfile = dcData.profile;
    if (oldProfile) {
      playerProfiles.set(socket.id, oldProfile);
    }

    socket.join(dcData.gameRoomId);

    socket.emit('reconnected', {
      roomId: dcData.gameRoomId,
      gameMode: game.gameMode,
      players: Object.values(game.players),
      currentQuestion: getPublicQuestionData(game.currentQuestion)
    });

    // Rakibe haber ver
    socket.to(dcData.gameRoomId).emit('opponent_reconnected');
    console.log(`[↻] Reconnect: ${oldSocketId} → ${socket.id}`);
  });

  // ── MATCHMAKING ──
  socket.on('find_match', (data) => {
    const playerName = data?.playerName || `Oyuncu_${socket.id.substring(0, 4)}`;
    const gameMode = data?.gameMode || 'flag';

    // Tüm havuzlardan temizle
    for (const mode in matchmakingPool) {
      matchmakingPool[mode] = matchmakingPool[mode].filter(p => p.id !== socket.id);
    }

    if (!matchmakingPool[gameMode]) matchmakingPool[gameMode] = [];

    if (matchmakingPool[gameMode].length > 0) {
      const opponent = matchmakingPool[gameMode].pop();
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      socket.join(roomId);
      opponent.socket.join(roomId);

      const profile1 = playerProfiles.get(socket.id) || {};
      const profile2 = playerProfiles.get(opponent.id) || {};

      const gameData = {
        roomId,
        gameMode,
        players: {
          [socket.id]: {
            id: socket.id, name: playerName, hp: 3,
            combo: 0, isOnFire: false, afkRounds: 0,
            answeredThisRound: false,
            correctAnswers: 0, totalSpeedBonus: 0, maxCombo: 0,
            level: profile1.level || 1
          },
          [opponent.id]: {
            id: opponent.id, name: opponent.name, hp: 3,
            combo: 0, isOnFire: false, afkRounds: 0,
            answeredThisRound: false,
            correctAnswers: 0, totalSpeedBonus: 0, maxCombo: 0,
            level: profile2.level || 1
          }
        },
        currentQuestion: null,
        questionTimer: null,
        roundAnswered: {}
      };
      activeGames.set(roomId, gameData);

      io.to(roomId).emit('match_found', {
        roomId,
        gameMode,
        players: Object.values(gameData.players).map(p => ({
          id: p.id, name: p.name, hp: p.hp, level: p.level,
          combo: 0, isOnFire: false
        }))
      });

      // 2 saniye sonra ilk soruyu gönder
      setTimeout(() => {
        if (activeGames.has(roomId)) {
          sendNewQuestion(gameData);
        }
      }, 2000);

      console.log(`[⚔] Eşleşme: ${roomId} [${gameMode}]`);
    } else {
      matchmakingPool[gameMode].push({ id: socket.id, socket, name: playerName });
      console.log(`[…] Bekleniyor: ${playerName} (${gameMode})`);
    }
  });

  // ── EMOTE ──
  socket.on('send_emote', (data) => {
    const { roomId, emote } = data;
    if (!roomId || !emote) return;
    const allowedEmotes = ['😂', '😡', '🤡', '🚀', '🔥', '💀'];
    if (!allowedEmotes.includes(emote)) return;
    socket.to(roomId).emit('receive_emote', { senderId: socket.id, emote });
  });

  // ── SUBMIT ANSWER ──
  socket.on('submit_answer', (data) => {
    const { roomId, answerId } = data;
    if (!roomId || answerId === undefined) return;

    // ── Rate Limiting ──
    const now = Date.now();
    const lastAnswer = rateLimitMap.get(socket.id) || 0;
    if (now - lastAnswer < RATE_LIMIT_MS) {
      console.log(`[⛔] Rate limit: ${socket.id}`);
      return; // drop
    }
    rateLimitMap.set(socket.id, now);

    const game = activeGames.get(roomId);
    if (!game || !game.currentQuestion) return;
    if (!game.players[socket.id]) return;

    // Zaten bu turda cevap verdiyse drop et
    if (game.roundAnswered && game.roundAnswered[socket.id]) return;

    const player = game.players[socket.id];
    const opponentId = Object.keys(game.players).find(id => id !== socket.id);
    const opponent = game.players[opponentId];

    player.answeredThisRound = true;
    if (!game.roundAnswered) game.roundAnswered = {};
    game.roundAnswered[socket.id] = true;

    const isCorrect = answerId === game.currentQuestion.correctId;
    const answerTime = now - game.currentQuestion.createdAt;

    if (isCorrect) {
      player.correctAnswers = (player.correctAnswers || 0) + 1;

      // Hız bonusu (ne kadar hızlı = o kadar çok bonus)
      const speedBonus = Math.max(0, Math.floor((QUESTION_TIME_LIMIT - answerTime) / 1000));
      player.totalSpeedBonus = (player.totalSpeedBonus || 0) + speedBonus;

      // Kombo sistemi
      if (answerTime < COMBO_SPEED_THRESHOLD) {
        player.combo = (player.combo || 0) + 1;
      } else {
        player.combo = 0;
      }
      player.maxCombo = Math.max(player.maxCombo || 0, player.combo);

      // ON FIRE kontrolü
      const wasOnFire = player.isOnFire;
      if (player.combo >= COMBO_FIRE_THRESHOLD) {
        player.isOnFire = true;
      }

      // Hasar hesapla
      let damage = 1;
      if (player.isOnFire) damage = ON_FIRE_DAMAGE_MULTIPLIER;
      opponent.hp = Math.max(0, opponent.hp - damage);

      // Timer'ı temizle
      if (game.questionTimer) clearTimeout(game.questionTimer);

      // Sonucu bildir
      io.to(roomId).emit('answer_result', {
        playerId: socket.id,
        isCorrect: true,
        correctAnswerId: game.currentQuestion.correctId,
        damage,
        answerTimeMs: answerTime,
        combo: player.combo,
        isOnFire: player.isOnFire,
        players: Object.values(game.players).map(p => ({
          id: p.id, name: p.name, hp: p.hp,
          combo: p.combo, isOnFire: p.isOnFire, level: p.level
        }))
      });

      // ON FIRE yeni başladıysa özel event
      if (player.isOnFire && !wasOnFire) {
        io.to(roomId).emit('on_fire', { playerId: socket.id });
      }

      // Oyun bitti mi?
      if (opponent.hp <= 0) {
        setTimeout(() => endGame(game, socket.id, opponentId, 'knockout'), 1500);
      } else {
        setTimeout(() => {
          if (activeGames.has(roomId)) {
            sendNewQuestion(game);
          }
        }, 2000);
      }
    } else {
      // Yanlış cevap — kombo kırılır
      player.combo = 0;
      if (player.isOnFire) {
        player.isOnFire = false;
        io.to(roomId).emit('fire_off', { playerId: socket.id });
      }

      socket.emit('answer_result', {
        playerId: socket.id,
        isCorrect: false,
        combo: 0,
        isOnFire: false
      });
    }
  });

  // ── EQUIP ITEM ──
  socket.on('equip_item', (data) => {
    const { itemId, category } = data;
    const profile = playerProfiles.get(socket.id);
    if (!profile) return;
    if (!profile.ownedItems || !profile.ownedItems.includes(itemId)) return;
    if (!profile.equippedItems) profile.equippedItems = {};
    profile.equippedItems[category] = itemId;
    playerProfiles.set(socket.id, profile);
    socket.emit('profile_update', profile);
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    console.log(`[-] Bağlantı koptu: ${socket.id}`);

    // Matchmaking'den temizle
    for (const mode in matchmakingPool) {
      matchmakingPool[mode] = matchmakingPool[mode].filter(p => p.id !== socket.id);
    }

    // Aktif oyun varsa reconnect penceresi aç
    for (const [roomId, game] of activeGames.entries()) {
      if (game.players[socket.id]) {
        const opponentId = Object.keys(game.players).find(id => id !== socket.id);

        // Rakibe bildir: bekleniyor
        io.to(roomId).emit('opponent_disconnected_waiting', { disconnectedId: socket.id });

        // Timer'ı durdur
        if (game.questionTimer) clearTimeout(game.questionTimer);

        // Reconnect bekleme süresi
        const timeout = setTimeout(() => {
          disconnectedPlayers.delete(socket.id);
          if (activeGames.has(roomId)) {
            endGame(game, opponentId, socket.id, 'opponent_disconnected');
          }
        }, RECONNECT_TIMEOUT);

        disconnectedPlayers.set(socket.id, {
          gameRoomId: roomId,
          timeout,
          profile: playerProfiles.get(socket.id)
        });

        break;
      }
    }

    // Rate limit temizle
    rateLimitMap.delete(socket.id);
  });
});

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Sunucu port ${PORT} üzerinde çalışıyor.`);
});
