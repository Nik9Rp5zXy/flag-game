import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Sparkles, Volume2, Frame, ArrowLeft, Check } from 'lucide-react';
import { playSound } from '../utils/soundManager';

const CATEGORY_TABS = [
  { id: 'frame', label: 'Çerçeveler', icon: <Frame className="w-4 h-4" /> },
  { id: 'effect', label: 'Efektler', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'sound', label: 'Ses Paketleri', icon: <Volume2 className="w-4 h-4" /> },
];

export default function Shop({ profile, socketId, onClose }) {
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('frame');
  const [purchasing, setPurchasing] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/shop')
      .then(r => r.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const handlePurchase = async (itemId) => {
    setPurchasing(itemId);
    setError(null);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socketId, itemId })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        playSound('purchase');
      }
    } catch {
      setError('Bağlantı hatası');
    }
    setPurchasing(null);
  };

  const filteredItems = items.filter(i => i.category === activeTab);
  const ownedItems = profile?.ownedItems || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="bg-bg-dark border-2 border-gray-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Başlık */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-neon-blue" />
            <h2 className="text-2xl font-black">MAĞAZA</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-neon-gold font-bold text-lg">{profile?.coins || 0} 🪙</span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Kategori Tabları */}
        <div className="flex border-b border-gray-700">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold transition-all cursor-pointer
                ${activeTab === tab.id
                  ? 'text-neon-blue border-b-2 border-neon-blue bg-gray-800/50'
                  : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Ürün Listesi */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence mode="wait">
            {filteredItems.map((item, i) => {
              const owned = ownedItems.includes(item.id);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`p-4 rounded-xl border-2 flex items-center justify-between gap-4
                    ${owned ? 'border-neon-green/30 bg-green-900/10' : 'border-gray-700 bg-bg-card'}
                  `}
                >
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{item.name}</h3>
                    <p className="text-gray-400 text-sm">{item.description}</p>
                  </div>
                  {owned ? (
                    <div className="flex items-center gap-1 text-neon-green font-bold text-sm">
                      <Check className="w-4 h-4" /> Sahip
                    </div>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={purchasing === item.id}
                      onClick={() => handlePurchase(item.id)}
                      className="px-4 py-2 bg-neon-blue/20 border border-neon-blue rounded-lg font-bold text-neon-blue hover:bg-neon-blue/30 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      {purchasing === item.id ? '...' : `${item.price} 🪙`}
                    </motion.button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filteredItems.length === 0 && (
            <p className="text-center text-gray-500 py-12">Yükleniyor...</p>
          )}
        </div>

        {/* Hata Mesajı */}
        {error && (
          <div className="p-3 mx-4 mb-4 bg-red-900/30 border border-neon-red rounded-lg text-neon-red text-sm text-center">
            {error}
          </div>
        )}
      </div>
    </motion.div>
  );
}
