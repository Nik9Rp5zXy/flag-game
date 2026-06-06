import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function LevelUpOverlay({ level, onComplete }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Parçacık efektleri oluştur
    const newParticles = Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 400,
      color: ['#00FF66', '#00F0FF', '#facc15', '#a855f7', '#FF003C'][Math.floor(Math.random() * 5)],
      delay: Math.random() * 0.5,
      size: 6 + Math.random() * 10
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      >
        {/* Parçacıklar */}
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ y: 0, x: 0, scale: 1, opacity: 1 }}
            animate={{
              y: -300 - Math.random() * 200,
              x: p.x,
              scale: 0,
              opacity: 0
            }}
            transition={{ duration: 1.5, delay: p.delay, ease: 'easeOut' }}
            className="absolute"
            style={{
              width: p.size, height: p.size,
              borderRadius: '50%',
              backgroundColor: p.color,
              boxShadow: `0 0 10px ${p.color}`
            }}
          />
        ))}

        {/* Ana metin */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: [0, 1.4, 1], rotate: [20, -5, 0] }}
            transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <p className="text-2xl font-bold text-neon-green mb-2 tracking-widest">⬆ SEVİYE ATLADI ⬆</p>
            <h1 className="text-8xl md:text-[10rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-green via-neon-blue to-neon-purple drop-shadow-[0_0_40px_rgba(0,255,102,0.5)]">
              LV.{level}
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="text-gray-400 mt-6 text-lg"
          >
            Tebrikler! Yeni seviyelere ulaştın!
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
