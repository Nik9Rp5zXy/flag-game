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
  const [mapState, setMapState] = useState({ doors: [], terminals: [] });

  useEffect(() => {
    socket.on('blackout_sync', (data) => {
      let syncedPlayers = data;
      if (data.players) {
         syncedPlayers = data.players;
         setMapState(data.mapState);
      }
      
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
      
      <div className="flex w-full max-w-5xl gap-4">
         {map ? (
            <div className="flex-1">
               <MapEngine 
                  mapData={map} 
                  mapState={mapState}
                  players={players} 
                  myId={myId} 
                  onMove={(x, y) => socket.emit('blackout_move', { roomId, x, y })} 
               />
            </div>
         ) : (
            <div className="flex-1 animate-pulse text-green-500 flex items-center justify-center border border-green-500/30">
               Ağ Taraması Yapılıyor... (Harita Bekleniyor)
            </div>
         )}

         {/* ROLE PANELS */}
         <div className="w-64 bg-gray-900 border border-gray-700 rounded p-4 flex flex-col gap-4 overflow-y-auto">
            <h3 className="text-orange-500 font-bold border-b border-orange-500/30 pb-2">KONTROL PANELİ</h3>
            
            {players[myId]?.role === 'engineer' && (
               <div className="space-y-3">
                  <p className="text-xs text-gray-400">Şebeke Kontrolü: Kapıları aç/kapat.</p>
                  {(mapState?.doors || []).map(d => (
                     <button 
                        key={d.id}
                        onClick={() => socket.emit('blackout_interact', { roomId, action: 'toggle_door', targetId: d.id })}
                        className={`w-full py-2 rounded font-bold text-sm transition-colors ${d.isOpen ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
                     >
                        {d.id.toUpperCase()} - {d.isOpen ? 'AÇIK (Kapat)' : 'KAPALI (Aç)'}
                     </button>
                  ))}
               </div>
            )}

            {players[myId]?.role === 'decrypter' && (
               <div className="space-y-3">
                  <p className="text-xs text-gray-400">Siber Ağ: Terminalleri hackle.</p>
                  {(mapState?.terminals || []).map(t => (
                     <button 
                        key={t.id}
                        disabled={t.isHacked}
                        onClick={() => socket.emit('blackout_interact', { roomId, action: 'hack_terminal', targetId: t.id })}
                        className={`w-full py-2 rounded font-bold text-sm transition-colors ${t.isHacked ? 'bg-blue-600 opacity-50 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500'}`}
                     >
                        {t.id.toUpperCase()} - {t.isHacked ? 'HACKLENDİ' : 'HACKLE'}
                     </button>
                  ))}
               </div>
            )}

            {['ghost', 'oracle'].includes(players[myId]?.role) && (
               <p className="text-sm text-gray-500 italic">Sistem erişimi yok. Sadece hareket ve görüş yetkisi.</p>
            )}
         </div>
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        WASD ile hareket et. WebRTC sesli iletişim devrede.
      </div>
    </div>
  );
}
