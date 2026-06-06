import { Loader2, Globe, Building2, Calculator } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function LoadingScreen({ isMatching, onStart }) {
  const [selectedMode, setSelectedMode] = useState('flag');

  const modes = [
    { id: 'flag', title: 'Bayrak Düellosu', icon: <Globe className="w-8 h-8 mb-2" />, styleClass: 'border-neon-blue text-neon-blue', shadow: 'shadow-[0_0_20px_rgba(42,42,255,0.4)]' },
    { id: 'capital', title: 'Başkent Düellosu', icon: <Building2 className="w-8 h-8 mb-2" />, styleClass: 'border-purple-500 text-purple-500', shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]' },
    { id: 'math', title: 'Matematik Hızı', icon: <Calculator className="w-8 h-8 mb-2" />, styleClass: 'border-neon-red text-neon-red', shadow: 'shadow-[0_0_20px_rgba(255,42,42,0.4)]' },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-dark text-white p-4">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-3xl w-full"
      >
        <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter bg-gradient-to-r from-neon-red to-neon-blue text-transparent bg-clip-text drop-shadow-[0_0_15px_rgba(255,42,42,0.5)]">
          MINIGAME DUEL
        </h1>
        
        {isMatching ? (
          <div className="flex flex-col items-center gap-4 mt-12">
            <Loader2 className="w-12 h-12 text-neon-blue animate-spin" />
            <p className="text-xl text-gray-300 animate-pulse font-medium">Rakip Aranıyor...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8 items-center mt-8">
            <h2 className="text-2xl text-gray-400 font-bold">Oyun Modunu Seçin</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              {modes.map(mode => {
                const isSelected = selectedMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    className={`p-6 rounded-xl border-4 transition-all flex flex-col items-center justify-center cursor-pointer 
                      ${isSelected ? `${mode.styleClass} bg-gray-800 ${mode.shadow} scale-105` : 'border-gray-700 text-gray-500 bg-gray-900 opacity-80 hover:opacity-100 hover:scale-100 hover:border-gray-500'}
                    `}
                  >
                    <div>{mode.icon}</div>
                    <span className={`font-bold text-lg ${isSelected ? 'text-white' : ''}`}>{mode.title}</span>
                  </button>
                );
              })}
            </div>

            <button 
              onClick={() => onStart(selectedMode)}
              className="mt-8 px-12 py-4 bg-neon-blue hover:bg-blue-600 text-white font-black text-2xl rounded-lg shadow-[0_0_30px_rgba(42,42,255,0.6)] transition-all hover:scale-110 active:scale-95 cursor-pointer w-full md:w-auto"
            >
              OYNA
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
