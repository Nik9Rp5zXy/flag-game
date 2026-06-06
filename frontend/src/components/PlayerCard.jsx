import { Heart } from 'lucide-react';

export default function PlayerCard({ player, isMe, isDamaged }) {
  if (!player) return null;
  
  const hearts = [];
  for (let i = 0; i < 3; i++) {
    hearts.push(
      <Heart 
        key={i} 
        className={`w-6 h-6 md:w-8 md:h-8 ${i < player.hp ? 'fill-neon-red text-neon-red' : 'text-gray-600'} transition-all duration-300`} 
      />
    );
  }

  return (
    <div className={`p-4 rounded-xl border-2 flex flex-col items-center transition-all ${isDamaged ? 'animate-shake animate-flash-red' : ''} ${isMe ? 'border-neon-blue bg-blue-900/20' : 'border-neon-red bg-red-900/20'}`}>
      <h3 className="text-xl md:text-2xl font-bold mb-2 uppercase tracking-wider">{player.name}</h3>
      <div className="flex gap-1">
        {hearts}
      </div>
    </div>
  );
}
