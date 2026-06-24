import React, { useEffect, useRef, useState } from 'react';

export default function MapEngine({ mapData, players, myId, onMove }) {
  const canvasRef = useRef(null);
  const requestRef = useRef();
  
  // Local state for smooth movement prediction
  const [localPos, setLocalPos] = useState({ x: 0, y: 0 });
  const speed = 4;
  const keys = useRef({ w: false, a: false, s: false, d: false });

  // Initialize local position
  useEffect(() => {
    const me = players[myId];
    if (me && localPos.x === 0 && localPos.y === 0) {
      setLocalPos({ x: me.x, y: me.y });
    }
  }, [players, myId]);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(k)) keys.current[k] = true;
    };
    const handleKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(k)) keys.current[k] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game Loop
  useEffect(() => {
    let lastEmit = Date.now();
    
    const loop = () => {
      let dx = 0; let dy = 0;
      if (keys.current.w) dy -= speed;
      if (keys.current.s) dy += speed;
      if (keys.current.a) dx -= speed;
      if (keys.current.d) dx += speed;

      if (dx !== 0 || dy !== 0) {
        setLocalPos(prev => {
          let newX = prev.x + dx;
          let newY = prev.y + dy;
          
          // Client-side collision prediction
          const ts = mapData.tileSize;
          const col = Math.floor((newX + ts/2) / ts);
          const row = Math.floor((newY + ts/2) / ts);
          
          if (row >= 0 && row < mapData.height && col >= 0 && col < mapData.width) {
             if (mapData.grid[row][col] === 1) {
                // Wall hit
                newX = prev.x;
                newY = prev.y;
             }
          } else {
             newX = prev.x; newY = prev.y;
          }

          // Emit to server (rate limited to 15 ticks/sec)
          if (Date.now() - lastEmit > 66 && (newX !== prev.x || newY !== prev.y)) {
            onMove(newX, newY);
            lastEmit = Date.now();
          }
          
          return { x: newX, y: newY };
        });
      }
      
      draw();
      requestRef.current = requestAnimationFrame(loop);
    };
    
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [mapData, onMove]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const ts = mapData.tileSize;
    
    // Camera offset
    const myRole = players[myId]?.role;
    let cameraX = localPos.x - canvas.width / 2 + ts / 2;
    let cameraY = localPos.y - canvas.height / 2 + ts / 2;
    
    if (myRole === 'oracle') {
        cameraX = (mapData.width * ts) / 2 - canvas.width / 2;
        cameraY = (mapData.height * ts) / 2 - canvas.height / 2;
    }

    ctx.save();
    ctx.translate(-cameraX, -cameraY);
    
    // Draw Map
    for (let row = 0; row < mapData.height; row++) {
      for (let col = 0; col < mapData.width; col++) {
        if (mapData.grid[row][col] === 1) {
          ctx.fillStyle = '#16a34a'; // Neon green walls
          ctx.shadowColor = '#16a34a';
          ctx.shadowBlur = 10;
          ctx.fillRect(col * ts, row * ts, ts, ts);
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = '#1f2937'; // grid lines
          ctx.strokeRect(col * ts, row * ts, ts, ts);
        }
      }
    }
    
    // Draw Doors
    (mapState?.doors || []).forEach(d => {
       ctx.fillStyle = d.isOpen ? 'rgba(34, 197, 94, 0.3)' : '#f97316'; // Open: transparent green, Closed: solid orange
       ctx.shadowColor = d.isOpen ? 'transparent' : '#f97316';
       ctx.shadowBlur = d.isOpen ? 0 : 10;
       ctx.fillRect(d.x * ts, d.y * ts, ts, ts);
       ctx.shadowBlur = 0;
       
       if (!d.isOpen) {
           ctx.fillStyle = '#fff';
           ctx.font = '8px Arial';
           ctx.fillText('KAPI', d.x * ts + ts/2, d.y * ts + ts/2 + 3);
       }
    });

    // Draw Terminals
    (mapState?.terminals || []).forEach(t => {
       ctx.fillStyle = t.isHacked ? '#3b82f6' : '#a855f7'; // Hacked: blue, Not: purple
       ctx.beginPath();
       ctx.arc(t.x * ts + ts/2, t.y * ts + ts/2, ts/3, 0, Math.PI * 2);
       ctx.fill();
       ctx.fillStyle = '#fff';
       ctx.font = '8px Arial';
       ctx.fillText('TRM', t.x * ts + ts/2, t.y * ts + ts/2 + 3);
    });

    // Draw Guard Bots
    (mapState?.bots || []).forEach(b => {
       ctx.fillStyle = '#ef4444'; // Red for enemy bots
       ctx.shadowColor = '#ef4444';
       ctx.shadowBlur = 10;
       ctx.fillRect(b.x + ts/4, b.y + ts/4, ts/2, ts/2);
       ctx.shadowBlur = 0;
       ctx.fillStyle = '#fff';
       ctx.font = '8px Arial';
       ctx.fillText('BOT', b.x + ts/2, b.y + 5);
    });
    
    // Draw Players
    Object.values(players).forEach(p => {
      const isMe = p.id === myId;
      const x = isMe ? localPos.x : p.x;
      const y = isMe ? localPos.y : p.y;
      
      ctx.fillStyle = isMe ? '#3b82f6' : '#ef4444'; // Blue me, Red others
      ctx.beginPath();
      ctx.arc(x + ts/2, y + ts/2, ts/3, 0, Math.PI * 2);
      ctx.fill();
      
      // Name tag
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, x + ts/2, y - 5);
    });
    
    // Fog of War (Only for Ghost)
    if (myRole === 'ghost') {
       ctx.globalCompositeOperation = 'destination-in';
       const gradient = ctx.createRadialGradient(
          localPos.x + ts/2, localPos.y + ts/2, ts,
          localPos.x + ts/2, localPos.y + ts/2, ts * 4
       );
       gradient.addColorStop(0, 'rgba(0,0,0,1)');
       gradient.addColorStop(1, 'rgba(0,0,0,0)');
       ctx.fillStyle = gradient;
       ctx.beginPath();
       ctx.arc(localPos.x + ts/2, localPos.y + ts/2, ts * 4, 0, Math.PI * 2);
       ctx.fill();
       ctx.globalCompositeOperation = 'source-over';
       
       // Draw a dark overlay outside the vision
       ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
       ctx.beginPath();
       ctx.rect(cameraX, cameraY, canvas.width, canvas.height);
       ctx.arc(localPos.x + ts/2, localPos.y + ts/2, ts * 4, 0, Math.PI * 2, true);
       ctx.fill();
    }
    
    ctx.restore();
  };

  // Adjust camera for Oracle
  const myRole = players[myId]?.role;
  const isOracle = myRole === 'oracle';

  return (
    <div className="relative w-full max-w-4xl border border-primary rounded shadow-[0_0_15px_rgba(22,163,74,0.5)] overflow-hidden">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={600} 
        className="w-full h-auto bg-black"
      />
    </div>
  );
}
