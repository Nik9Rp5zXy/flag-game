const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const flagsData = require('./src/data/flags.json');
const capitalsData = require('./src/data/capitals.json');
const shopItems = require('./src/data/shop_items.json');
const db = require('./src/db/database');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 30000,
  pingInterval: 10000
});

const JWT_SECRET = 'm4u-v4-super-secret-key';

// ============================================================
// REST API: AUTH & SHOP
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur' });
  
  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış' });
    
    const hash = bcrypt.hashSync(password, 10);
    const role = username === 'm4kif' ? 'owner' : 'user';
    const stmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
    const info = stmt.run(username, hash, role);
    
    const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET);
    res.json({ token, username, level: 1, xp: 0, coins: 0, ownedItems: [], equippedItems: {}, role });
  } catch (e) {
    res.status(500).json({ error: 'Kayıt sırasında sunucu hatası oluştu' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(400).json({ error: 'Kullanıcı bulunamadı' });
    
    if (user.is_banned) {
      return res.status(403).json({ error: 'Bu hesap sunucudan kalıcı olarak uzaklaştırılmıştır.' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(400).json({ error: 'Hatalı şifre' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ 
      token, 
      username, 
      level: user.level, 
      xp: user.xp, 
      coins: user.coins, 
      ownedItems: JSON.parse(user.owned_items), 
      equippedItems: JSON.parse(user.equipped_items),
      role: user.role
    });
  } catch (e) {
    res.status(500).json({ error: 'Giriş sırasında sunucu hatası oluştu' });
  }
});

app.get('/api/shop', (req, res) => {
  res.json(shopItems);
});

app.post('/api/purchase', (req, res) => {
  const { token, itemId } = req.body;
  if (!token) return res.status(401).json({ error: 'Yetkisiz erişim' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    const item = shopItems.find(i => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Ürün bulunamadı' });

    if (user.coins < item.price) {
      return res.status(400).json({ error: 'Yetersiz bakiye' });
    }

    const ownedItems = JSON.parse(user.owned_items);
    if (ownedItems.includes(itemId)) {
      return res.status(400).json({ error: 'Bu ürüne zaten sahipsiniz' });
    }

    ownedItems.push(itemId);
    const newCoins = user.coins - item.price;
    
    db.prepare('UPDATE users SET coins = ?, owned_items = ? WHERE id = ?')
      .run(newCoins, JSON.stringify(ownedItems), user.id);
      
    res.json({ success: true, coins: newCoins, ownedItems });
  } catch (e) {
    res.status(500).json({ error: 'Satın alma işlemi başarısız' });
  }
});

// ============================================================
// IN-MEMORY STATE FOR GAMES
// ============================================================
let matchmakingPool = { flag: [], capital: [], math: [], coop: [] };
const activeGames = new Map();       // roomId -> GameState
const playerProfiles = new Map();    // socketId -> session profile
const disconnectedPlayers = new Map(); // socketId -> timeout details
const rateLimitMap = new Map();      
const typingUsers = new Set();
const globalChatHistory = [];
const MAX_CHAT_HISTORY = 50;

setInterval(() => {
  const counts = {
    flag: matchmakingPool.flag.length,
    capital: matchmakingPool.capital.length,
    math: matchmakingPool.math.length,
    coop: matchmakingPool.coop.length
  };
  io.emit('pool_counts', counts);
}, 2000);

const QUESTION_TIME_LIMIT = 10000;
const RATE_LIMIT_MS = 500;
const AFK_WARNING_ROUNDS = 1;
const AFK_KICK_ROUNDS = 2;
const RECONNECT_TIMEOUT = 15000;
const COMBO_SPEED_THRESHOLD = 2000;
const COMBO_FIRE_THRESHOLD = 3;
const ON_FIRE_DAMAGE_MULTIPLIER = 2;

function xpToNextLevel(level) { return level * 100; }

function calculateXpGain(stats) {
  let xp = stats.correctAnswers * 25;
  xp += Math.min(stats.speedBonus, 15 * stats.correctAnswers);
  xp += stats.maxCombo * 10;
  if (stats.isWinner) xp = Math.floor(xp * 1.5);
  return Math.max(xp, 10);
}

function calculateCoins(isWinner, winStreak) {
  let coins = isWinner ? 50 : 10;
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
    return { type: 'flag', correctId: correct.id, questionData: { flagUrl: correct.flagUrl }, options: selected.map(f => ({ id: f.id, text: f.name })), createdAt: Date.now() };
  } else if (gameMode === 'capital') {
    const shuffled = [...capitalsData].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 4);
    const correct = selected[Math.floor(Math.random() * 4)];
    return { type: 'capital', correctId: correct.id, questionData: { text: `${correct.country} başkenti neresidir?` }, options: selected.map(c => ({ id: c.id, text: c.capital })), createdAt: Date.now() };
  } else if (gameMode === 'math') {
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = Math.floor(Math.random() * 20) + 1;
    let b = Math.floor(Math.random() * 20) + 1;
    if (op === '-' && a < b) { const t = a; a = b; b = t; }
    if (op === '*') { a = Math.floor(Math.random() * 10) + 1; b = Math.floor(Math.random() * 10) + 1; }
    let correctAns = op === '+' ? a + b : op === '-' ? a - b : a * b;
    const optionsSet = new Set([correctAns]);
    while (optionsSet.size < 4) {
      const wrong = correctAns + (Math.floor(Math.random() * 10) - 5);
      if (wrong !== correctAns && wrong >= 0) optionsSet.add(wrong);
    }
    const optionsArray = Array.from(optionsSet).sort(() => 0.5 - Math.random());
    return { type: 'math', correctId: correctAns.toString(), questionData: { text: `${a} ${op} ${b} = ?` }, options: optionsArray.map(o => ({ id: o.toString(), text: o.toString() })), createdAt: Date.now() };
  }
}

// ============================================================
// CO-OP MECHANICS (CYBER BREACH)
// ============================================================
function generateCoopPhase(phase) {
  const port = Math.floor(Math.random() * 8000) + 1000;
  const passwords = ['admin', 'root', '1234', 'qwerty', 'system'];
  const pass = passwords[Math.floor(Math.random() * passwords.length)];
  
  if (phase === 1) {
    return { phase, targetPort: port, requiredRegex: new RegExp(`^crack\\s+(-p|--port)\\s+${port}$`, 'i'), timeLimit: 30000, hint: `Hedef Port: ${port}`, commandHint: 'crack -p [PORT]' };
  } else {
    return { phase, targetPort: port, password: pass, requiredRegex: new RegExp(`^breach\\s+${port}\\s+${pass}$`, 'i'), timeLimit: 20000, hint: `Port: ${port} | Pass: ${pass}`, commandHint: 'breach [PORT] [PASS]' };
  }
}

function sendNewQuestion(game) {
  if (game.questionTimer) clearTimeout(game.questionTimer);
  
  if (game.gameMode === 'coop') {
    game.currentCoop = generateCoopPhase(game.coopPhase || 1);
    io.to(game.roomId).emit('coop_new_phase', { phase: game.currentCoop.phase, hint: game.currentCoop.hint, commandHint: game.currentCoop.commandHint });
    game.questionTimer = setTimeout(() => { handleCoopTimeUp(game); }, game.currentCoop.timeLimit);
    return;
  }

  game.currentQuestion = generateQuestion(game.gameMode);
  game.roundAnswered = {}; 
  for (const pid of Object.keys(game.players)) {
    const p = game.players[pid];
    if (!p.answeredThisRound) p.afkRounds = (p.afkRounds || 0) + 1;
    else p.afkRounds = 0;
    p.answeredThisRound = false;
  }
  
  io.to(game.roomId).emit('new_question', { type: game.currentQuestion.type, questionData: game.currentQuestion.questionData, options: game.currentQuestion.options });
  game.questionTimer = setTimeout(() => { handleTimeUp(game); }, QUESTION_TIME_LIMIT);

  if (game.isBotMatch) {
     const botId = Object.keys(game.players).find(pid => game.players[pid].isBot);
     if (botId) {
        const delay = Math.random() * 2000 + 1000;
        game.botAnswerTimer = setTimeout(() => {
           if (!activeGames.has(game.roomId)) return;
           if (game.roundAnswered && game.roundAnswered[botId]) return;
           const isCorrect = Math.random() > 0.4;
           const ansId = isCorrect ? game.currentQuestion.correctId : game.currentQuestion.options[0].id;
           processAnswer(null, game, botId, ansId);
        }, delay);
     }
  }
}

function processAnswer(socket, game, playerId, answerId) {
    if (game.roundAnswered && game.roundAnswered[playerId]) return;
    if (!game.currentQuestion) return;

    const player = game.players[playerId];
    const opponentId = Object.keys(game.players).find(id => id !== playerId);
    const opponent = game.players[opponentId];

    player.answeredThisRound = true;
    if (!game.roundAnswered) game.roundAnswered = {};
    game.roundAnswered[playerId] = true;

    const isCorrect = answerId === game.currentQuestion.correctId;
    const answerTime = Date.now() - game.currentQuestion.createdAt;

    if (isCorrect) {
      player.correctAnswers = (player.correctAnswers || 0) + 1;
      const speedBonus = Math.max(0, Math.floor((QUESTION_TIME_LIMIT - answerTime) / 1000));
      player.totalSpeedBonus = (player.totalSpeedBonus || 0) + speedBonus;
      if (answerTime < COMBO_SPEED_THRESHOLD) player.combo = (player.combo || 0) + 1;
      else player.combo = 0;
      player.maxCombo = Math.max(player.maxCombo || 0, player.combo);
      
      const wasOnFire = player.isOnFire;
      if (player.combo >= COMBO_FIRE_THRESHOLD) player.isOnFire = true;

      let damage = player.isOnFire ? ON_FIRE_DAMAGE_MULTIPLIER : 1;
      opponent.hp = Math.max(0, opponent.hp - damage);

      if (game.questionTimer) clearTimeout(game.questionTimer);
      if (game.botAnswerTimer) clearTimeout(game.botAnswerTimer);

      io.to(game.roomId).emit('answer_result', {
        playerId: playerId, isCorrect: true, correctAnswerId: game.currentQuestion.correctId, damage, answerTimeMs: answerTime, combo: player.combo, isOnFire: player.isOnFire,
        players: Object.values(game.players).map(p => ({ id: p.id, name: p.name, hp: p.hp, level: p.level, combo: p.combo, isOnFire: p.isOnFire, equippedItems: p.equippedItems }))
      });

      if (opponent.hp <= 0) setTimeout(() => endGame(game, playerId, opponentId, 'knockout'), 1500);
      else setTimeout(() => { if (activeGames.has(game.roomId)) sendNewQuestion(game); }, 2000);
    } else {
      player.combo = 0;
      player.isOnFire = false;
      io.to(game.roomId).emit('answer_result', { playerId: playerId, isCorrect: false, combo: 0, isOnFire: false });

      if (game.roundAnswered[playerId] && game.roundAnswered[opponentId]) {
        if (game.questionTimer) clearTimeout(game.questionTimer);
        if (game.botAnswerTimer) clearTimeout(game.botAnswerTimer);
        setTimeout(() => { if (activeGames.has(game.roomId)) sendNewQuestion(game); }, 2000);
      }
    }
}

function startBotMatch(humanSocketId, gameMode) {
  const humanSocket = io.sockets.sockets.get(humanSocketId);
  if (!humanSocket) return;

  const roomId = `room_${Date.now()}_bot`;
  humanSocket.join(roomId);

  const profile1 = playerProfiles.get(humanSocketId) || {};
  const botId = 'bot_' + Date.now();
  const botName = 'AI_Master';

  const gameData = {
    roomId,
    gameMode,
    isBotMatch: true,
    players: {
      [humanSocketId]: { id: humanSocketId, name: profile1.name || 'Oyuncu', hp: 3, combo: 0, isOnFire: false, afkRounds: 0, answeredThisRound: false, correctAnswers: 0, totalSpeedBonus: 0, maxCombo: 0, level: profile1.level || 1, equippedItems: profile1.equippedItems || {} },
      [botId]: { id: botId, name: botName, hp: 3, combo: 0, isOnFire: false, afkRounds: 0, answeredThisRound: false, correctAnswers: 0, totalSpeedBonus: 0, maxCombo: 0, level: 99, equippedItems: {}, isBot: true }
    },
    currentQuestion: null,
    questionTimer: null,
    roundAnswered: {}
  };

  activeGames.set(roomId, gameData);

  io.to(roomId).emit('match_found', {
    roomId,
    gameMode,
    players: Object.values(gameData.players).map(p => ({ id: p.id, name: p.name, hp: p.hp, level: p.level, combo: 0, isOnFire: false, equippedItems: p.equippedItems }))
  });

  setTimeout(() => { if (activeGames.has(roomId)) sendNewQuestion(gameData); }, 2000);
  console.log(`[🤖] Bot Eşleşmesi: ${roomId} [${gameMode}]`);
}

function handleTimeUp(game) {
  if (!activeGames.has(game.roomId)) return;
  io.to(game.roomId).emit('time_up', { correctAnswerId: game.currentQuestion.correctId });
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
    p.combo = 0; p.isOnFire = false;
  }
  setTimeout(() => { if (activeGames.has(game.roomId)) sendNewQuestion(game); }, 2000);
}

function handleCoopTimeUp(game) {
  if (!activeGames.has(game.roomId)) return;
  io.to(game.roomId).emit('coop_failed', { reason: 'Süre doldu! Sistemler kilitlendi.' });
  setTimeout(() => {
    activeGames.delete(game.roomId);
  }, 3000);
}

function endGame(game, winnerId, loserId, reason) {
  if (game.questionTimer) clearTimeout(game.questionTimer);
  if (game.reconnectTimeout) clearTimeout(game.reconnectTimeout);

  const winnerPlayer = game.players[winnerId];
  const loserPlayer = game.players[loserId];
  const winnerProfile = playerProfiles.get(winnerId) || {};
  const loserProfile = playerProfiles.get(loserId) || {};

  winnerProfile.winStreak = (winnerProfile.winStreak || 0) + 1;
  loserProfile.winStreak = 0;

  const winnerXp = calculateXpGain({ correctAnswers: winnerPlayer.correctAnswers || 0, speedBonus: winnerPlayer.totalSpeedBonus || 0, maxCombo: winnerPlayer.maxCombo || 0, isWinner: true });
  const loserXp = calculateXpGain({ correctAnswers: loserPlayer.correctAnswers || 0, speedBonus: loserPlayer.totalSpeedBonus || 0, maxCombo: loserPlayer.maxCombo || 0, isWinner: false });
  const winnerCoins = calculateCoins(true, winnerProfile.winStreak || 1);
  const loserCoins = calculateCoins(false, 0);

  winnerProfile.xp = (winnerProfile.xp || 0) + winnerXp;
  winnerProfile.coins = (winnerProfile.coins || 0) + winnerCoins;
  loserProfile.xp = (loserProfile.xp || 0) + loserXp;
  loserProfile.coins = (loserProfile.coins || 0) + loserCoins;

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

  // UPDATE DATABASE IF LOGGED IN
  if (winnerProfile.dbUserId) {
    db.prepare('UPDATE users SET level=?, xp=?, coins=?, win_streak=? WHERE id=?')
      .run(winnerProfile.level, winnerProfile.xp, winnerProfile.coins, winnerProfile.winStreak, winnerProfile.dbUserId);
  }
  if (loserProfile.dbUserId) {
    db.prepare('UPDATE users SET level=?, xp=?, coins=?, win_streak=? WHERE id=?')
      .run(loserProfile.level, loserProfile.xp, loserProfile.coins, loserProfile.winStreak, loserProfile.dbUserId);
  }

  playerProfiles.set(winnerId, winnerProfile);
  playerProfiles.set(loserId, loserProfile);

  const summaryBase = { winnerId, loserId, reason: reason || 'knockout' };
  
  const winSock = io.sockets.sockets.get(winnerId);
  if (winSock) winSock.emit('game_summary', { ...summaryBase, yourStats: { isWinner: true, xpGained: winnerXp, coinsGained: winnerCoins, correctAnswers: winnerPlayer.correctAnswers || 0, maxCombo: winnerPlayer.maxCombo || 0, newLevel: winnerProfile.level, newXp: winnerProfile.xp, newCoins: winnerProfile.coins, xpToNext: xpToNextLevel(winnerProfile.level), levelUp: winnerLevelUp, winStreak: winnerProfile.winStreak } });
  
  const loseSock = io.sockets.sockets.get(loserId);
  if (loseSock) loseSock.emit('game_summary', { ...summaryBase, yourStats: { isWinner: false, xpGained: loserXp, coinsGained: loserCoins, correctAnswers: loserPlayer.correctAnswers || 0, maxCombo: loserPlayer.maxCombo || 0, newLevel: loserProfile.level, newXp: loserProfile.xp, newCoins: loserProfile.coins, xpToNext: xpToNextLevel(loserProfile.level), levelUp: loserLevelUp, winStreak: 0 } });

  activeGames.delete(game.roomId);
}

// ============================================================
// SOCKET.IO CONNECTIONS
// ============================================================
io.on('connection', (socket) => {
  console.log(`[+] Bağlantı: ${socket.id}`);

  // ── AUTHENTICATE EVENTI (SYNC BUG FIX) ──
  socket.on('authenticate', (token) => {
    if (!token) return;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
      if (user && !user.is_banned) {
         playerProfiles.set(socket.id, {
            name: user.username,
            dbUserId: user.id,
            level: user.level,
            xp: user.xp,
            coins: user.coins,
            winStreak: user.win_streak,
            ownedItems: JSON.parse(user.owned_items),
            equippedItems: JSON.parse(user.equipped_items),
            role: user.role,
            isAuthenticated: true,
            muteExpiresAt: user.mute_expires_at
         });
      }
    } catch(e) {}
  });

  // ── KÜRESEL SOHBET (GLOBAL CHAT) ──
  socket.emit('global_chat_history', globalChatHistory);

  socket.on('typing', (isTyping) => {
    const profile = playerProfiles.get(socket.id);
    if (!profile || !profile.isAuthenticated) return;
    if (isTyping) {
      typingUsers.add(profile.name);
    } else {
      typingUsers.delete(profile.name);
    }
    io.emit('typing_update', Array.from(typingUsers));
  });

  socket.on('send_global_message', (data) => {
    const profile = playerProfiles.get(socket.id);
    if (!profile || !profile.isAuthenticated) {
      return socket.emit('chat_error', { message: 'Sohbet etmek için giriş yapmalısınız.' });
    }

    if (profile.muteExpiresAt && new Date(profile.muteExpiresAt).getTime() > Date.now()) {
      return socket.emit('chat_error', { message: 'Sohbetten geçici olarak susturuldunuz.' });
    }
    
    // Mesaj gönderildiğinde yazıyor durumunu temizle
    typingUsers.delete(profile.name);
    io.emit('typing_update', Array.from(typingUsers));

    // MODERASYON KOMUTLARI
    if (data.text.startsWith('/admin yap ') && profile.role === 'owner') {
      const targetUser = data.text.split('/admin yap ')[1]?.trim();
      if (targetUser) {
        try {
          db.prepare('UPDATE users SET role="admin" WHERE username=?').run(targetUser);
          for (let [sId, p] of playerProfiles.entries()) {
             if (p.name === targetUser) p.role = 'admin';
          }
          io.emit('role_updated', { username: targetUser, role: 'admin' });
          io.emit('new_global_message', { id: Date.now().toString(), sender: 'SYSTEM', text: `👑 Kurucu, ${targetUser} kişisini ADMİN yaptı!`, role: 'system', level: 999, time: Date.now() });
        } catch(e) {}
      }
      return;
    }

    if (data.text.startsWith('/admin kaldir ') && profile.role === 'owner') {
      const targetUser = data.text.split('/admin kaldir ')[1]?.trim();
      if (targetUser) {
        try {
          db.prepare('UPDATE users SET role="user" WHERE username=?').run(targetUser);
          for (let [sId, p] of playerProfiles.entries()) {
             if (p.name === targetUser) p.role = 'user';
          }
          io.emit('role_updated', { username: targetUser, role: 'user' });
          io.emit('new_global_message', { id: Date.now().toString(), sender: 'SYSTEM', text: `👑 Kurucu, ${targetUser} kişisinin yetkilerini aldı.`, role: 'system', level: 999, time: Date.now() });
        } catch(e) {}
      }
      return;
    }

    if (data.text.startsWith('/ban ') && (profile.role === 'owner' || profile.role === 'admin')) {
      const targetUser = data.text.split('/ban ')[1]?.trim();
      if (targetUser && targetUser !== 'm4kif') {
        try {
          db.prepare('UPDATE users SET is_banned=1 WHERE username=?').run(targetUser);
          io.emit('new_global_message', { id: Date.now().toString(), sender: 'SYSTEM', text: `🔨 ${targetUser} sunucudan kalıcı olarak yasaklandı!`, role: 'system', level: 999, time: Date.now() });
        } catch(e) {}
      }
      return;
    }

    if (data.text.startsWith('/mute ') && (profile.role === 'owner' || profile.role === 'admin')) {
      const parts = data.text.split(' ');
      const targetUser = parts[1];
      const minutes = parseInt(parts[2]) || 10;
      if (targetUser && targetUser !== 'm4kif') {
        try {
          const expireTime = new Date(Date.now() + minutes * 60000).toISOString();
          db.prepare('UPDATE users SET mute_expires_at=? WHERE username=?').run(expireTime, targetUser);
          io.emit('new_global_message', { id: Date.now().toString(), sender: 'SYSTEM', text: `🔇 ${targetUser}, ${minutes} dakika boyunca susturuldu.`, role: 'system', level: 999, time: Date.now() });
          
          // Eger socket'i aktifse profile'ini de güncelle
          for (let [sId, p] of playerProfiles.entries()) {
             if (p.name === targetUser) p.muteExpiresAt = expireTime;
          }
        } catch(e) {}
      }
      return;
    }

    const msg = {
      id: Date.now() + Math.random().toString(),
      sender: profile.name,
      text: data.text,
      level: profile.level,
      role: profile.role, // owner, admin, user
      replyTo: data.replyTo || null,
      reactions: {}, // { "👍": 2, "😂": 1 }
      time: Date.now()
    };
    globalChatHistory.push(msg);
    if (globalChatHistory.length > MAX_CHAT_HISTORY) globalChatHistory.shift();
    io.emit('new_global_message', msg);
  });

  socket.on('delete_global_message', (msgId) => {
     const profile = playerProfiles.get(socket.id);
     if (profile && (profile.role === 'owner' || profile.role === 'admin')) {
        const index = globalChatHistory.findIndex(m => m.id === msgId);
        if (index !== -1) {
           globalChatHistory.splice(index, 1);
           io.emit('global_message_deleted', msgId);
        }
     }
  });

  socket.on('react_global_message', (data) => {
     const { msgId, emoji } = data;
     const profile = playerProfiles.get(socket.id);
     if (!profile || !profile.isAuthenticated) return;
     
     const msg = globalChatHistory.find(m => m.id === msgId);
     if (msg) {
        msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;
        io.emit('global_message_reacted', { msgId, reactions: msg.reactions });
     }
  });

  // ── MATCHMAKING & AUTH ──
  socket.on('find_match', (data) => {
    let playerName = data?.playerName || `Misafir_${socket.id.substring(0, 4)}`;
    const gameMode = data?.gameMode || 'flag';
    const token = data?.token;

    let profile = { level: 1, xp: 0, coins: 0, winStreak: 0, ownedItems: [], equippedItems: {}, role: 'user' };
    let dbUserId = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
        if (user) {
          playerName = user.username;
          dbUserId = user.id;
          profile = { level: user.level, xp: user.xp, coins: user.coins, winStreak: user.win_streak, ownedItems: JSON.parse(user.owned_items), equippedItems: JSON.parse(user.equipped_items), role: user.role };
        }
      } catch (e) { /* invalid token */ }
    }

    const existingProfile = playerProfiles.get(socket.id) || {};
    playerProfiles.set(socket.id, { 
      ...existingProfile, 
      ...profile, 
      dbUserId: dbUserId || existingProfile.dbUserId, 
      name: playerName,
      isAuthenticated: existingProfile.isAuthenticated || !!dbUserId
    });
    socket.emit('profile_update', { ...profile, name: playerName, isAuthenticated: !!dbUserId || existingProfile.isAuthenticated });

    for (const mode in matchmakingPool) matchmakingPool[mode] = matchmakingPool[mode].filter(p => {
       if (p.id === socket.id && p.botTimer) clearTimeout(p.botTimer);
       return p.id !== socket.id;
    });
    if (!matchmakingPool[gameMode]) matchmakingPool[gameMode] = [];

    if (matchmakingPool[gameMode].length > 0) {
      const opponent = matchmakingPool[gameMode].pop();
      if (opponent.botTimer) clearTimeout(opponent.botTimer);
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      socket.join(roomId);
      opponent.socket.join(roomId);

      const profile1 = playerProfiles.get(socket.id) || {};
      const profile2 = playerProfiles.get(opponent.id) || {};

      const gameData = {
        roomId,
        gameMode,
        players: {
          [socket.id]: { id: socket.id, name: playerName, hp: 3, combo: 0, isOnFire: false, afkRounds: 0, answeredThisRound: false, correctAnswers: 0, totalSpeedBonus: 0, maxCombo: 0, level: profile1.level || 1, role: gameMode === 'coop' ? 'analyst' : null, equippedItems: profile1.equippedItems || {} },
          [opponent.id]: { id: opponent.id, name: opponent.name, hp: 3, combo: 0, isOnFire: false, afkRounds: 0, answeredThisRound: false, correctAnswers: 0, totalSpeedBonus: 0, maxCombo: 0, level: profile2.level || 1, role: gameMode === 'coop' ? 'breacher' : null, equippedItems: profile2.equippedItems || {} }
        },
        currentQuestion: null,
        questionTimer: null,
        roundAnswered: {}
      };

      if (gameMode === 'coop') gameData.coopPhase = 1;

      activeGames.set(roomId, gameData);

      io.to(roomId).emit('match_found', {
        roomId,
        gameMode,
        players: Object.values(gameData.players).map(p => ({ id: p.id, name: p.name, hp: p.hp, level: p.level, combo: 0, isOnFire: false, role: p.role, equippedItems: p.equippedItems }))
      });

      setTimeout(() => { if (activeGames.has(roomId)) sendNewQuestion(gameData); }, 2000);
      console.log(`[⚔] Eşleşme: ${roomId} [${gameMode}]`);
    } else {
      let botTimer = null;
      if (gameMode !== 'coop') {
         botTimer = setTimeout(() => {
            matchmakingPool[gameMode] = matchmakingPool[gameMode].filter(p => p.id !== socket.id);
            startBotMatch(socket.id, gameMode);
         }, 3000);
      }
      matchmakingPool[gameMode].push({ id: socket.id, socket, name: playerName, botTimer });
      console.log(`[…] Bekleniyor: ${playerName} (${gameMode})`);
    }
  });

  socket.on('submit_answer', (data) => {
    const { roomId, answerId } = data;
    if (!roomId) return;
    const now = Date.now();
    const lastAnswer = rateLimitMap.get(socket.id) || 0;
    if (now - lastAnswer < RATE_LIMIT_MS) return;
    rateLimitMap.set(socket.id, now);

    const game = activeGames.get(roomId);
    if (!game || !game.players[socket.id]) return;

    // CO-OP MECHANICS
    if (game.gameMode === 'coop') {
      const player = game.players[socket.id];
      if (player.role !== 'breacher') return; // Sadece breacher komut yazabilir
      
      const isCorrect = game.currentCoop.requiredRegex.test(answerId);
      if (isCorrect) {
        if (game.questionTimer) clearTimeout(game.questionTimer);
        io.to(roomId).emit('coop_success', { phase: game.currentCoop.phase });
        if (game.coopPhase >= 2) {
          // Co-op bitti, iki oyuncuya da XP/Coin verelim (basit bir win state)
          setTimeout(() => endGame(game, socket.id, socket.id, 'coop_victory'), 2000); 
        } else {
          game.coopPhase += 1;
          setTimeout(() => { if (activeGames.has(game.roomId)) sendNewQuestion(game); }, 2000);
        }
      } else {
        socket.emit('coop_terminal_error', { command: answerId, error: 'Bilinmeyen komut veya yanlış parametre!' });
      }
      return;
    }

    // REGULAR GAME MECHANICS
    processAnswer(socket, game, socket.id, answerId);
  });

  socket.on('coop_ping', (data) => {
    const game = activeGames.get(data.roomId);
    if (!game || game.gameMode !== 'coop') return;
    // Analyst ping the breacher
    socket.to(data.roomId).emit('coop_receive_ping', { message: data.message });
  });

  socket.on('disconnect', () => {
    console.log(`[-] Ayrıldı: ${socket.id}`);
    playerProfiles.delete(socket.id);
    for (const mode in matchmakingPool) {
      matchmakingPool[mode] = matchmakingPool[mode].filter(p => {
         if (p.id === socket.id && p.botTimer) clearTimeout(p.botTimer);
         return p.id !== socket.id;
      });
    }
    for (const [roomId, game] of activeGames.entries()) {
      if (game.players[socket.id]) {
        const opponentId = Object.keys(game.players).find(id => id !== socket.id);
        io.to(roomId).emit('opponent_disconnected_waiting', { disconnectedId: socket.id });
        if (game.questionTimer) clearTimeout(game.questionTimer);
        const timeout = setTimeout(() => {
          disconnectedPlayers.delete(socket.id);
          if (activeGames.has(roomId)) {
             if (game.gameMode === 'coop') {
                io.to(roomId).emit('coop_failed', { reason: 'Partnerinizin bağlantısı koptu. Operasyon iptal.' });
                activeGames.delete(roomId);
             } else {
                endGame(game, opponentId, socket.id, 'opponent_disconnected');
             }
          }
        }, RECONNECT_TIMEOUT);
        disconnectedPlayers.set(socket.id, { gameRoomId: roomId, timeout, profile: playerProfiles.get(socket.id) });
        break;
      }
    }
    rateLimitMap.delete(socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Sunucu port ${PORT} üzerinde çalışıyor.`);
});
