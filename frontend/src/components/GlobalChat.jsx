import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageSquare, ChevronRight, Crown, ShieldAlert, Trash2, Reply, Smile } from 'lucide-react';

export default function GlobalChat({ socket, profile }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [replyTo, setReplyTo] = useState(null);
  const [activeReactionMsg, setActiveReactionMsg] = useState(null); // which message is open for reactions
  const [activeMsgId, setActiveMsgId] = useState(null); // which message is clicked on mobile
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const EMOJIS = ['👍', '❤️', '😂', '🔥', '💀', '🎉'];

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

    socket.on('global_message_deleted', (msgId) => {
      setMessages(prev => prev.filter(m => m.id !== msgId));
    });

    socket.on('global_message_reacted', ({ msgId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m));
    });

    socket.on('chat_error', (err) => {
      alert(err.message);
    });

    socket.on('role_updated', ({ username, role }) => {
      setMessages(prev => prev.map(m => m.sender === username ? { ...m, role } : m));
    });

    socket.on('typing_update', (users) => {
      setTypingUsers(users.filter(u => u !== profile?.name));
    });

    return () => {
      socket.off('global_chat_history');
      socket.off('new_global_message');
      socket.off('global_message_deleted');
      socket.off('global_message_reacted');
      socket.off('chat_error');
      socket.off('role_updated');
      socket.off('typing_update');
    };
  }, [socket, isOpen, profile?.name]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, typingUsers]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!socket) return;
    
    socket.emit('typing', true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', false);
    }, 2000);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    if (!profile?.isAuthenticated) {
      alert("Sohbet etmek için giriş yapmalısınız.");
      return;
    }
    socket.emit('send_global_message', { text: input, replyTo: replyTo ? replyTo.id : null });
    setInput('');
    setReplyTo(null);
    socket.emit('typing', false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleDelete = (msgId) => {
    if (window.confirm("Mesajı silmek istediğinize emin misiniz?")) {
      socket.emit('delete_global_message', msgId);
    }
  };

  const handleReact = (msgId, emoji) => {
    socket.emit('react_global_message', { msgId, emoji });
    setActiveReactionMsg(null);
  };

  // Role Styles Mapping
  const getRoleStyle = (role) => {
    if (role === 'owner') return {
       border: 'border-yellow-500', bg: 'bg-yellow-900/40', text: 'text-yellow-400',
       glow: 'shadow-[0_0_15px_rgba(234,179,8,0.5)]',
       icon: <Crown className="w-4 h-4 text-yellow-400" />,
       badge: 'KURUCU 👑'
    };
    if (role === 'admin') return {
       border: 'border-blue-400', bg: 'bg-blue-900/40', text: 'text-blue-300',
       glow: 'shadow-[0_0_10px_rgba(96,165,250,0.5)]',
       icon: <ShieldAlert className="w-4 h-4 text-blue-400" />,
       badge: 'ADMİN 🛡️'
    };
    if (role === 'system') return {
       border: 'border-green-500', bg: 'bg-green-900/30', text: 'text-green-400 font-bold',
       glow: '', icon: null, badge: 'SİSTEM'
    };
    return { border: 'border-gray-700', bg: 'bg-gray-800', text: 'text-gray-200', glow: '', icon: null, badge: '' };
  };

  return (
    <>
      {/* Swipe Overlay & Tab */}
      {!isOpen && (
        <motion.div 
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDragEnd={(e, info) => { if (info.offset.x > 30) setIsOpen(true); }}
          className="fixed left-0 inset-y-0 w-8 z-50 flex items-center justify-center cursor-pointer group pointer-events-auto"
          onClick={() => setIsOpen(true)}
        >
          <div className="absolute left-0 w-1.5 h-32 bg-neon-blue/30 group-hover:bg-neon-blue/80 rounded-r-full transition-all shadow-[0_0_10px_rgba(0,240,255,0.5)] flex items-center justify-center">
            <ChevronRight className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity absolute -right-4" />
          </div>
          {unread > 0 && (
            <div className="absolute top-1/2 -mt-16 left-2 bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-lg">
              {unread > 9 ? '9+' : unread}
            </div>
          )}
        </motion.div>
      )}

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] md:hidden"
            />
            {/* Panel */}
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, info) => { if (info.offset.x < -50) setIsOpen(false); }}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[85vw] sm:w-96 bg-black/95 border-r border-neon-blue z-[60] flex flex-col shadow-[20px_0_50px_rgba(0,240,255,0.15)]"
            >
              {/* Header */}
              <div className="p-4 border-b border-neon-blue/50 flex items-center justify-between bg-blue-950/30">
                <div className="flex items-center gap-2 text-neon-blue font-black tracking-widest">
                  <MessageSquare className="w-5 h-5" /> GLOBAL SOHBET
                </div>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white p-1">
                   <ChevronRight className="w-6 h-6 rotate-180" />
                </button>
              </div>

              {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-neon-blue scrollbar-track-black">
                {messages.map(msg => {
                   const isMe = profile?.name && msg.sender === profile.name;
                   const rs = getRoleStyle(msg.role);
                   const isSystem = msg.role === 'system';
                   
                   // Find replied message
                   const repliedMsg = msg.replyTo ? messages.find(m => m.id === msg.replyTo) : null;

                   return (
                     <div key={msg.id} className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'} ${isSystem ? 'items-center my-2' : ''}`}>
                       
                       {!isSystem && (
                         <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-1">
                           {rs.icon}
                           <span className={rs.badge ? rs.text : ''}>{rs.badge || (isMe ? 'Sen' : msg.sender)}</span>
                           {!rs.badge && <span className="text-gray-600">[Lv.{msg.level}]</span>}
                         </div>
                       )}

                       <div className="relative group/msg">
                          {/* Replied content */}
                          {repliedMsg && (
                            <div className="mb-1 p-1.5 bg-gray-800/50 border-l-2 border-gray-500 rounded text-xs text-gray-400 line-clamp-1 max-w-[200px]">
                              <span className="font-bold">{repliedMsg.sender}:</span> {repliedMsg.text}
                            </div>
                          )}

                          {/* Message Bubble */}
                          <div 
                            onClick={() => setActiveMsgId(activeMsgId === msg.id ? null : msg.id)}
                            className={`relative px-3 py-2 rounded-xl text-sm max-w-[240px] break-words border cursor-pointer select-none ${rs.border} ${rs.bg} ${rs.text} ${rs.glow}`}
                          >
                            {msg.text}
                            
                            {/* Reactions display */}
                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                              <div className="absolute -bottom-3 right-2 flex gap-1 bg-gray-900 border border-gray-700 rounded-full px-1.5 py-0.5 text-[10px] shadow-sm">
                                {Object.entries(msg.reactions).map(([emo, count]) => (
                                  <span key={emo}>{emo} {count > 1 ? count : ''}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Hover/Tap Actions (Reply, Emoji, Delete) */}
                          {!isSystem && profile?.isAuthenticated && (
                            <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity bg-black/90 p-1.5 rounded-lg border border-gray-600 shadow-2xl z-[70] ${isMe ? 'right-full mr-2' : 'left-full ml-2'} ${activeMsgId === msg.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 md:group-hover/msg:opacity-100 pointer-events-none md:pointer-events-auto'}`}>
                               <button onClick={() => { setReplyTo(msg); setActiveMsgId(null); }} className="p-2 hover:text-neon-blue text-gray-300 hover:bg-gray-800 rounded" title="Yanıtla"><Reply className="w-4 h-4" /></button>
                               <button onClick={() => setActiveReactionMsg(msg.id === activeReactionMsg ? null : msg.id)} className="p-2 hover:text-yellow-400 text-gray-300 hover:bg-gray-800 rounded relative" title="Emoji">
                                 <Smile className="w-4 h-4" />
                               </button>
                               {(profile.role === 'owner' || profile.role === 'admin') && (
                                 <button onClick={() => { handleDelete(msg.id); setActiveMsgId(null); }} className="p-2 hover:text-red-500 text-gray-300 hover:bg-gray-800 rounded" title="Sil"><Trash2 className="w-4 h-4" /></button>
                               )}
                               {(profile.role === 'owner' && msg.role !== 'admin' && msg.role !== 'owner' && !isMe) && (
                                 <button onClick={() => { socket.emit('send_global_message', { text: `/admin yap ${msg.sender}` }); setActiveMsgId(null); }} className="p-2 hover:text-yellow-400 text-gray-300 hover:bg-gray-800 rounded" title="Admin Yap">👑</button>
                               )}

                               {/* Emoji Picker Popup */}
                               {activeReactionMsg === msg.id && (
                                 <div className="absolute bottom-full mb-2 -left-4 bg-gray-800 border border-gray-500 rounded-lg p-2 flex gap-2 shadow-2xl z-[80]">
                                    {EMOJIS.map(e => (
                                      <button key={e} onClick={() => { handleReact(msg.id, e); setActiveMsgId(null); }} className="hover:scale-125 transition-transform text-2xl px-1">{e}</button>
                                    ))}
                                 </div>
                               )}
                            </div>
                          )}
                       </div>
                     </div>
                   )
                })}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <div className="px-4 pb-2 text-xs text-gray-400 italic">
                  {typingUsers.length === 1 
                    ? `${typingUsers[0]} yazıyor...` 
                    : typingUsers.length === 2 
                      ? `${typingUsers.join(' ve ')} yazıyor...`
                      : `${typingUsers.length} kişi yazıyor...`}
                </div>
              )}

              {/* Input Area */}
              <div className="p-3 border-t border-neon-blue/50 bg-black flex flex-col gap-2">
                {replyTo && (
                  <div className="flex items-center justify-between bg-gray-800 text-xs text-gray-300 p-2 rounded border-l-2 border-neon-blue">
                    <span className="line-clamp-1"><span className="text-neon-blue font-bold">Yanıt:</span> {replyTo.text}</span>
                    <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-white"><Trash2 className="w-3 h-3" /></button>
                  </div>
                )}
                {profile?.isAuthenticated ? (
                  <form onSubmit={handleSend} className="flex gap-2 relative">
                    <input 
                      type="text" 
                      value={input}
                      onChange={handleInputChange}
                      placeholder="Sohbete katıl..."
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-neon-blue focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] transition-all"
                      maxLength={150}
                    />
                    <button type="submit" disabled={!input.trim()} className="bg-neon-blue text-black p-2 rounded-lg hover:bg-white disabled:opacity-50 transition-colors shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                ) : (
                  <div className="text-center text-xs text-red-400 p-2 border border-red-900/50 bg-red-900/10 rounded">
                    Sohbet etmek için hesap oluşturun veya giriş yapın.
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
