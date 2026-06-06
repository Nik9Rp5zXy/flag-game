import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, ShieldAlert, Cpu, Activity, Fingerprint } from 'lucide-react';
import PlayerCard from './PlayerCard';

export default function CoopArena({ players, myId, currentPhase, currentHint, commandHint, onCommandSubmit, onPing, afkWarning, opponentDisconnected }) {
  const me = players.find(p => p.id === myId);
  const opponent = players.find(p => p.id !== myId);
  
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState([{ type: 'system', text: 'SYSTEM.INIT // BAĞLANTI KURULDU' }]);
  const [showPing, setShowPing] = useState(false);
  const [pingMessage, setPingMessage] = useState('');
  const inputRef = useRef(null);

  // Focus terminal automatically
  useEffect(() => {
    if (me?.role === 'breacher' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [me?.role]);

  // Phase transition logs
  useEffect(() => {
    if (currentPhase) {
      setTerminalLogs(prev => [...prev, { type: 'system', text: `>> FAZ ${currentPhase} BAŞLADI. HEDEF VERİSİ BEKLENİYOR...` }]);
      setTerminalInput('');
    }
  }, [currentPhase]);

  // Command submit handler
  const handleCommand = (e) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;
    
    setTerminalLogs(prev => [...prev, { type: 'input', text: `> ${terminalInput}` }]);
    onCommandSubmit(terminalInput);
    setTerminalInput('');
  };

  if (!me || !opponent) return null;

  const isBreacher = me.role === 'breacher';

  return (
    <div className="flex flex-col min-h-screen bg-[#050505] text-[#00FF66] font-mono p-4 relative overflow-hidden">
      
      {/* ── AFK / Disconnect Warnings ── */}
      <AnimatePresence>
        {afkWarning && (
           <motion.div initial={{ y: -50 }} animate={{ y: 0 }} exit={{ y: -50 }} className="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white text-center py-2 font-bold">
             DİKKAT: BAĞLANTI KOPMAK ÜZERE (AFK)
           </motion.div>
        )}
        {opponentDisconnected && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center text-red-500 border-4 border-red-900 m-8">
             <ShieldAlert className="w-24 h-24 mb-4 animate-pulse" />
             <h2 className="text-4xl font-black mb-2">PARTNER BAĞLANTISI KOPTU</h2>
             <p className="text-xl">Güvenli çıkış için bekleniyor...</p>
           </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="flex justify-between items-center border-b border-green-900 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <Fingerprint className="w-8 h-8 text-green-500" />
          <div>
            <h1 className="text-2xl font-black tracking-widest text-white">OP: SİBER SIZMA</h1>
            <p className="text-sm text-green-700">ROL: {isBreacher ? 'BREACHER (TERMINAL)' : 'ANALYST (RADAR)'}</p>
          </div>
        </div>
        <div className="flex gap-4">
           <PlayerCard player={me} isMe={true} isDamaged={false} />
           <PlayerCard player={opponent} isMe={false} isDamaged={false} />
        </div>
      </header>

      {/* ── Main Content Asymmetrical ── */}
      <div className="flex-1 flex gap-4">
        
        {isBreacher ? (
          /* ==================================================
             BREACHER VIEW (TERMINAL)
             ================================================== */
          <div className="flex-1 flex flex-col border border-green-800 bg-black rounded-sm relative">
            <div className="bg-green-900/30 border-b border-green-800 p-2 text-xs flex items-center gap-2">
              <Terminal className="w-4 h-4" /> root@breacher-sys ~
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-2">
              {terminalLogs.map((log, i) => (
                <div key={i} className={`${log.type === 'input' ? 'text-white' : log.type === 'error' ? 'text-red-500' : 'text-green-500'} opacity-90`}>
                  {log.text}
                </div>
              ))}
              
              {/* Fake Ping Visual */}
              <AnimatePresence>
                {showPing && (
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="bg-green-500/20 text-white p-2 border-l-4 border-green-500 my-2 inline-block">
                    [INCOMING TRANSMISSION] Analist: {pingMessage}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <form onSubmit={handleCommand} className="p-4 border-t border-green-800 flex items-center gap-2">
              <span className="text-white font-bold">$</span>
              <input 
                ref={inputRef}
                type="text" 
                value={terminalInput}
                onChange={e => setTerminalInput(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-green-400 font-mono text-lg placeholder-green-900"
                placeholder={commandHint || "Komut girin..."}
                autoComplete="off"
                spellCheck="false"
              />
            </form>
          </div>
        ) : (
          /* ==================================================
             ANALYST VIEW (RADAR / INTEL)
             ================================================== */
          <div className="flex-1 flex gap-4">
             {/* Radar Screen */}
             <div className="flex-[2] border border-cyan-800 bg-[#001111] rounded-sm flex flex-col relative overflow-hidden">
                <div className="bg-cyan-900/30 border-b border-cyan-800 p-2 text-xs text-cyan-500 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> NETWORK_MAP
                </div>
                
                <div className="flex-1 flex items-center justify-center relative">
                   {/* Fake Radar Sweep */}
                   <motion.div 
                     animate={{ rotate: 360 }} 
                     transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                     className="absolute w-[400px] h-[400px] rounded-full border border-cyan-900/50"
                     style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(0, 255, 255, 0.1) 20%, transparent 20%)' }}
                   />
                   
                   {/* Target Node */}
                   <motion.div 
                     initial={{ scale: 0 }} animate={{ scale: 1 }}
                     className="z-10 bg-cyan-900/40 border border-cyan-400 p-6 rounded-lg text-center cursor-pointer hover:bg-cyan-800/60 transition-colors"
                     onClick={() => {
                        onPing(`HEDEF BULUNDU: ${currentHint}`);
                     }}
                   >
                     <Cpu className="w-12 h-12 text-cyan-400 mx-auto mb-2" />
                     <div className="text-white font-bold">NODE_{currentPhase}</div>
                     <div className="text-cyan-300 text-sm mt-2">{currentHint}</div>
                     <div className="text-xs text-cyan-600 mt-4">(Breacher'a göndermek için tıkla)</div>
                   </motion.div>
                </div>
             </div>

             {/* Tools / Actions */}
             <div className="flex-1 border border-cyan-800 bg-[#001111] flex flex-col">
                <div className="bg-cyan-900/30 border-b border-cyan-800 p-2 text-xs text-cyan-500">
                  ACTION_PANEL
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <p className="text-sm text-cyan-400 mb-4">Görev: Breacher'a doğru parametreleri iletin.</p>
                  <button onClick={() => onPing('DİKKAT: Güvenlik duvarı aktif!')} className="p-3 border border-red-500 text-red-500 hover:bg-red-900/30 cursor-pointer text-left text-sm">
                     [PING] Tehlike Uyarısı
                  </button>
                  <button onClick={() => onPing(currentHint)} className="p-3 border border-cyan-500 text-cyan-400 hover:bg-cyan-900/30 cursor-pointer text-left text-sm font-bold">
                     [PING] Hedef Verisi Gönder
                  </button>
                </div>
             </div>
          </div>
        )}
      </div>

    </div>
  );
}
