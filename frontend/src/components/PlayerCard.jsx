import { Heart, Flame } from 'lucide-react';

export default function PlayerCard({ player, isMe, isDamaged }) {
  if (!player) return null;

  const hearts = [];
  for (let i = 0; i < 3; i++) {
    hearts.push(
      <Heart
        key={i}
        className={`w-5 h-5 md:w-7 md:h-7 transition-all duration-300 ${i < player.hp ? 'fill-neon-red text-neon-red' : 'text-gray-700'}`}
      />
    );
  }

  return (
    <div
      className={`p-3 md:p-4 rounded-xl border-2 flex flex-col items-center transition-all min-w-[120px]
        ${isDamaged ? 'animate-shake animate-flash-red' : ''}
        ${player.isOnFire ? 'animate-fire-glow' : ''}
        ${isMe ? 'border-neon-blue bg-blue-900/20' : 'border-neon-red bg-red-900/20'}
      `}
    >
      {/* Seviye Rozeti */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
          LV.{player.level || 1}
        </span>
        {player.isOnFire && (
          <span className="flex items-center gap-0.5 text-orange-400 animate-glow-pulse">
            <Flame className="w-4 h-4 fill-orange-500" />
            <span className="text-xs font-black">ON FIRE</span>
          </span>
        )}
      </div>

      {/* İsim */}
      <h3 className="text-sm md:text-lg font-bold uppercase tracking-wider truncate max-w-[100px] md:max-w-[150px]">
        {player.name}
      </h3>

      {/* Canlar */}
      <div className="flex gap-0.5 mt-1">
        {hearts}
      </div>

      {/* Kombo */}
      {player.combo > 0 && (
        <div className="mt-1 text-xs font-bold text-neon-gold">
          🔥 ×{player.combo}
        </div>
      )}
    </div>
  );
}
