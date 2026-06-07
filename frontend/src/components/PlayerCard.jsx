import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Shield, Flame } from 'lucide-react';

export default function PlayerCard({ player, isMe, isDamaged }) {
  if (!player) return null;

  const equipped = player.equippedItems || {};

  // -- FRAME STYLES --
  let frameClass = "border-gray-700 bg-gray-900"; // default
  let frameGlow = "";
  if (equipped.frame === 'frame_gold') {
    frameClass = "border-yellow-400 bg-gray-900";
    frameGlow = "shadow-[0_0_15px_rgba(250,204,21,0.5)]";
  } else if (equipped.frame === 'frame_diamond') {
    frameClass = "border-cyan-400 bg-cyan-950";
    frameGlow = "shadow-[0_0_20px_rgba(34,211,238,0.7)]";
  } else if (equipped.frame === 'frame_fire') {
    frameClass = "border-orange-500 bg-orange-950";
    frameGlow = "shadow-[0_0_25px_rgba(249,115,22,0.8)]";
  } else if (equipped.frame === 'frame_mythic_neon') {
    frameClass = "border-neon-green bg-black";
    frameGlow = "shadow-[0_0_30px_rgba(0,255,102,0.9)] animate-pulse";
  } else if (equipped.frame === 'frame_celestial') {
    frameClass = "border-purple-500 bg-[#1a0033]";
    frameGlow = "shadow-[0_0_40px_rgba(168,85,247,1)] border-b-8 border-t-8 border-l-2 border-r-2 animate-bounce"; // extreme
  }

  // -- TITLE STYLES --
  let titleNode = null;
  if (equipped.title === 'title_rookie') titleNode = <span className="text-[10px] text-gray-500 font-bold block -mt-1 mb-1">Acemi</span>;
  else if (equipped.title === 'title_veteran') titleNode = <span className="text-[10px] text-blue-400 font-bold block -mt-1 mb-1">Gazi</span>;
  else if (equipped.title === 'title_cyber_demon') titleNode = <span className="text-[10px] text-red-500 font-black block -mt-1 mb-1 uppercase tracking-widest animate-pulse">Siber İblis</span>;
  else if (equipped.title === 'title_omniscient') titleNode = <span className="text-[10px] text-yellow-300 font-black block -mt-1 mb-1 uppercase tracking-[0.2em] shadow-[0_0_5px_rgba(253,224,71,0.8)] drop-shadow-md">Her Şeyi Bilen</span>;

  // -- EFFECT OVERLAYS --
  let effectNode = null;
  if (equipped.effect === 'effect_sparkle') effectNode = <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-200/20 to-transparent mix-blend-screen pointer-events-none animate-pulse"></div>;
  if (equipped.effect === 'effect_lightning') effectNode = <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-400/30 to-transparent mix-blend-screen pointer-events-none animate-bounce"></div>;
  if (equipped.effect === 'effect_void_aura') effectNode = <div className="absolute inset-0 bg-black/40 border border-purple-900/50 mix-blend-overlay pointer-events-none animate-ping"></div>;
  if (equipped.effect === 'effect_dragon_breath') effectNode = <div className="absolute inset-0 bg-gradient-to-t from-orange-600/40 to-transparent mix-blend-screen pointer-events-none animate-pulse"></div>;

  return (
    <motion.div
      animate={{
        x: isDamaged ? [-10, 10, -10, 10, 0] : 0,
        scale: player.isOnFire ? [1, 1.05, 1] : 1
      }}
      transition={{ duration: 0.3 }}
      className={`relative w-28 sm:w-32 md:w-48 p-2 md:p-3 rounded-xl md:rounded-2xl flex flex-col items-center justify-center border-2 md:border-4 ${frameClass} ${frameGlow} transition-all duration-300 overflow-hidden`}
    >
      {/* Background visual effects */}
      {effectNode}

      {/* On Fire Background Overlay */}
      <AnimatePresence>
        {player.isOnFire && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-t from-red-600/40 via-orange-500/20 to-transparent pointer-events-none"
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center z-10 w-full">
        {/* Title */}
        {titleNode}
        
        {/* Name & Role */}
        <div className={`font-black text-sm md:text-lg mb-2 text-center break-all flex items-center justify-center gap-1 ${isMe ? 'text-neon-blue' : 'text-neon-red'}`}>
          {isMe && <Shield className="w-4 h-4 text-neon-blue" />}
          {player.name}
        </div>
        
        {/* Level */}
        <div className="bg-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-bold mb-3 border border-gray-600">
          LV.{player.level}
        </div>
        
        {/* HP */}
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ 
                scale: i < player.hp ? 1 : 0.8,
                opacity: i < player.hp ? 1 : 0.2
              }}
            >
              <Heart 
                className={`w-6 h-6 ${
                  i < player.hp 
                    ? (isMe ? 'text-neon-blue fill-neon-blue' : 'text-neon-red fill-neon-red') 
                    : 'text-gray-600'
                }`} 
              />
            </motion.div>
          ))}
        </div>

        {/* Combo */}
        <AnimatePresence>
          {player.combo > 1 && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className={`absolute -top-3 -right-3 px-2 py-1 rounded-full text-xs font-black shadow-lg flex items-center gap-1 ${player.isOnFire ? 'bg-orange-500 text-white shadow-orange-500/50' : 'bg-gray-700 text-white border border-gray-500'}`}
            >
              {player.isOnFire && <Flame className="w-3 h-3 animate-bounce" />}
              {player.combo}x
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
