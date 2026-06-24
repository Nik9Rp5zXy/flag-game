const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const flagsData = require('./src/data/flags.json');
const capitalsData = require('./src/data/capitals.json');
const shopItems = require('./src/data/shop_items.json');
const blackoutMap = require('./src/data/blackout_map.json');
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
    
    const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '24h' });
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
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
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
let matchmakingPool = { flag: [], capital: [], math: [], coop: [], blackout: [] };
const activeGames = new Map();       // roomId -> GameState
const blackoutLobbies = new Map();   // roomId -> LobbyState (for 2-4 player custom rooms)
const playerProfiles = new Map();    // socketId -> session profile
const disconnectedPlayers = new Map(); // socketId -> timeout details
const rateLimitMap = new Map();      
const chatRateLimitMap = new Map();
const typingUsers = new Set();
const MAX_CHAT_HISTORY = 50;
let globalChatHistory = [];

const dbWriteQueue = [];
function queueDbUpdate(query, params) {
    dbWriteQueue.push({ query, params });
}
setInterval(() => {
    if (dbWriteQueue.length > 0) {
        const job = dbWriteQueue.shift();
        try {
            db.prepare(job.query).run(...job.params);
        } catch (e) {
            console.error('DB Write Queue Error:', e);
        }
    }
}, 50);

