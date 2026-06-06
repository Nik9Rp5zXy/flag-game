import { useState, useEffect } from 'react';
import PlayerCard from './PlayerCard';
import { motion } from 'framer-motion';

export default function GameArena({ players, myId, currentQuestion, damagedPlayerId, onAnswer }) {
  const me = players.find(p => p.id === myId);
  const opponent = players.find(p => p.id !== myId);
  
  const [selectedOption, setSelectedOption] = useState(null);
  
  useEffect(() => {
    // Soru değiştiğinde seçimi sıfırla
    setSelectedOption(null);
  }, [currentQuestion]);

  if (!me || !opponent || !currentQuestion) return null;

  return (
    <div className="flex flex-col min-h-screen bg-bg-dark text-white p-4">
      <div className="flex justify-between items-center mb-8 gap-4 max-w-4xl mx-auto w-full pt-8">
        <PlayerCard player={me} isMe={true} isDamaged={damagedPlayerId === myId} />
        <div className="text-2xl font-black italic text-gray-500">VS</div>
        <PlayerCard player={opponent} isMe={false} isDamaged={damagedPlayerId === opponent.id} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full">
        {currentQuestion.flagUrl && (
          <motion.div 
            key={currentQuestion.flagUrl}
            className="mb-12 animate-slam"
          >
            <img 
              src={currentQuestion.flagUrl} 
              alt="Guess the flag" 
              className="w-full max-w-md h-auto rounded-lg shadow-[0_0_30px_rgba(255,255,255,0.2)] border-4 border-gray-800"
            />
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          {currentQuestion.options?.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                if (selectedOption !== null) return;
                setSelectedOption(opt.id);
                onAnswer(opt.id);
              }}
              disabled={selectedOption !== null}
              className={`p-4 text-lg md:text-xl font-bold rounded-lg transition-all border-2 cursor-pointer
                ${selectedOption === opt.id ? 'border-neon-blue bg-neon-blue text-white shadow-[0_0_15px_rgba(42,42,255,0.5)]' : 'border-gray-700 bg-gray-800 hover:bg-gray-700 hover:border-gray-500'}
                ${selectedOption !== null && selectedOption !== opt.id ? 'opacity-50 grayscale' : ''}
              `}
            >
              {opt.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
