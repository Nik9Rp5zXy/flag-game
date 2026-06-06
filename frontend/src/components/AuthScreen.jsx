import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, ArrowRight, X } from 'lucide-react';

export default function AuthScreen({ onLoginSuccess, onGuestPlay, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/login' : '/api/register';
    // Use relative path for prod, localhost for dev
    const baseUrl = import.meta.env.PROD ? '' : 'http://localhost:5000';
    
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Bir hata oluştu');
      } else {
        onLoginSuccess(data);
      }
    } catch (err) {
      setError('Sunucuya bağlanılamadı');
    }
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-bg-dark border-2 border-neon-blue rounded-2xl w-full max-w-md overflow-hidden relative shadow-[0_0_30px_rgba(0,240,255,0.2)]"
      >
        {onClose && (
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white cursor-pointer z-10">
            <X className="w-6 h-6" />
          </button>
        )}

        <div className="flex border-b border-gray-700">
          <button 
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-4 font-black transition-colors cursor-pointer ${isLogin ? 'text-neon-blue border-b-2 border-neon-blue bg-blue-900/10' : 'text-gray-500 hover:text-gray-300'}`}
          >
            GİRİŞ YAP
          </button>
          <button 
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-4 font-black transition-colors cursor-pointer ${!isLogin ? 'text-neon-green border-b-2 border-neon-green bg-green-900/10' : 'text-gray-500 hover:text-gray-300'}`}
          >
            KAYIT OL
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Kullanıcı Adı</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input 
                type="text" 
                value={username} onChange={e => setUsername(e.target.value)} required
                className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
                placeholder="Oyuncu_123"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Şifre</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input 
                type="password" 
                value={password} onChange={e => setPassword(e.target.value)} required minLength={4}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-neon-red text-sm font-bold text-center">
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit" disabled={loading}
            className={`mt-4 w-full py-4 rounded-xl font-black text-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${isLogin ? 'bg-neon-blue hover:bg-blue-600 text-white shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'bg-neon-green hover:bg-green-600 text-black shadow-[0_0_15px_rgba(0,255,102,0.4)]'} disabled:opacity-50`}
          >
            {loading ? 'BEKLEYİN...' : (isLogin ? 'GİRİŞ YAP' : 'HESAP OLUŞTUR')}
            {!loading && <ArrowRight className="w-6 h-6" />}
          </button>

          {onGuestPlay && (
            <button 
              type="button" onClick={onGuestPlay}
              className="mt-2 text-sm text-gray-400 hover:text-white underline cursor-pointer"
            >
              Veya hesapsız, misafir olarak oyna
            </button>
          )}
        </form>
      </motion.div>
    </motion.div>
  );
}