try {
  const rows = db.prepare('SELECT * FROM messages ORDER BY time ASC LIMIT ?').all(MAX_CHAT_HISTORY);
  globalChatHistory = rows.map(r => ({
    id: r.id,
    sender: r.sender,
    text: r.text,
    level: r.level,
    role: r.role,
    replyTo: r.replyTo,
    reactions: JSON.parse(r.reactions || '{}'),
    time: r.time
  }));
} catch(e) {
  console.error("Chat gecmisi yuklenirken hata:", e);
}

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
  if (phase === 1) {
    const prefixes = ['192.168.', '10.0.0.', '172.16.', '10.10.10.'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const targetSuffix = Math.floor(Math.random() * 40) * 2 + 1; // Tek sayı
    const targetIP = `${prefix}${targetSuffix}`;
    
    return { 
      phase, 
      requiredRegex: new RegExp(`^scan\\s+${targetIP}$`, 'i'), 
      timeLimit: 35000, 
      hint: `[AĞ TARAMASI] Hedef IP'yi bul! Kural: "${prefix}" ile başlar ve sonu TEK SAYI ile biter.`, 
      commandHint: 'scan [IP_ADRESI]' 
    };
  } else if (phase === 2) {
    const base = Math.floor(Math.random() * 5) + 2; // 2 to 6
    const multiplier = Math.floor(Math.random() * 3) + 2; // 2 to 4
    const seq = [base, base * multiplier, base * multiplier * multiplier, base * multiplier * multiplier * multiplier];
    const answer = seq[3] * multiplier;
    
    return { 
      phase, 
      requiredRegex: new RegExp(`^decrypt\\s+${answer}$`, 'i'), 
      timeLimit: 30000, 
      hint: `[ŞİFRE KIRMA] Veri dizisindeki eksik sayıyı bul: ${seq[0]} - ${seq[1]} - ${seq[2]} - ${seq[3]} - ?`, 
      commandHint: 'decrypt [SAYI]' 
    };
  } else {
    const power = Math.floor(Math.random() * 50) + 50; // 50-99
    const cooling = Math.random() > 0.5 ? 'ON' : 'OFF';
    const shield = Math.random() > 0.5 ? '1' : '0';
    
    return { 
      phase, 
      requiredRegex: new RegExp(`^overload\\s+${power}\\s+${cooling}\\s+${shield}$`, 'i'), 
      timeLimit: 25000, 
      hint: `[SİSTEM AŞIRI YÜKLEMESİ] Değerleri ayarla! Güç: %${power} | Soğutma: ${cooling} | Kalkan: ${shield === '1' ? 'Aktif(1)' : 'Pasif(0)'}`, 
      commandHint: 'overload [GÜÇ] [SOĞUTMA(ON/OFF)] [KALKAN(1/0)]' 
    };
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
  endGame(game, null, null, 'coop_failed');
}

function endGame(game, winnerId, loserId, reason) {
  if (game.questionTimer) clearTimeout(game.questionTimer);
  if (game.reconnectTimeout) clearTimeout(game.reconnectTimeout);

  if (game.gameMode === 'coop') {
     const isVictory = reason === 'coop_victory';
     const pids = Object.keys(game.players);
     
     for (const pid of pids) {
        const player = game.players[pid];
        const profile = playerProfiles.get(pid) || {};
        
        let xpGained = 0;
        let coinsGained = 0;
        
        if (isVictory) {
           profile.winStreak = (profile.winStreak || 0) + 1;
           xpGained = 150 + (player.totalSpeedBonus || 0);
           coinsGained = 10 + (profile.winStreak || 1);
        } else {
           profile.winStreak = 0;
           xpGained = 20; 
           coinsGained = 0;
        }
        
        profile.xp = (profile.xp || 0) + xpGained;
        profile.coins = (profile.coins || 0) + coinsGained;
        
        let levelUp = false;
        while (profile.xp >= xpToNextLevel(profile.level || 1)) {
           profile.xp -= xpToNextLevel(profile.level || 1);
           profile.level = (profile.level || 1) + 1;
           levelUp = true;
        }
        
        if (profile.dbUserId) {
          queueDbUpdate('UPDATE users SET level=?, xp=?, coins=?, win_streak=? WHERE id=?', 
            [profile.level, profile.xp, profile.coins, profile.winStreak, profile.dbUserId]);
        }
        
        playerProfiles.set(pid, profile);
        
        const sock = io.sockets.sockets.get(pid);
        if (sock) {
           sock.emit('game_summary', {
              winnerId: isVictory ? pid : null,
              loserId: isVictory ? null : pid,
              reason: reason,
              yourStats: { 
                 isWinner: isVictory, 
                 xpGained, 
                 coinsGained, 
                 correctAnswers: player.correctAnswers || 0, 
                 maxCombo: player.maxCombo || 0, 
                 newLevel: profile.level, 
                 newXp: profile.xp, 
                 newCoins: profile.coins, 
                 xpToNext: xpToNextLevel(profile.level), 
                 levelUp, 
                 winStreak: profile.winStreak 
              }
           });
        }
     }
     activeGames.delete(game.roomId);
     return;
  }

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

  if (winnerProfile.dbUserId) {
    queueDbUpdate('UPDATE users SET level=?, xp=?, coins=?, win_streak=? WHERE id=?', 
      [winnerProfile.level, winnerProfile.xp, winnerProfile.coins, winnerProfile.winStreak, winnerProfile.dbUserId]);
  }
  if (loserProfile.dbUserId) {
    queueDbUpdate('UPDATE users SET level=?, xp=?, coins=?, win_streak=? WHERE id=?', 
      [loserProfile.level, loserProfile.xp, loserProfile.coins, loserProfile.winStreak, loserProfile.dbUserId]);
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

    // Rate Limiting (Spam Koruması)
    const now = Date.now();
    const lastChatTime = chatRateLimitMap.get(socket.id) || 0;
    if (now - lastChatTime < 3000) {
      return socket.emit('chat_error', { message: 'Çok hızlı mesaj gönderiyorsunuz. Lütfen bekleyin.' });
    }
    chatRateLimitMap.set(socket.id, now);

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
            const info = db.prepare("UPDATE users SET role='admin' WHERE username=?").run(targetUser);
            if (info.changes > 0) {
              for (let [sId, p] of playerProfiles.entries()) {
                 if (p.name === targetUser) p.role = 'admin';
              }
              io.emit('role_updated', { username: targetUser, role: 'admin' });
              io.emit('new_global_message', { id: Date.now().toString(), sender: 'SYSTEM', text: `👑 Kurucu, ${targetUser} kişisini ADMİN yaptı!`, role: 'system', level: 999, time: Date.now() });
            } else {
              socket.emit('chat_error', { message: 'Kullanıcı bulunamadı veya güncellenemedi.' });
            }
          } catch(e) {
            console.error('Admin yapma hatası:', e);
            socket.emit('chat_error', { message: 'Admin yapma sırasında hata oluştu.' });
          }
      }
      return;
    }

    if (data.text.startsWith('/admin kaldir ') && profile.role === 'owner') {
      const targetUser = data.text.split('/admin kaldir ')[1]?.trim();
      if (targetUser) {
        try {
          const info = db.prepare("UPDATE users SET role='user' WHERE username=?").run(targetUser);
          if (info.changes > 0) {
            for (let [sId, p] of playerProfiles.entries()) {
               if (p.name === targetUser) p.role = 'user';
            }
            io.emit('role_updated', { username: targetUser, role: 'user' });
            io.emit('new_global_message', { id: Date.now().toString(), sender: 'SYSTEM', text: `👑 Kurucu, ${targetUser} kişisinin yetkilerini aldı.`, role: 'system', level: 999, time: Date.now() });
          } else {
            socket.emit('chat_error', { message: 'Kullanıcı bulunamadı veya güncellenemedi.' });
          }
        } catch(e) {
          console.error('Admin yetkisi alma hatası:', e);
          socket.emit('chat_error', { message: 'Admin yetkisi alma sırasında hata oluştu.' });
        }
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
    
    try {
        db.prepare(`
          INSERT INTO messages (id, sender, text, level, role, replyTo, reactions, time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(msg.id, msg.sender, msg.text, msg.level, msg.role, msg.replyTo, JSON.stringify(msg.reactions), msg.time);
    } catch(e) {
        console.error("Mesaj DB'ye kaydedilemedi:", e);
    }

    globalChatHistory.push(msg);
    if (globalChatHistory.length > MAX_CHAT_HISTORY) {
       const removed = globalChatHistory.shift();
       try {
           db.prepare('DELETE FROM messages WHERE id = ?').run(removed.id);
       } catch(e) {}
    }
    io.emit('new_global_message', msg);
  });

  socket.on('delete_global_message', (msgId) => {
     const profile = playerProfiles.get(socket.id);
     if (profile && (profile.role === 'owner' || profile.role === 'admin')) {
        const index = globalChatHistory.findIndex(m => m.id === msgId);
        if (index !== -1) {
           globalChatHistory.splice(index, 1);
           try {
               db.prepare('DELETE FROM messages WHERE id = ?').run(msgId);
           } catch(e) {}
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
        try {
            db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(JSON.stringify(msg.reactions), msgId);
        } catch(e) {}
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

    // MULTI-BOXING CHECK
    if (dbUserId) {
       const isPlaying = [...activeGames.values()].some(g => Object.keys(g.players).some(id => id !== socket.id && playerProfiles.get(id)?.dbUserId === dbUserId)) || 
                         Object.values(matchmakingPool).some(pool => pool.some(p => p.id !== socket.id && playerProfiles.get(p.id)?.dbUserId === dbUserId)) ||
                         [...blackoutLobbies.values()].some(l => l.players.some(p => p.id !== socket.id && playerProfiles.get(p.id)?.dbUserId === dbUserId));
       if (isPlaying) {
          socket.emit('chat_error', { message: 'Hesabınız şu anda başka bir oyunda! Lütfen diğer sekmeyi kapatın.' });
          return;
       }
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

      if (gameMode === 'coop') {
        gameData.readyPlayers = new Set();
      } else {
        setTimeout(() => { if (activeGames.has(roomId)) sendNewQuestion(gameData); }, 2000);
      }
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

  // ============================================================
  // BLACKOUT LOBBY SYSTEM
  // ============================================================
  socket.on('join_blackout_lobby', (data) => {
     const { playerName, targetRoomId } = data;
     const profile = playerProfiles.get(socket.id) || {};
     const pName = profile.isAuthenticated ? profile.name : (playerName || `Misafir_${Math.floor(Math.random() * 9000) + 1000}`);
     const dbUserId = profile.dbUserId;

     // MULTI-BOXING CHECK
     if (dbUserId) {
       const isPlaying = [...activeGames.values()].some(g => Object.keys(g.players).some(id => id !== socket.id && playerProfiles.get(id)?.dbUserId === dbUserId)) || 
                         Object.values(matchmakingPool).some(pool => pool.some(p => p.id !== socket.id && playerProfiles.get(p.id)?.dbUserId === dbUserId)) ||
                         [...blackoutLobbies.values()].some(l => l.players.some(p => p.id !== socket.id && playerProfiles.get(p.id)?.dbUserId === dbUserId));
       if (isPlaying) {
          return socket.emit('chat_error', { message: 'Hesabınız şu anda başka bir oyunda! Lütfen diğer sekmeyi kapatın.' });
       }
     }
     
     let roomId = targetRoomId;
     let lobby = roomId ? blackoutLobbies.get(roomId) : null;

     // Eger oda belirtilmemisse veya yoksa acik bir lobi bulalim
     if (!lobby && !targetRoomId) {
       for (const [rId, l] of blackoutLobbies.entries()) {
         if (l.players.length < 4 && l.status === 'waiting') {
            lobby = l;
            roomId = rId;
            break;
         }
       }
     }

     // Yeni lobi kur
     if (!lobby) {
        roomId = targetRoomId || `BO_${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        lobby = { roomId, status: 'waiting', players: [] };
        blackoutLobbies.set(roomId, lobby);
     }

     if (lobby.players.length >= 4) {
        return socket.emit('chat_error', { message: 'Oda dolu!' });
     }
     if (lobby.status !== 'waiting') {
        return socket.emit('chat_error', { message: 'Oyun zaten basladi!' });
     }

     // Oyuncuyu lobiye ekle
     socket.join(roomId);
     lobby.players.push({ id: socket.id, name: pName, role: null, isReady: false });
     
     io.to(roomId).emit('blackout_lobby_update', lobby);
  });

  socket.on('blackout_select_role', (data) => {
     const { roomId, role } = data;
     const lobby = blackoutLobbies.get(roomId);
     if (!lobby) return;
     
     // Bu rolu baskasi almis mi?
     const taken = lobby.players.some(p => p.role === role && p.id !== socket.id);
     if (taken) return;

     const p = lobby.players.find(x => x.id === socket.id);
     if (p) {
        p.role = role;
        io.to(roomId).emit('blackout_lobby_update', lobby);
     }
  });

  socket.on('blackout_toggle_ready', (data) => {
     const { roomId } = data;
     const lobby = blackoutLobbies.get(roomId);
     if (!lobby) return;

     const p = lobby.players.find(x => x.id === socket.id);
     if (p) {
        p.isReady = !p.isReady;
        io.to(roomId).emit('blackout_lobby_update', lobby);

        // Herkes hazirsa ve en az 2 kisi varsa baslat
        if (lobby.players.length >= 2 && lobby.players.every(x => x.isReady && x.role)) {
           lobby.status = 'playing';
           const spawnPoints = [ {x: 32, y: 32}, {x: 64, y: 32}, {x: 32, y: 64}, {x: 64, y: 64} ];
           let spawnIdx = 0;
           
           io.to(roomId).emit('blackout_start_game', Object.assign({}, lobby, { map: blackoutMap }));
           
           activeGames.set(roomId, {
              roomId, 
              gameMode: 'blackout', 
              players: lobby.players.reduce((acc, pl) => {
                 const sp = spawnPoints[spawnIdx++];
                 acc[pl.id] = { id: pl.id, name: pl.name, role: pl.role, hp: 10, x: sp.x, y: sp.y };
                 return acc;
              }, {}),
              mapState: {
                 doors: JSON.parse(JSON.stringify(blackoutMap.doors || [])),
                 terminals: JSON.parse(JSON.stringify(blackoutMap.terminals || [])),
                 bots: [
                     { id: 'bot1', x: 10 * 32, y: 5 * 32, dir: 1, speed: 2 },
                     { id: 'bot2', x: 5 * 32, y: 12 * 32, dir: -1, speed: 2 }
                 ]
              }
           });
           
           const g = activeGames.get(roomId);
           // Start Blackout Bot Loop if not started
           if (!g.botTimer) {
              g.botTimer = setInterval(() => {
                 if (!activeGames.has(roomId)) {
                    clearInterval(g.botTimer);
                    return;
                 }
                 const cg = activeGames.get(roomId);
                 let moved = false;
                 cg.mapState.bots.forEach(bot => {
                    bot.x += bot.speed * bot.dir;
                    // Simple wall bounce
                    const ts = blackoutMap.tileSize;
                    const col = Math.floor((bot.x + ts/2) / ts);
                    const row = Math.floor((bot.y + ts/2) / ts);
                    if (row >= 0 && row < blackoutMap.height && col >= 0 && col < blackoutMap.width) {
                       if (blackoutMap.grid[row][col] === 1) {
                           bot.dir *= -1; // reverse
                           bot.x += bot.speed * bot.dir * 2;
                       }
                    } else {
                       bot.dir *= -1;
                    }
                    moved = true;
                    
                    // Collision with ghost
                    Object.values(cg.players).forEach(p => {
                        if (p.role === 'ghost') {
                            const dist = Math.hypot(p.x - bot.x, p.y - bot.y);
                            if (dist < 20) {
                                p.hp = Math.max(0, p.hp - 1); // damage
                                if (p.hp <= 0) {
                                    io.to(roomId).emit('chat_error', { message: 'HAYALET YAKALANDI! GÖREV BAŞARISIZ.' });
                                    // Normally we would end game here
                                }
                            }
                        }
                    });
                 });
                 if (moved) io.to(roomId).emit('blackout_sync', { players: cg.players, mapState: cg.mapState });
              }, 100);
           }
        }
     }
  });

  // ============================================================
  // WEBRTC SIGNALING (For Voice Chat in Blackout Mode)
  // ============================================================
  socket.on('webrtc_offer', (data) => {
     const { targetId, offer, roomId } = data;
     const lobby = blackoutLobbies.get(roomId) || activeGames.get(roomId);
     
     // Auth Check: Are both players actually in this room?
     if (!lobby || !lobby.players.find(p => p.id === socket.id && p.id) || !lobby.players.find(p => p.id === targetId && p.id)) {
         return; // Malicious drop
     }
     io.to(targetId).emit('webrtc_offer', { senderId: socket.id, offer });
  });

  socket.on('webrtc_answer', (data) => {
     const { targetId, answer, roomId } = data;
     const lobby = blackoutLobbies.get(roomId) || activeGames.get(roomId);
     if (!lobby || !lobby.players.find(p => p.id === socket.id && p.id) || !lobby.players.find(p => p.id === targetId && p.id)) return;
     io.to(targetId).emit('webrtc_answer', { senderId: socket.id, answer });
  });

  socket.on('webrtc_ice_candidate', (data) => {
     const { targetId, candidate, roomId } = data;
     const lobby = blackoutLobbies.get(roomId) || activeGames.get(roomId);
     if (!lobby || !lobby.players.find(p => p.id === socket.id && p.id) || !lobby.players.find(p => p.id === targetId && p.id)) return;
     io.to(targetId).emit('webrtc_ice_candidate', { senderId: socket.id, candidate });
  });

  socket.on('blackout_move', (data) => {
     const { roomId, x, y } = data;
     const game = activeGames.get(roomId);
     if (!game || game.gameMode !== 'blackout') return;
     
     const p = game.players[socket.id];
     if (!p) return;

     // Basic Collision Check on server
     const ts = blackoutMap.tileSize;
     const col = Math.floor((x + ts/2) / ts);
     const row = Math.floor((y + ts/2) / ts);
     
     if (row >= 0 && row < blackoutMap.height && col >= 0 && col < blackoutMap.width) {
        // Also check if door is closed
        const door = game.mapState.doors.find(d => d.x === col && d.y === row);
        if (blackoutMap.grid[row][col] === 0 && (!door || door.isOpen)) {
           p.x = x;
           p.y = y;
        }
     }
     
     io.to(roomId).emit('blackout_sync', { players: game.players, mapState: game.mapState });
  });

  socket.on('blackout_interact', (data) => {
     const { roomId, action, targetId } = data;
     const game = activeGames.get(roomId);
     if (!game || game.gameMode !== 'blackout') return;
     
     if (action === 'toggle_door') {
         const door = game.mapState.doors.find(d => d.id === targetId);
         if (door) {
             door.isOpen = !door.isOpen;
             io.to(roomId).emit('blackout_sync', { players: game.players, mapState: game.mapState });
             
             // Zamanlı kapı (5 saniye sonra otomatik kapanır)
             if (door.isOpen) {
                 setTimeout(() => {
                     if (activeGames.has(roomId)) {
                         const g = activeGames.get(roomId);
                         const d = g.mapState.doors.find(x => x.id === targetId);
                         if (d && d.isOpen) {
                             d.isOpen = false;
                             io.to(roomId).emit('blackout_sync', { players: g.players, mapState: g.mapState });
                         }
                     }
                 }, 5000);
             }
         }
     } else if (action === 'hack_terminal') {
         const term = game.mapState.terminals.find(t => t.id === targetId);
         if (term) {
             term.isHacked = true;
             io.to(roomId).emit('blackout_sync', { players: game.players, mapState: game.mapState });
         }
     }
  });

  socket.on('submit_answer', (data) => {
    const { roomId, answerId, questionId } = data;
    if (!roomId) return;
    const now = Date.now();
    const lastAnswer = rateLimitMap.get(socket.id) || 0;
    if (now - lastAnswer < RATE_LIMIT_MS) return;
    rateLimitMap.set(socket.id, now);

    const game = activeGames.get(roomId);
    if (!game || !game.players[socket.id]) return;

    // RACE CONDITION FIX
    if (game.gameMode !== 'coop' && game.currentQuestion && questionId) {
       if (game.currentQuestion.createdAt !== questionId) {
          // Gelen cevap eski bir soruya ait, yoksay
          return;
       }
    }

    // CO-OP MECHANICS
    if (game.gameMode === 'coop') {
      const player = game.players[socket.id];
      if (player.role !== 'breacher') return; // Sadece breacher komut yazabilir
      
      const isCorrect = game.currentCoop.requiredRegex.test(answerId);
      if (isCorrect) {
        if (game.questionTimer) clearTimeout(game.questionTimer);
        io.to(roomId).emit('coop_success', { phase: game.currentCoop.phase });
        if (game.coopPhase >= 3) {
          setTimeout(() => endGame(game, null, null, 'coop_victory'), 2000);
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

  socket.on('coop_ready', (data) => {
    const { roomId } = data;
    const game = activeGames.get(roomId);
    if (!game || game.gameMode !== 'coop') return;

    if (!game.readyPlayers) game.readyPlayers = new Set();
    game.readyPlayers.add(socket.id);

    socket.to(roomId).emit('coop_partner_ready');

    if (game.readyPlayers.size === 2) {
       io.to(roomId).emit('coop_start');
       sendNewQuestion(game);
    }
  });

  socket.on('coop_chat', (data) => {
    const { roomId, message } = data;
    const game = activeGames.get(roomId);
    if (!game || game.gameMode !== 'coop') return;

    const senderName = game.players[socket.id]?.name || 'Ajan';
    const senderRole = game.players[socket.id]?.role === 'breacher' ? 'BREACHER' : 'ANALYST';
    
    io.to(roomId).emit('coop_chat_message', {
      senderId: socket.id,
      senderName,
      senderRole,
      message,
      timestamp: Date.now()
    });
  });

  socket.on('reclaim_session', (data) => {
    const { token, roomId } = data;
    if (!token || !roomId) return;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const dbUserId = decoded.id;

        const game = activeGames.get(roomId);
        if (!game) return socket.emit('chat_error', { message: 'Oda bulunamadı veya kapandı.' });

        const oldSocketId = Object.keys(game.players).find(id => disconnectedPlayers.has(id) && disconnectedPlayers.get(id).profile?.dbUserId === dbUserId);
        
        if (oldSocketId) {
            const timeoutData = disconnectedPlayers.get(oldSocketId);
            if (timeoutData) clearTimeout(timeoutData.timeout);
            disconnectedPlayers.delete(oldSocketId);

            game.players[socket.id] = game.players[oldSocketId];
            game.players[socket.id].id = socket.id;
            delete game.players[oldSocketId];

            playerProfiles.set(socket.id, timeoutData.profile);
            
            socket.join(roomId);
            io.to(roomId).emit('opponent_reconnected');
            
            socket.emit('session_reclaimed', { gameMode: game.gameMode, players: game.players, roomId });
        }
    } catch (e) {
        socket.emit('chat_error', { message: 'Oturum kurtarılamadı.' });
    }
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
