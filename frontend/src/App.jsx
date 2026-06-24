import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import LoadingScreen from './components/LoadingScreen';
import GameArena from './components/GameArena';
import CoopArena from './components/CoopArena';
import GameSummary from './components/GameSummary';
import LevelUpOverlay from './components/LevelUpOverlay';
import Shop from './components/Shop';
import AuthScreen from './components/AuthScreen';
import BlackoutLobby from './components/BlackoutLobby';
import BlackoutArena from './components/BlackoutArena';
import { playSound, startBgMusic } from './utils/soundManager';

const SOCKET_URL = import.meta.env.PROD ? '/' : 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState('menu');
  const [roomId, setRoomId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [gameMode, setGameMode] = useState('flag');
  
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [damagedPlayerId, setDamagedPlayerId] = useState(null);

  // Blackout State
  const [blackoutLobbyData, setBlackoutLobbyData] = useState(null);

  // Coop State
  const [coopPhase, setCoopPhase] = useState(0);
  const [coopHint, setCoopHint] = useState('');
  const [coopCommandHint, setCoopCommandHint] = useState('');

  const [activeEmotes, setActiveEmotes] = useState([]);
  const [poolCounts, setPoolCounts] = useState({ flag: 0, capital: 0, math: 0, coop: 0 });

  // Auth & Profile
  const [token, setToken] = useState(() => localStorage.getItem('minigame_token'));
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('minigame_profile');
      return saved ? JSON.parse(saved) : { level: 1, xp: 0, coins: 0, ownedItems: [], equippedItems: {}, isAuthenticated: false };
    } catch { return { level: 1, xp: 0, coins: 0, ownedItems: [], equippedItems: {}, isAuthenticated: false }; }
  });
  
  const [gameSummaryStats, setGameSummaryStats] = useState(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(1);

  const [showShop, setShowShop] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [afkWarning, setAfkWarning] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  useEffect(() => {
    localStorage.setItem('minigame_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (token) localStorage.setItem('minigame_token', token);
    else localStorage.removeItem('minigame_token');

    if (socket && token) {
      socket.emit('authenticate', token);
    }
  }, [token, socket]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000 });
    setSocket(newSocket);

    newSocket.on('connect', () => { 
      setMyId(newSocket.id); 
      if (token) newSocket.emit('authenticate', token);
    });

    newSocket.on('profile_update', (data) => {
      setProfile(prev => ({ ...prev, ...data }));
    });

    newSocket.on('pool_counts', (counts) => {
      setPoolCounts(counts);
    });

    newSocket.on('match_found', (data) => {
      setRoomId(data.roomId);
      setGameMode(data.gameMode);
      setPlayers(data.players);
      setGameState('playing');
      setAfkWarning(false);
      setOpponentDisconnected(false);
      startBgMusic();
    });

    // CLASSIC GAME EVENTS
    newSocket.on('new_question', (question) => {
      setCurrentQuestion(question);
      setDamagedPlayerId(null);
      setAfkWarning(false);
      playSound('slam');
    });
    newSocket.on('answer_result', (data) => {
      if (data.isCorrect) {
        if (data.playerId === newSocket.id) playSound('correct');
        playSound('damage');
        if (data.players) setPlayers(data.players);
        const hitId = data.players?.find(p => p.id !== data.playerId)?.id;
        setDamagedPlayerId(hitId);
        if (data.combo > 1 && data.playerId === newSocket.id) playSound('combo');
      } else {
        if (data.playerId === newSocket.id) {
          playSound('wrong');
          setDamagedPlayerId(newSocket.id);
          setTimeout(() => setDamagedPlayerId(null), 500);
        }
      }
    });

    // COOP GAME EVENTS
    newSocket.on('coop_new_phase', (data) => {
      setCoopPhase(data.phase);
      setCoopHint(data.hint);
      setCoopCommandHint(data.commandHint);
      playSound('slam');
    });
    newSocket.on('coop_success', (data) => {
      playSound('correct');
    });
    newSocket.on('coop_terminal_error', (data) => {
      playSound('wrong');
      // could show an error log in CoopArena directly, but it relies on local state, we'll let CoopArena handle its own log or ignore for now
    });
    newSocket.on('coop_receive_ping', (data) => {
      playSound('tick'); // Or a ping sound
      // Handle showing ping message... handled by triggering a fake emote or similar
    });

    // COMMON EVENTS
    newSocket.on('time_up', () => setDamagedPlayerId(null));
    newSocket.on('on_fire', () => playSound('fire'));
    newSocket.on('afk_warning', () => { setAfkWarning(true); playSound('tick'); });
    newSocket.on('opponent_disconnected_waiting', () => setOpponentDisconnected(true));
    newSocket.on('opponent_reconnected', () => setOpponentDisconnected(false));

    // BLACKOUT EVENTS
    newSocket.on('blackout_lobby_update', (lobby) => {
      setBlackoutLobbyData(lobby);
      setPlayers(lobby.players);
      setRoomId(lobby.roomId);
    });
    newSocket.on('blackout_start_game', (lobby) => {
      setGameState('blackout_playing');
      playSound('slam');
    });

    newSocket.on('game_summary', (data) => {
      setGameSummaryStats(data.yourStats);
      setGameState('game_summary');
      setActiveEmotes([]);
      setAfkWarning(false);
      setOpponentDisconnected(false);

      setProfile(prev => ({ ...prev, level: data.yourStats.newLevel, xp: data.yourStats.newXp, coins: data.yourStats.newCoins }));
      if (data.yourStats.levelUp) {
        setNewLevel(data.yourStats.newLevel);
        setTimeout(() => { setShowLevelUp(true); playSound('levelup'); }, 1500);
      }
    });

    newSocket.on('receive_emote', (data) => triggerEmote(data.senderId, data.emote));

    return () => newSocket.close();
  }, []);

  const handleStartMatchmaking = useCallback((selectedMode) => {
    const pName = profile.isAuthenticated ? profile.name : `Misafir_${Math.floor(Math.random() * 9000) + 1000}`;
    
    if (selectedMode === 'blackout') {
       setGameState('blackout_lobby');
       socket.emit('join_blackout_lobby', { playerName: pName, targetRoomId: null });
       return;
    }

    setGameState('matching');
    socket.emit('find_match', {
      playerName: pName,
      gameMode: selectedMode,
      token: token
    });
  }, [socket, profile, token]);

  const handleAnswer = useCallback((answerId) => {
    socket.emit('submit_answer', { roomId, answerId, questionId: currentQuestion?.createdAt });
  }, [socket, roomId, currentQuestion]);

  const handleSendEmote = useCallback((emote) => {
    socket.emit('send_emote', { roomId, emote });
    triggerEmote(myId, emote);
  }, [socket, roomId, myId]);

  const triggerEmote = (senderId, emote) => {
    const emoteObj = { id: Date.now() + Math.random(), senderId, emote };
    setActiveEmotes(prev => [...prev, emoteObj]);
    setTimeout(() => { setActiveEmotes(prev => prev.filter(e => e.id !== emoteObj.id)); }, 2500);
  };

  const handleBackToMenu = useCallback(() => {
    setGameState('menu');
    setGameSummaryStats(null); setCurrentQuestion(null); setPlayers([]); setRoomId(null); setDamagedPlayerId(null);
  }, []);

  const handleLoginSuccess = (data) => {
    setToken(data.token);
    setProfile(prev => ({
      ...prev,
      isAuthenticated: true,
      name: data.username,
      level: data.level, xp: data.xp, coins: data.coins,
      ownedItems: data.ownedItems, equippedItems: data.equippedItems
    }));
    setShowAuth(false);
  };

  const handleLogout = () => {
    setToken(null);
    setProfile({ level: 1, xp: 0, coins: 0, ownedItems: [], equippedItems: {}, isAuthenticated: false });
  };

  const levelUpOverlay = showLevelUp && <LevelUpOverlay level={newLevel} onComplete={() => setShowLevelUp(false)} />;
  const shopOverlay = showShop && <Shop profile={profile} socketId={myId} onClose={() => setShowShop(false)} />;
  const authOverlay = showAuth && <AuthScreen onLoginSuccess={handleLoginSuccess} onGuestPlay={() => setShowAuth(false)} onClose={() => setShowAuth(false)} />;

  if (gameState === 'menu' || gameState === 'matching') {
    return (
      <>
        <LoadingScreen
          socket={socket}
          poolCounts={poolCounts}
          isMatching={gameState === 'matching'}
          onStart={handleStartMatchmaking}
          profile={profile}
          onOpenShop={() => setShowShop(true)}
          onLogout={handleLogout}
          onOpenAuth={() => setShowAuth(true)}
        />
        {shopOverlay}
        {authOverlay}
        {levelUpOverlay}
      </>
    );
  }

  if (gameState === 'blackout_lobby') {
    return (
       <BlackoutLobby 
          socket={socket}
          roomId={roomId}
          players={players}
          myId={myId}
          onLeave={() => setGameState('menu')}
       />
    );
  }

  if (gameState === 'game_summary') {
    return <><GameSummary stats={gameSummaryStats} onBackToMenu={handleBackToMenu} />{levelUpOverlay}</>;
  }

  if (gameState === 'blackout_playing') {
    return (
      <BlackoutArena 
        socket={socket}
        roomId={roomId}
        players={players}
        myId={myId}
      />
    );
  }

  if (gameMode === 'coop') {
    return (
      <>
        <CoopArena
          socket={socket}
          roomId={roomId}
          players={players}
          myId={myId}
          currentPhase={coopPhase}
          currentHint={coopHint}
          commandHint={coopCommandHint}
          onCommandSubmit={handleAnswer}
          onPing={(msg) => socket.emit('coop_ping', { roomId, message: msg })}
          afkWarning={afkWarning}
          opponentDisconnected={opponentDisconnected}
        />
        {levelUpOverlay}
      </>
    );
  }

  return (
    <>
      <GameArena
        players={players} myId={myId} currentQuestion={currentQuestion}
        damagedPlayerId={damagedPlayerId} activeEmotes={activeEmotes}
        onAnswer={handleAnswer} onSendEmote={handleSendEmote}
        afkWarning={afkWarning} opponentDisconnected={opponentDisconnected}
      />
      {levelUpOverlay}
    </>
  );
}

export default App;
