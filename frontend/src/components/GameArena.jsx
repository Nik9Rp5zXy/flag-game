import { useState, useEffect } from 'react';
import PlayerCard from './PlayerCard';
import { motion, AnimatePresence } from 'framer-motion';

export default function GameArena({ players, myId, currentQuestion, damagedPlayerId, onAnswer, onSendEmote, activeEmotes }) {
  const me = players.find(p => p.id === myId);
  const opponent = players.find(p => p.id !== myId);
  
  const [selectedOption, setSelectedOption] = useState(null);
  
  useEffect(() => {
    setSelectedOption(null);
  }, [currentQuestion]);

  if (!me || !opponent || !currentQuestion) return null;

  const emotes = ['😂', '😡', '🤡', '🚀'];

  return (
    <div className="flex flex-col min-h-screen bg-bg-dark text-white p-4 relative overflow-hidden">
      
      {/* Aktif emojileri ekranda zıplat */}
      <AnimatePresence>
        {activeEmotes.map((emoteObj) => (
          <motion.div
            key={emoteObj.id}
            initial={{ scale: 0, y: 100, opacity: 0 }}
            animate={{ scale: [1, 2.5, 2], y: -400, opacity: [1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className={`absolute z-50 text-7xl md:text-9xl ${emoteObj.senderId === myId ? 'left-1/4' : 'right-1/4'} bottom-1/4 pointer-events-none drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]`}
          >
            {emoteObj.emote}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-8 gap-4 max-w-4xl mx-auto w-full pt-8 relative z-10">
        <PlayerCard player={me} isMe={true} isDamaged={damagedPlayerId === myId} />
        <div className="text-2xl font-black italic text-gray-500">VS</div>
        <PlayerCard player={opponent} isMe={false} isDamaged={damagedPlayerId === opponent.id} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full relative z-10">
        <motion.div 
          key={currentQuestion.correctId + currentQuestion.type}
          className="mb-12 animate-slam text-center w-full"
        >
          {currentQuestion.type === 'flag' && currentQuestion.questionData.flagUrl && (
            <img 
              src={currentQuestion.questionData.flagUrl} 
              alt="Guess the flag" 
              className="w-full max-w-md mx-auto h-auto rounded-lg shadow-[0_0_30px_rgba(255,255,255,0.2)] border-4 border-gray-800"
            />
          )}
          {(currentQuestion.type === 'capital' || currentQuestion.type === 'math') && (
            <div className="bg-gray-800 p-8 md:p-12 rounded-xl border-2 border-neon-blue shadow-[0_0_30px_rgba(42,42,255,0.3)]">
              <h2 className="text-4xl md:text-6xl font-black tracking-tight">{currentQuestion.questionData.text}</h2>
            </div>
          )}
        </motion.div>

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
              {opt.text}
            </button>
          ))}
        </div>
      </div>

      {/* Emoji Gönderme Paneli */}
      <div className="fixed right-4 bottom-4 flex flex-col gap-2 z-20">
        {emotes.map(emote => (
          <button 
            key={emote}
            onClick={() => onSendEmote(emote)}
            className="w-12 h-12 md:w-16 md:h-16 bg-gray-800 rounded-full border border-gray-600 flex items-center justify-center text-2xl md:text-3xl hover:bg-gray-700 hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-lg"
          >
            {emote}
          </button>
        ))}
      </div>
    </div>
  );
}
