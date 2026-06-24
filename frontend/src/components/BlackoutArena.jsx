import React, { useEffect, useState } from 'react';
import MapEngine from './MapEngine';

export default function BlackoutArena({ socket, roomId, players: initialPlayers, myId, map }) {
  const [players, setPlayers] = useState(() => {
     if (Array.isArray(initialPlayers)) {
         const obj = {};
         initialPlayers.forEach(p => obj[p.id] = p);
         return obj;
     }
     return initialPlayers || {};
  });

  useEffect(() => {
    socket.on('blackout_sync', (syncedPlayers) => {
      // In server.js activeGames.players is an object, but lobby.players is an array.
      // Let's normalize to object if it's an array.
      if (Array.isArray(syncedPlayers)) {
         const obj = {};
         syncedPlayers.forEach(p => obj[p.id] = p);
         setPlayers(obj);
      } else {
         setPlayers(syncedPlayers);
      }
    });
  }, [socket]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-mono">
      <div className="w-full max-w-4xl flex justify-between mb-2 text-primary font-bold">
         <span>OP: KARARTMA</span>
         <span>ROL: {players[myId]?.role || 'BEKLENİYOR'}</span>
      </div>
      
      {map ? (
         <MapEngine 
            mapData={map} 
            players={players} 
            myId={myId} 
            onMove={(x, y) => socket.emit('blackout_move', { roomId, x, y })} 
         />
      ) : (
         <div className="animate-pulse text-green-500">Ağ Taraması Yapılıyor... (Harita Bekleniyor)</div>
      )}
      
      <div className="mt-4 text-xs text-gray-500">
        WASD ile hareket et. WebRTC sesli iletişim devrede.
      </div>
    </div>
  );
}
