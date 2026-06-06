import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, MessageSquare } from 'lucide-react';

export default function GlobalChat({ socket, profile }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    
    socket.on('global_chat_history', (history) => {
      setMessages(history);
    });

    socket.on('new_global_message', (msg) => {
      setMessages(prev => {
        const newMsgs = [...prev, msg];
        if (newMsgs.length > 50) newMsgs.shift();
        return newMsgs;
      });
      if (!isOpen) setUnread(prev => prev + 1);
    });

    return () => {
      socket.off('global_chat_history');
      socket.off('new_global_message');
    };
  }, [socket, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit('send_global_message', { text: input });
    setInput('');
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start pointer-events-none">
      
      {/* Chat Window */}
      <motion.div
        initial={false}
        animate={{ 
          height: isOpen ? 350 : 0, 
          opacity: isOpen ? 1 : 0,
          marginBottom: isOpen ? 16 : 0
        }}
        className="w-80 sm:w-96 bg-black/90 border border-neon-blue rounded-t-xl rounded-br-xl overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.2)] backdrop-blur-md flex flex-col pointer-events-auto origin-bottom-left"
      >
        <div className="bg-blue-900/40 border-b border-neon-blue p-3 flex justify-between items-center">
          <span className="font-bold text-neon-blue flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> KÜRESEL SOHBET
          </span>
          <span className="text-xs text-gray-400">{messages.length} mesaj</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-neon-blue scrollbar-track-black">
          {messages.map(msg => {
             const isMe = profile?.name && msg.sender === profile.name;
             return (
               <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                 <span className="text-[10px] text-gray-500 mb-0.5">
                   {isMe ? 'Sen' : msg.sender} <span className="text-neon-gold">[Lv.{msg.level}]</span>
                 </span>
                 <div className={`px-3 py-1.5 rounded-lg text-sm max-w-[85%] break-words ${isMe ? 'bg-neon-blue/20 border border-neon-blue/50 text-white' : 'bg-gray-800 border border-gray-700 text-gray-200'}`}>
                   {msg.text}
                 </div>
               </div>
             )
          })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-2 border-t border-neon-blue/50 bg-black flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Mesaj yaz..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
            maxLength={100}
          />
          <button type="submit" disabled={!input.trim()} className="bg-neon-blue text-black p-2 rounded hover:bg-blue-400 disabled:opacity-50 cursor-pointer transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </motion.div>

      {/* Chat Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-neon-blue rounded-full flex items-center justify-center text-black shadow-[0_0_15px_rgba(0,240,255,0.6)] cursor-pointer hover:scale-110 transition-transform pointer-events-auto relative"
      >
        <MessageSquare className="w-6 h-6" />
        {unread > 0 && !isOpen && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-black animate-bounce">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

    </div>
  );
}
