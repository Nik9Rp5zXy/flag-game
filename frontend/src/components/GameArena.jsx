import { useState, useEffect } from 'react';
import PlayerCard from './PlayerCard';
import TimerBar from './TimerBar';
import { motion, AnimatePresence } from 'framer-motion';

export default function GameArena({
  players, myId, currentQuestion, damagedPlayerId,
  onAnswer, onSendEmote, activeEmotes,
  isOnFire, afkWarning, opponentDisconnected
}) {
  const me = players.find(p => p.id === myId);
  const opponent = players.find(p => p.id !== myId);
  const [selectedOption, setSelectedOption] = useState(null);

  useEffect(() => {
    setSelectedOption(null);
  }, [currentQuestion]);

  if (!me || !opponent || !currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg-dark text-white p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <h1 className="text-xl font-bold text-gray-300 tracking-wide">Saha Hazırlanıyor...</h1>
        <p className="text-sm text-gray-500 mt-2 animate-pulse">Oyuncular bekleniyor veya bağlantı kuruluyor</p>
      </div>
    );
  }

  const emotes = ['😂', '😡', '🤡', '🚀', '🔥', '💀'];
  const questionKey = currentQuestion?.questionData?.text || currentQuestion?.questionData?.flagUrl || Date.now();

  return (
    <div className="flex flex-col min-h-screen bg-bg-dark text-white p-4 relative overflow-hidden">

      {/* ── AFK Uyarısı ── */}
      <AnimatePresence>
        {afkWarning && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[60] bg-neon-red/90 text-white text-center py-3 font-bold text-lg backdrop-blur-sm"
          >
            ⚠️ AFK UYARISI — Oynamamaya devam edersen kaybedersin!
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Rakip Bağlantı Koptu Perdesi ── */}
      <AnimatePresence>
        {opponentDisconnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center backdrop-blur-sm"
          >
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-neon-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-xl font-bold text-gray-300">Rakibin bağlantısı koptu...</p>
              <p className="text-gray-500 mt-1">15 saniye içinde dönmezse galibiyetiniz onaylanır.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Aktif Emojiler ── */}
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

      {/* ── Oyuncu Kartları ── */}
      <div className="flex justify-between items-center mb-4 gap-4 max-w-4xl mx-auto w-full pt-6 relative z-10">
        <PlayerCard player={me} isMe={true} isDamaged={damagedPlayerId === myId} />
        <div className="flex flex-col items-center gap-2">
          <div className="text-xl font-black italic text-gray-600">VS</div>
          <button 
             onClick={() => window.location.reload()}
             className="px-3 py-1 bg-red-900/50 hover:bg-red-600 text-red-200 text-xs font-bold rounded border border-red-800 transition-colors cursor-pointer"
          >
             Menüye Dön
          </button>
        </div>
        <PlayerCard player={opponent} isMe={false} isDamaged={damagedPlayerId === opponent.id} />
      </div>

      {/* ── Zaman Çubuğu ── */}
      <div className="relative z-10">
        <TimerBar duration={10000} questionKey={questionKey} />
      </div>

      {/* ── Soru Alanı ── */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full relative z-10">
        <motion.div
          key={questionKey}
          initial={{ scale: 2.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mb-8 text-center w-full"
        >
          {currentQuestion.type === 'flag' && currentQuestion.questionData.flagUrl && (
            <img
              src={currentQuestion.questionData.flagUrl}
              alt="Guess the flag"
              className="w-full max-w-md mx-auto h-auto rounded-lg shadow-[0_0_30px_rgba(255,255,255,0.15)] border-4 border-gray-800"
            />
          )}
          {(currentQuestion.type === 'capital' || currentQuestion.type === 'math') && (
            <div className="bg-bg-card p-8 md:p-12 rounded-xl border-2 border-neon-blue/50 shadow-[0_0_30px_rgba(0,240,255,0.15)]">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">{currentQuestion.questionData.text}</h2>
            </div>
          )}
        </motion.div>

        {/* ── Şıklar ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
          {currentQuestion.options?.map((opt) => (
            <motion.button
              key={opt.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => {
                if (selectedOption !== null) return;
                setSelectedOption(opt.id);
                onAnswer(opt.id);
              }}
              disabled={selectedOption !== null}
              className={`p-4 text-lg md:text-xl font-bold rounded-xl transition-colors border-2 cursor-pointer
                ${selectedOption === opt.id
                  ? 'border-neon-blue bg-neon-blue/20 text-white shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                  : 'border-gray-700 bg-bg-card hover:bg-gray-700 hover:border-gray-500'}
                ${selectedOption !== null && selectedOption !== opt.id ? 'opacity-40 grayscale' : ''}
              `}
            >
              {opt.text}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Emoji Paneli ── */}
      <div className="fixed right-3 bottom-3 flex flex-col gap-1.5 z-20">
        {emotes.map(emote => (
          <motion.button
            key={emote}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.85 }}
            onClick={() => onSendEmote(emote)}
            className="w-11 h-11 md:w-14 md:h-14 bg-bg-card rounded-full border border-gray-700 flex items-center justify-center text-xl md:text-2xl hover:bg-gray-700 transition-colors cursor-pointer shadow-lg"
          >
            {emote}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
