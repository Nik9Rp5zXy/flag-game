import React from 'react';

export default function BlackoutArena({ socket, roomId, players, myId }) {
  const me = players.find(p => p.id === myId);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-black text-orange-500 mb-4">OP: KARARTMA</h1>
      <p className="text-gray-400">Harita yükleniyor... Rolünüz: {me?.role}</p>
      
      {/* 
        Aşama 2'de buraya MapEngine.jsx ve rol bazlı arayüzler (Radar, Terminal vs.) eklenecek.
      */}
    </div>
  );
}
