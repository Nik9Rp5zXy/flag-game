import { motion } from 'framer-motion';
import { Trophy, Zap, Target, Flame, TrendingUp, Coins } from 'lucide-react';

export default function GameSummary({ stats, onBackToMenu }) {
  if (!stats) return null;

  const xpPercent = Math.min(100, Math.floor((stats.newXp / stats.xpToNext) * 100));

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-dark text-white p-4 relative z-10">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="w-full max-w-lg"
      >
        {/* Başlık */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`text-5xl md:text-7xl font-black mb-2 ${stats.isWinner
              ? 'text-neon-green drop-shadow-[0_0_30px_rgba(0,255,102,0.6)]'
              : 'text-neon-red drop-shadow-[0_0_30px_rgba(255,0,60,0.6)]'
              }`}
          >
            {stats.isWinner ? '🏆 ZAFER!' : '💀 YENİLGİ'}
          </motion.h1>
          {stats.winStreak > 1 && (
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: 'spring' }}
              className="text-neon-gold font-bold text-lg"
            >
              🔥 {stats.winStreak} Galibiyet Serisi!
            </motion.p>
          )}
        </div>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard icon={<Zap className="w-5 h-5 text-neon-blue" />} label="Kazanılan XP" value={`+${stats.xpGained}`} delay={0.3} />
          <StatCard icon={<Coins className="w-5 h-5 text-neon-gold" />} label="Kazanılan Coin" value={`+${stats.coinsGained}`} delay={0.4} />
          <StatCard icon={<Target className="w-5 h-5 text-neon-green" />} label="Doğru Cevap" value={stats.correctAnswers} delay={0.5} />
          <StatCard icon={<Flame className="w-5 h-5 text-orange-500" />} label="En İyi Kombo" value={`×${stats.maxCombo}`} delay={0.6} />
        </div>

        {/* XP İlerleme Çubuğu */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-bg-card rounded-xl p-4 border border-gray-700 mb-6"
        >
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-neon-blue" />
              <span className="text-sm text-gray-400">Seviye {stats.newLevel}</span>
            </div>
            <span className="text-xs text-gray-500">{stats.newXp}/{stats.xpToNext} XP</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpPercent}%` }}
              transition={{ delay: 0.9, duration: 1, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-neon-blue to-neon-purple"
              style={{ boxShadow: '0 0 10px rgba(0,240,255,0.5)' }}
            />
          </div>
        </motion.div>

        {/* Toplam Coin */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="text-center mb-6"
        >
          <span className="text-gray-400 text-sm">Toplam Coin: </span>
          <span className="text-neon-gold font-black text-xl">{stats.newCoins} 🪙</span>
        </motion.div>

        {/* Ana Menüye Dön */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBackToMenu}
          className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xl rounded-xl border-2 border-gray-600 transition-colors cursor-pointer"
        >
          ANA MENÜYE DÖN
        </motion.button>
      </motion.div>
    </div>
  );
}

function StatCard({ icon, label, value, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-bg-card rounded-xl p-4 border border-gray-700 flex flex-col items-center gap-1"
    >
      {icon}
      <span className="text-2xl font-black">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </motion.div>
  );
}
