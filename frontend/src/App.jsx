import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import LoadingScreen from './components/LoadingScreen';
import GameArena from './components/GameArena';
import { playSound } from './utils/soundManager';

const SOCKET_URL = import.meta.env.PROD ? '/' : 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState('menu'); 
  const [roomId, setRoomId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [damagedPlayerId, setDamagedPlayerId] = useState(null);
  const [gameOverResult, setGameOverResult] = useState(null);
  
  // Emote sistemi state'i
  const [activeEmotes, setActiveEmotes] = useState([]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      setMyId(newSocket.id);
    });

    newSocket.on('match_found', (data) => {
      setRoomId(data.roomId);
      setPlayers(data.players);
      setGameState('playing');
    });

    newSocket.on('new_question', (question) => {
      setCurrentQuestion(question);
      setDamagedPlayerId(null); 
      playSound('slam'); 
    });

    newSocket.on('answer_result', (data) => {
      if (data.isCorrect) {
        playSound('damage');
        setPlayers(data.players); 
        
        const opponentId = data.players.find(p => p.id !== data.playerId)?.id;
        setDamagedPlayerId(opponentId);
      } else {
        if (data.playerId === newSocket.id) {
          playSound('wrong'); 
          setDamagedPlayerId(newSocket.id); 
          setTimeout(() => setDamagedPlayerId(null), 500); 
        }
      }
    });

    newSocket.on('game_over', (data) => {
      setGameOverResult(data);
      setGameState('game_over');
      setActiveEmotes([]); // oyun bitince emojileri temizle
    });

    // Rakibin attığı emojiyi dinle
    newSocket.on('receive_emote', (data) => {
      triggerEmote(data.senderId, data.emote);
    });

    return () => newSocket.close();
  }, []);

  const handleStartMatchmaking = (selectedMode) => {
    setGameState('matching');
    socket.emit('find_match', { 
      playerName: `Player_${Math.floor(Math.random()*1000)}`,
      gameMode: selectedMode 
    });
  };

  const handleAnswer = (answerId) => {
    socket.emit('submit_answer', { roomId, answerId });
  };

  const handleSendEmote = (emote) => {
    socket.emit('send_emote', { roomId, emote });
    triggerEmote(myId, emote);
  };

  const triggerEmote = (senderId, emote) => {
    const emoteObj = { id: Date.now() + Math.random(), senderId, emote };
    setActiveEmotes(prev => [...prev, emoteObj]);
    // 2 saniye sonra listeden sil (animasyon bitince)
    setTimeout(() => {
      setActiveEmotes(prev => prev.filter(e => e.id !== emoteObj.id));
    }, 2500);
  };

  if (gameState === 'menu' || gameState === 'matching') {
    return <LoadingScreen isMatching={gameState === 'matching'} onStart={handleStartMatchmaking} />;
  }

  if (gameState === 'game_over') {
    const isWinner = gameOverResult.winnerId === myId;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg-dark text-white p-4">
        <h1 className={`text-6xl md:text-8xl font-black mb-8 animate-slam ${isWinner ? 'text-neon-blue drop-shadow-[0_0_20px_rgba(42,42,255,0.8)]' : 'text-neon-red drop-shadow-[0_0_20px_rgba(255,42,42,0.8)]'}`}>
          {isWinner ? 'KAZANDIN!' : 'KAYBETTİN'}
        </h1>
        {gameOverResult.reason === 'opponent_disconnected' && (
          <p className="text-gray-400 mb-8 text-xl">Rakip oyundan kaçtı.</p>
        )}
        <button 
          onClick={() => setGameState('menu')}
          className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xl rounded-lg border-2 border-gray-600 transition-all cursor-pointer mt-8 hover:scale-105"
        >
          ANA MENÜYE DÖN
        </button>
      </div>
    );
  }

  return (
    <GameArena 
      players={players} 
      myId={myId} 
      currentQuestion={currentQuestion} 
      damagedPlayerId={damagedPlayerId}
      activeEmotes={activeEmotes}
      onAnswer={handleAnswer} 
      onSendEmote={handleSendEmote}
    />
  );
}

export default App;
