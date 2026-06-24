import React, { useState, useEffect } from 'react';
import { Users, ShieldAlert, Cpu, Wrench, Eye, Share2, Play } from 'lucide-react';

export default function BlackoutLobby({ socket, roomId, players, myId, onLeave }) {
  const [selectedRole, setSelectedRole] = useState(null);
  
  const roles = [
    { id: 'ghost', name: 'Hayalet (The Ghost)', icon: <Eye />, color: 'text-gray-300', desc: 'Haritada gezen sızmacı. Hedefleri göremez, yönlendirilmesi gerekir.' },
    { id: 'oracle', name: 'Kahin (The Oracle)', icon: <Users />, color: 'text-cyan-400', desc: 'Tüm haritayı görür. Hayaleti sesli yönlendirir.' },
    { id: 'engineer', name: 'Mühendis (The Engineer)', icon: <Wrench />, color: 'text-orange-400', desc: 'Kapıları ve lazerleri kontrol eder.' },
    { id: 'decrypter', name: 'Kriptograf (The Decrypter)', icon: <Cpu />, color: 'text-purple-400', desc: 'Hayaletin karşısına çıkan şifreleri çözer.' }
  ];

  const handleSelectRole = (roleId) => {
    setSelectedRole(roleId);
    socket.emit('blackout_select_role', { roomId, role: roleId });
  };

  const handleToggleReady = () => {
    socket.emit('blackout_toggle_ready', { roomId });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-dark text-white p-4">
      <div className="max-w-4xl w-full bg-gray-900 border border-orange-500/50 rounded p-6 shadow-[0_0_30px_rgba(249,115,22,0.2)]">
        
        <header className="flex justify-between items-center border-b border-orange-500/30 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-orange-500 flex items-center gap-2">
              <ShieldAlert /> OP: KARARTMA - LOBİ
            </h1>
            <p className="text-sm text-gray-400 mt-1">Oda Kodu: <span className="font-mono bg-black px-2 py-1 rounded text-orange-300 select-all">{roomId}</span></p>
          </div>
          <div className="flex gap-3">
             <button onClick={() => navigator.clipboard.writeText(roomId)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm flex gap-2 items-center cursor-pointer">
                <Share2 className="w-4 h-4"/> Kodu Kopyala
             </button>
             <button onClick={onLeave} className="px-3 py-2 bg-red-900/50 hover:bg-red-600 rounded text-sm cursor-pointer border border-red-800 transition-colors">
               Ayrıl
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* Sol Taraf: Oyuncular */}
           <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-300">Ekip Üyeleri ({players?.length || 0}/4)</h2>
              <div className="space-y-2">
                 {(players || []).map(p => (
                   <div key={p.id} className="bg-black p-3 rounded flex justify-between items-center border border-gray-800">
                      <div>
                        <div className="font-bold">{p.name} {p.id === myId && '(Sen)'}</div>
                        <div className={`text-xs ${p.role ? 'text-green-400' : 'text-gray-500'}`}>{p.role ? roles.find(r=>r.id===p.role)?.name : 'Rol Seçmedi'}</div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-bold ${p.isReady ? 'bg-green-600' : 'bg-gray-700'}`}>
                         {p.isReady ? 'HAZIR' : 'BEKLİYOR'}
                      </div>
                   </div>
                 ))}
                 {(players?.length || 0) < 2 && (
                    <div className="text-sm text-orange-400 animate-pulse mt-4">Oyunu başlatmak için en az 2 kişi gerekiyor... Arkadaşlarını davet et!</div>
                 )}
              </div>
           </div>

           {/* Sağ Taraf: Rol Seçimi */}
           <div>
              <h2 className="text-lg font-bold text-gray-300 mb-4">Rolünü Seç</h2>
              <div className="grid grid-cols-1 gap-2">
                 {roles.map(r => {
                    const isTaken = (players || []).some(p => p.role === r.id && p.id !== myId);
                    return (
                      <button 
                         key={r.id}
                         disabled={isTaken}
                         onClick={() => handleSelectRole(r.id)}
                         className={`p-3 rounded border text-left flex gap-3 items-center transition-colors cursor-pointer ${
                            selectedRole === r.id ? 'bg-orange-900/40 border-orange-500' : 
                            isTaken ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed' : 'bg-black border-gray-700 hover:border-gray-500'
                         }`}
                      >
                         <div className={r.color}>{r.icon}</div>
                         <div>
                           <div className="font-bold">{r.name}</div>
                           <div className="text-xs text-gray-400">{r.desc}</div>
                         </div>
                      </button>
                    )
                 })}
              </div>

              <div className="mt-6 flex justify-end">
                 <button 
                    onClick={handleToggleReady}
                    disabled={!selectedRole}
                    className={`px-8 py-3 font-bold rounded flex gap-2 items-center cursor-pointer transition-all ${!selectedRole ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 shadow-[0_0_15px_rgba(22,163,74,0.5)]'}`}
                 >
                    <Play className="w-5 h-5"/> HAZIRIM
                 </button>
              </div>
           </div>
        </div>

      </div>
    </div>
  )
}
