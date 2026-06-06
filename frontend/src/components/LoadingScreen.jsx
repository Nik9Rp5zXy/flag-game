import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoadingScreen({ isMatching, onStart }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-dark text-white p-4">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter bg-gradient-to-r from-neon-red to-neon-blue text-transparent bg-clip-text drop-shadow-[0_0_15px_rgba(255,42,42,0.5)]">
          FLAG DUEL
        </h1>
        
        {isMatching ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-neon-blue animate-spin" />
            <p className="text-xl text-gray-300 animate-pulse font-medium">Rakip Aranıyor...</p>
          </div>
        ) : (
          <button 
            onClick={onStart}
            className="px-8 py-4 bg-neon-blue hover:bg-blue-600 text-white font-bold text-xl rounded-lg shadow-[0_0_20px_rgba(42,42,255,0.6)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            EŞLEŞME BUL
          </button>
        )}
      </motion.div>
    </div>
  );
}
