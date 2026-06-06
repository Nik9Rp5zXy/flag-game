import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal, Target, BookOpen, Fingerprint } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function GuideModal({ mode, onClose }) {
  const [step, setStep] = useState(0);

  // Auto-advance some animations
  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => (s + 1) % 4);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const content = {
    flag: {
      title: "BAYRAK DÜELLOSU",
      desc: "Ülke bayraklarını en hızlı sen bil, rakibine hasar ver!",
      visual: (
        <div className="flex flex-col items-center gap-4 bg-gray-900 p-4 rounded-xl border border-neon-blue h-64 justify-center">
          <motion.div 
            animate={{ scale: step % 2 === 0 ? 1.1 : 1 }} 
            className="w-32 h-20 bg-blue-500 rounded shadow-[0_0_15px_rgba(59,130,246,0.5)] flex items-center justify-center text-white font-bold"
          >
            🇹🇷
          </motion.div>
          <div className="grid grid-cols-2 gap-2 w-full mt-4">
             {['Fransa', 'Türkiye', 'İtalya', 'Almanya'].map((opt, i) => (
                <motion.div 
                  key={i}
                  animate={{ 
                    backgroundColor: opt === 'Türkiye' && step > 1 ? '#00FF66' : '#1f2937',
                    scale: opt === 'Türkiye' && step === 2 ? 1.05 : 1
                  }}
                  className="p-2 border border-gray-700 rounded text-center text-sm font-bold text-gray-300"
                >
                  {opt}
                </motion.div>
             ))}
          </div>
        </div>
      )
    },
    coop: {
      title: "SİBER SIZMA (CO-OP)",
      desc: "İki kişilik elit hack operasyonu. Biri hedefleri bulur, diğeri komutları yazar.",
      visual: (
        <div className="flex gap-2 bg-gray-900 p-2 rounded-xl border border-neon-green h-64 overflow-hidden">
           {/* Radar / Analyst View */}
           <div className="flex-1 border border-cyan-800 rounded bg-[#001111] p-2 flex flex-col items-center justify-center relative">
              <span className="text-cyan-500 text-[10px] absolute top-1 left-1">ANALİST (RADAR)</span>
              <Target className="w-8 h-8 text-cyan-400 mb-2 opacity-50" />
              <motion.div 
                animate={{ opacity: step === 0 ? 1 : 0.5, scale: step === 0 ? 1.1 : 1 }}
                className="bg-cyan-900/50 p-2 border border-cyan-500 rounded text-[10px] text-center"
              >
                Hedef Port: 4021
              </motion.div>
              <AnimatePresence>
                {step === 1 && (
                  <motion.div 
                    initial={{ x: 0, y: 0, opacity: 1 }}
                    animate={{ x: 100, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute z-10 text-cyan-300 text-[10px] font-bold"
                  >
                    [PING GÖNDERİLDİ]
                  </motion.div>
                )}
              </AnimatePresence>
           </div>

           {/* Terminal / Breacher View */}
           <div className="flex-[1.2] border border-green-800 rounded bg-black p-2 flex flex-col font-mono relative">
              <span className="text-green-500 text-[10px] absolute top-1 left-1">SIZICI (TERMİNAL)</span>
              
              <div className="mt-6 flex flex-col gap-1 text-[10px] text-green-400">
                <AnimatePresence>
                  {step >= 1 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-cyan-300 bg-cyan-900/30 p-1 border-l-2 border-cyan-500">
                      Analist: Hedef Port: 4021
                    </motion.div>
                  )}
                  {step >= 2 && (
                    <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: '100%' }} className="text-white overflow-hidden whitespace-nowrap mt-2">
                      {'> crack -p 4021'}
                    </motion.div>
                  )}
                  {step >= 3 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-green-500 mt-1 font-bold">
                      ACCESS GRANTED!
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
           </div>
        </div>
      )
    }
  };

  const c = content[mode] || content.flag;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-bg-dark border-2 border-gray-700 rounded-2xl max-w-lg w-full relative overflow-hidden shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-white cursor-pointer z-10">
          <X className="w-6 h-6" />
        </button>

        <div className="p-6 md:p-8 flex flex-col gap-6">
          <div className="flex items-center gap-3">
             <BookOpen className="w-8 h-8 text-neon-gold" />
             <h2 className="text-2xl font-black text-white">{c.title} NASIL OYNANIR?</h2>
          </div>

          <p className="text-gray-300 text-sm leading-relaxed">
            {c.desc}
          </p>

          <div className="w-full">
            {c.visual}
          </div>

          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 text-xs text-gray-400">
            <ul className="list-disc pl-4 space-y-1">
              <li>Hızlı cevaplar (2sn altı) size hız bonusu (XP) kazandırır.</li>
              <li>Art arda 3 hızlı cevap <strong>ON FIRE</strong> modunu tetikler ve hasarınızı x2 yapar.</li>
              <li>Süre bitmeden cevap veremezseniz <strong>AFK</strong> sayılır ve kombonuz sıfırlanır.</li>
            </ul>
          </div>
          
          <button onClick={onClose} className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors">
            ANLADIM, KAPAT
          </button>
        </div>
      </motion.div>
    </div>
  );
}
