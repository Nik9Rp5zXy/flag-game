import { Loader2, Globe, Building2, Calculator, ShoppingBag, TrendingUp, Coins, LogOut, ShieldAlert, Info, Users, Map } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import GlobalChat from './GlobalChat';
import GuideModal from './GuideModal';

export default function LoadingScreen({ socket, poolCounts, isMatching, onStart, profile, onOpenShop, onLogout, onOpenAuth }) {
  const [selectedMode, setSelectedMode] = useState('flag');
  const [activeGuide, setActiveGuide] = useState(null);

  const modes = [
    { id: 'flag', title: 'Bayrak Düellosu', icon: <Globe className="w-8 h-8" />, color: 'neon-blue', border: 'border-neon-blue', text: 'text-neon-blue', shadow: 'shadow-[0_0_20px_rgba(0,240,255,0.4)]' },
    { id: 'capital', title: 'Başkent Düellosu', icon: <Building2 className="w-8 h-8" />, color: 'neon-purple', border: 'border-neon-purple', text: 'text-neon-purple', shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]' },
    { id: 'math', title: 'Matematik Hızı', icon: <Calculator className="w-8 h-8" />, color: 'neon-red', border: 'border-neon-red', text: 'text-neon-red', shadow: 'shadow-[0_0_20px_rgba(255,0,60,0.4)]' },
    { id: 'coop', title: 'Siber Sızma (Co-Op)', icon: <ShieldAlert className="w-8 h-8" />, color: 'neon-green', border: 'border-neon-green', text: 'text-neon-green', shadow: 'shadow-[0_0_20px_rgba(0,255,102,0.4)]' },
    { id: 'blackout', title: 'Op: Karartma (2-4P)', icon: <Map className="w-8 h-8" />, color: 'orange-500', border: 'border-orange-500', text: 'text-orange-500', shadow: 'shadow-[0_0_20px_rgba(249,115,22,0.4)]' },
  ];

  const xpToNext = (profile?.level || 1) * 100;
  const xpPercent = Math.min(100, Math.floor(((profile?.xp || 0) / xpToNext) * 100));
  const isAuthenticated = profile?.isAuthenticated;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-dark text-white p-4 relative z-10">
      
      {/* Küresel Sohbet (Sol Alt) */}
      <GlobalChat socket={socket} profile={profile} />

      {/* Rehber Modalı */}
      <AnimatePresence>
        {activeGuide && <GuideModal mode={activeGuide} onClose={() => setActiveGuide(null)} />}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-5xl w-full"
      >
        {/* Profil Bar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col md:flex-row items-center justify-between bg-bg-card rounded-xl p-3 mb-8 border border-gray-700 gap-4"
        >
          <div className="flex items-center gap-3 w-full md:w-auto">
            {isAuthenticated ? (
              <div className="bg-neon-green/20 text-neon-green px-3 py-1.5 rounded-lg font-bold text-sm border border-neon-green flex items-center gap-2">
                {profile?.name}
              </div>
            ) : (
              <button onClick={onOpenAuth} className="bg-neon-blue hover:bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm cursor-pointer shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                Giriş Yap / Kayıt Ol
              </button>
            )}
            <div className="bg-gray-800 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-neon-blue" />
              <span className="font-black text-sm">LV.{profile?.level || 1}</span>
            </div>
            <div className="hidden md:block w-32">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon-blue to-neon-purple transition-all duration-500"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500">{profile?.xp || 0}/{xpToNext} XP</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-3 py-1.5">
              <Coins className="w-4 h-4 text-neon-gold" />
              <span className="font-bold text-neon-gold text-sm">{profile?.coins || 0}</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onOpenShop}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 cursor-pointer relative"
              title="Elit Mağaza"
            >
              <ShoppingBag className="w-5 h-5 text-neon-blue" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-blue opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-neon-blue"></span>
              </span>
            </motion.button>
            {isAuthenticated && (
              <motion.button
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onLogout}
                className="p-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 border border-red-800 cursor-pointer text-red-500"
                title="Çıkış Yap"
              >
                <LogOut className="w-5 h-5" />
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Logo */}
        <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter bg-gradient-to-r from-neon-red via-neon-purple to-neon-blue text-transparent bg-clip-text drop-shadow-[0_0_15px_rgba(255,0,60,0.5)]">
          ELITE DUEL
        </h1>

        {isMatching ? (
          <div className="flex flex-col items-center gap-4 mt-12">
            <Loader2 className="w-12 h-12 text-neon-blue animate-spin" />
            <p className="text-xl text-gray-300 animate-pulse font-medium">Rakip Aranıyor... (Mod: {selectedMode})</p>
            <button onClick={() => window.location.reload()} className="mt-4 text-sm text-gray-500 hover:text-white underline">
               İptal Et
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-8 items-center mt-8">
            <h2 className="text-2xl text-gray-400 font-bold">Oyun Modunu Seçin</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              {modes.map(mode => {
                const isSelected = selectedMode === mode.id;
                const searchingCount = poolCounts ? poolCounts[mode.id] : 0;
                return (
                  <div key={mode.id} className="relative group">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedMode(mode.id)}
                      className={`w-full p-6 pb-8 rounded-xl border-4 transition-all flex flex-col items-center justify-center cursor-pointer gap-2
                        ${isSelected
                          ? `${mode.border} ${mode.text} bg-gray-800 ${mode.shadow} scale-105 z-10 relative`
                          : 'border-gray-700 text-gray-500 bg-gray-900 opacity-80 hover:opacity-100 hover:border-gray-500'}
                      `}
                    >
                      <div>{mode.icon}</div>
                      <span className={`font-bold text-lg ${isSelected ? 'text-white' : ''}`}>{mode.title}</span>
                      
                      {/* Eşleşme arayan kişi sayısı */}
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center items-center gap-1 text-[10px] text-gray-400">
                         <Users className={`w-3 h-3 ${searchingCount > 0 ? 'text-green-500 animate-pulse' : ''}`} />
                         {searchingCount > 0 ? (
                            <span className="text-green-400 font-bold">{searchingCount} kişi arıyor</span>
                         ) : (
                            <span>Boşta</span>
                         )}
                      </div>
                    </motion.button>
                    
                    {/* Rehber Butonu */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveGuide(mode.id); }}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-white hover:text-black text-gray-400 rounded-full transition-colors cursor-pointer z-20 border border-gray-600"
                      title="Nasıl Oynanır?"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onStart(selectedMode)}
              className="mt-8 px-12 py-4 bg-gradient-to-r from-neon-blue to-neon-purple text-white font-black text-2xl rounded-xl shadow-[0_0_30px_rgba(0,240,255,0.4)] transition-all cursor-pointer w-full md:w-auto"
            >
              DÜELLOYA BAŞLA
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
