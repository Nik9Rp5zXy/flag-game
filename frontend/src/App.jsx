import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import LoadingScreen from './components/LoadingScreen';
import GameArena from './components/GameArena';
import GameSummary from './components/GameSummary';
import LevelUpOverlay from './components/LevelUpOverlay';
import Shop from './components/Shop';
import { playSound, startBgMusic } from './utils/soundManager';

const SOCKET_URL = import.meta.env.PROD ? '/' : 'http://localhost:5000';

function App() {
  // ── Core State ──
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState('menu');
  const [roomId, setRoomId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [damagedPlayerId, setDamagedPlayerId] = useState(null);

  // ── Emotes ──
  const [activeEmotes, setActiveEmotes] = useState([]);

  // ── Progression ──
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('minigame_profile');
      return saved ? JSON.parse(saved) : { level: 1, xp: 0, coins: 0, ownedItems: [], equippedItems: {} };
    } catch { return { level: 1, xp: 0, coins: 0, ownedItems: [], equippedItems: {} }; }
  });
  const [gameSummaryStats, setGameSummaryStats] = useState(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(1);

  // ── UI Overlays ──
  const [showShop, setShowShop] = useState(false);
  const [afkWarning, setAfkWarning] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  // Profili localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem('minigame_profile', JSON.stringify(profile));
  }, [profile]);

  // ── Socket Bağlantısı ──
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Socket] Bağlandı:', newSocket.id);
      setMyId(newSocket.id);
    });

    // ── PROFILE UPDATE ──
    newSocket.on('profile_update', (data) => {
      setProfile(prev => {
        const updated = { ...prev, ...data };
        return updated;
      });
    });

    // ── MATCH FOUND ──
    newSocket.on('match_found', (data) => {
      setRoomId(data.roomId);
      setPlayers(data.players);
      setGameState('playing');
      setAfkWarning(false);
      setOpponentDisconnected(false);
      startBgMusic();
    });

    // ── NEW QUESTION ──
    newSocket.on('new_question', (question) => {
      setCurrentQuestion(question);
      setDamagedPlayerId(null);
      setAfkWarning(false);
      playSound('slam');
    });

    // ── ANSWER RESULT ──
    newSocket.on('answer_result', (data) => {
      if (data.isCorrect) {
        if (data.playerId === newSocket.id) {
          playSound('correct');
        }
        playSound('damage');

        if (data.players) {
          setPlayers(data.players);
        }

        const hitId = data.players?.find(p => p.id !== data.playerId)?.id;
        setDamagedPlayerId(hitId);

        // Kombo ses efekti
        if (data.combo > 1 && data.playerId === newSocket.id) {
          playSound('combo');
        }
      } else {
        if (data.playerId === newSocket.id) {
          playSound('wrong');
          setDamagedPlayerId(newSocket.id);
          setTimeout(() => setDamagedPlayerId(null), 500);
        }
      }
    });

    // ── TIME UP ──
    newSocket.on('time_up', (data) => {
      setDamagedPlayerId(null);
      // Süre doldu sesi eklenebilir
    });

    // ── ON FIRE / FIRE OFF ──
    newSocket.on('on_fire', (data) => {
      playSound('fire');
    });

    newSocket.on('fire_off', () => {
      // Sessiz geçiş
    });

    // ── AFK WARNING ──
    newSocket.on('afk_warning', () => {
      setAfkWarning(true);
      playSound('tick');
    });

    // ── OPPONENT DISCONNECT/RECONNECT ──
    newSocket.on('opponent_disconnected_waiting', () => {
      setOpponentDisconnected(true);
    });

    newSocket.on('opponent_reconnected', () => {
      setOpponentDisconnected(false);
    });

    // ── GAME SUMMARY (replaces game_over) ──
    newSocket.on('game_summary', (data) => {
      setGameSummaryStats(data.yourStats);
      setGameState('game_summary');
      setActiveEmotes([]);
      setAfkWarning(false);
      setOpponentDisconnected(false);

      // Profili güncelle
      setProfile(prev => ({
        ...prev,
        level: data.yourStats.newLevel,
        xp: data.yourStats.newXp,
        coins: data.yourStats.newCoins
      }));

      // Level up overlay
      if (data.yourStats.levelUp) {
        setNewLevel(data.yourStats.newLevel);
        setTimeout(() => {
          setShowLevelUp(true);
          playSound('levelup');
        }, 1500);
      }
    });

    // ── RECONNECT ──
    newSocket.on('reconnected', (data) => {
      setRoomId(data.roomId);
      setPlayers(data.players);
      setCurrentQuestion(data.currentQuestion);
      setGameState('playing');
      setOpponentDisconnected(false);
    });

    newSocket.on('reconnect_failed', () => {
      setGameState('menu');
    });

    // ── Emote ──
    newSocket.on('receive_emote', (data) => {
      triggerEmote(data.senderId, data.emote);
    });

    return () => newSocket.close();
  }, []);

  // ── Handlers ──
  const handleStartMatchmaking = useCallback((selectedMode) => {
    setGameState('matching');
    socket.emit('find_match', {
      playerName: `Player_${Math.floor(Math.random() * 9000) + 1000}`,
      gameMode: selectedMode
    });
  }, [socket]);

  const handleAnswer = useCallback((answerId) => {
    socket.emit('submit_answer', { roomId, answerId });
  }, [socket, roomId]);

  const handleSendEmote = useCallback((emote) => {
    socket.emit('send_emote', { roomId, emote });
    triggerEmote(myId, emote);
  }, [socket, roomId, myId]);

  const triggerEmote = (senderId, emote) => {
    const emoteObj = { id: Date.now() + Math.random(), senderId, emote };
    setActiveEmotes(prev => [...prev, emoteObj]);
    setTimeout(() => {
      setActiveEmotes(prev => prev.filter(e => e.id !== emoteObj.id));
    }, 2500);
  };

  const handleBackToMenu = useCallback(() => {
    setGameState('menu');
    setGameSummaryStats(null);
    setCurrentQuestion(null);
    setPlayers([]);
    setRoomId(null);
    setDamagedPlayerId(null);
  }, []);

  // ── Render ──

  // Level Up Overlay (herhangi bir durumda gösterilebilir)
  const levelUpOverlay = showLevelUp && (
    <LevelUpOverlay
      level={newLevel}
      onComplete={() => setShowLevelUp(false)}
    />
  );

  // Shop Overlay
  const shopOverlay = showShop && (
    <Shop
      profile={profile}
      socketId={myId}
      onClose={() => setShowShop(false)}
    />
  );

  if (gameState === 'menu' || gameState === 'matching') {
    return (
      <>
        <LoadingScreen
          isMatching={gameState === 'matching'}
          onStart={handleStartMatchmaking}
          profile={profile}
          onOpenShop={() => setShowShop(true)}
        />
        {shopOverlay}
        {levelUpOverlay}
      </>
    );
  }

  if (gameState === 'game_summary') {
    return (
      <>
        <GameSummary
          stats={gameSummaryStats}
          onBackToMenu={handleBackToMenu}
        />
        {levelUpOverlay}
      </>
    );
  }

  return (
    <>
      <GameArena
        players={players}
        myId={myId}
        currentQuestion={currentQuestion}
        damagedPlayerId={damagedPlayerId}
        activeEmotes={activeEmotes}
        onAnswer={handleAnswer}
        onSendEmote={handleSendEmote}
        afkWarning={afkWarning}
        opponentDisconnected={opponentDisconnected}
      />
      {levelUpOverlay}
    </>
  );
}

export default App;
