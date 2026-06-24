import { motion } from 'framer-motion';
import { X, BookOpen } from 'lucide-react';
import React from 'react';

const GAME_MODES_CONFIG = {
  flag: {
    title: "BAYRAK DÜELLOSU",
    desc: "Ülke bayraklarını en hızlı sen bil, rakibine hasar ver! Süre bitmeden doğru tahmin yapmak çok önemlidir.",
    emoji: "🇹🇷",
    theme: "text-neon-blue border-neon-blue"
  },
  capital: {
    title: "BAŞKENT DÜELLOSU",
    desc: "Ülkelerin başkentlerini doğru tahmin et, komboyu katla!",
    emoji: "🏛️",
    theme: "text-neon-purple border-neon-purple"
  },
  math: {
    title: "MATEMATİK HIZI",
    desc: "Zorlu işlemleri zihinden çöz ve rakibin canını sıfırla.",
    emoji: "🔢",
    theme: "text-neon-red border-neon-red"
  },
  coop: {
    title: "SİBER SIZMA (CO-OP)",
    desc: "İki kişilik elit hack operasyonu. Biri hedefleri bulur, diğeri komutları yazar.",
    emoji: "🛡️",
    theme: "text-neon-green border-neon-green"
  },
  blackout: {
    title: "OP: KARARTMA",
    desc: "4 kişilik devasa harita modu. Roller, sisli görüş ve siber ağlar.",
    emoji: "🤖",
    theme: "text-orange-500 border-orange-500"
  }
};

export default function GuideModal({ mode, onClose }) {
  const config = GAME_MODES_CONFIG[mode] || GAME_MODES_CONFIG.flag;

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
          <div className={`flex items-center gap-3 ${config.theme}`}>
             <BookOpen className="w-8 h-8" />
             <h2 className="text-2xl font-black">{config.title}</h2>
          </div>

          <p className="text-gray-300 text-sm leading-relaxed">
            {config.desc}
          </p>

          <div className={`text-6xl text-center py-8 border ${config.theme} bg-gray-900 rounded-xl shadow-[0_0_15px_currentColor]`}>
             {config.emoji}
          </div>

          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 text-xs text-gray-400">
            <ul className="list-disc pl-4 space-y-1">
              <li>Hızlı cevaplar (2sn altı) size hız bonusu (XP) kazandırır.</li>
              <li>Art arda 3 hızlı cevap <strong>ON FIRE</strong> modunu tetikler ve hasarınızı x2 yapar.</li>
              <li>Süre bitmeden cevap veremezseniz <strong>AFK</strong> sayılır ve kombonuz sıfırlanır.</li>
            </ul>
          </div>
          
          <button onClick={onClose} className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
            ANLADIM, KAPAT
          </button>
        </div>
      </motion.div>
    </div>
  );
}
