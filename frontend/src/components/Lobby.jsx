import { useState } from 'react';
import { motion } from 'framer-motion';
import { Ship, Swords, Users, Trophy, Skull, Settings } from 'lucide-react';
import { useAudio } from '../contexts/AudioContext';

export default function Lobby({ user, onLogin, onCreate, onJoin, onLogout }) {
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const { playSfx } = useAudio();
  
  const [gridSize, setGridSize] = useState(10);
  const [maxShipSize, setMaxShipSize] = useState(4);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-900/60 border border-blue-500/30 backdrop-blur-md max-w-md w-full mx-auto p-10 rounded-4xl text-center shadow-[0_0_40px_rgba(59,130,246,0.15)]">
          <Ship className="w-20 h-20 mx-auto mb-8 text-blue-400 animate-bounce" />
          <h1 className="text-4xl font-black tracking-widest mb-10 uppercase text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-cyan-300">Battleship</h1>
          
          <input 
            type="text" 
            placeholder="ENTER COMMANDER NAME" 
            className="w-full bg-[#0a0f1d] border-2 border-blue-500/30 rounded-xl px-6 py-4 mb-6 text-white text-lg outline-none focus:border-blue-400 focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all font-mono uppercase text-center placeholder-gray-600"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                playSfx('click');
                onLogin(name.trim());
              }
            }}
          />
          <button 
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              playSfx('click');
              name.trim() && onLogin(name.trim());
            }}
            disabled={!name.trim()}
          >
            To Battle!
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gray-900/60 border border-blue-500/30 backdrop-blur-md max-w-xl w-full mx-auto p-10 rounded-4xl shadow-[0_0_40px_rgba(59,130,246,0.15)] text-center relative overflow-hidden">
        
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-blue-500/10 blur-[50px] -z-10"></div>

        <div className="mb-6 flex justify-between items-start">
           <div className="text-left">
             <h2 className="text-sm font-black tracking-widest uppercase text-gray-400 mb-1">Welcome, Commander</h2>
             <p className="text-2xl font-black text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-cyan-300 uppercase tracking-widest">{user.displayName}</p>
           </div>
           <button 
             onClick={() => { playSfx('click'); onLogout(); }} 
             className="text-xs text-red-500 hover:text-red-400 underline uppercase mt-2"
           >
             Abandon Ship
           </button>
        </div>

        <div className="flex justify-center gap-8 mb-8">
          <div className="bg-[#0a0f1d]/80 border border-blue-500/20 rounded-2xl p-4 w-32 flex flex-col items-center shadow-inner relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400 group-hover:h-2 transition-all"></div>
            <Trophy className="w-6 h-6 text-yellow-400 mb-1 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
            <span className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Victories</span>
            <span className="text-3xl font-black text-white">{user.wins || 0}</span>
          </div>
          <div className="bg-[#0a0f1d]/80 border border-blue-500/20 rounded-2xl p-4 w-32 flex flex-col items-center shadow-inner relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500 group-hover:h-2 transition-all"></div>
            <Skull className="w-6 h-6 text-red-500 mb-1 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            <span className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Defeats</span>
            <span className="text-3xl font-black text-white">{user.losses || 0}</span>
          </div>
        </div>

        <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-5 mb-8 text-left">
          <h3 className="text-blue-400 font-bold uppercase tracking-widest text-sm mb-4 flex items-center gap-2"><Settings size={16}/> Operation Parameters</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-gray-400 font-mono mb-1">
                <span>Grid Size: {gridSize}x{gridSize}</span>
                <span>Max: 15</span>
              </div>
              <input type="range" min="8" max="15" value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} className="w-full accent-blue-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-400 font-mono mb-1">
                <span>Max Ship Decks: {maxShipSize}</span>
                <span>Max: 6</span>
              </div>
              <input type="range" min="2" max="6" value={maxShipSize} onChange={(e) => setMaxShipSize(Number(e.target.value))} className="w-full accent-blue-500" />
            </div>
            <p className="text-[10px] text-yellow-500/80 leading-tight">Note: Both players must use identical parameters. Fleet composition is auto-balanced.</p>
          </div>
        </div>

        <div className="space-y-4">
          <button 
            className="w-full flex items-center justify-center gap-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-4 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] active:scale-95"
            onClick={() => { playSfx('click'); onCreate(gridSize, maxShipSize); }}
          >
            <Swords className="w-6 h-6" /> Create Match
          </button>
          
          <div className="relative flex items-center py-1">
            <div className="grow border-t border-gray-700/50"></div>
            <span className="shrink-0 mx-4 text-gray-500 font-black uppercase tracking-[0.2em] text-xs">Or</span>
            <div className="grow border-t border-gray-700/50"></div>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="ROOM ID" 
              className="grow bg-[#0a0f1d] border-2 border-gray-700/50 rounded-xl px-4 py-3 text-white text-center font-mono uppercase outline-none focus:border-blue-400 transition-all placeholder-gray-600"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && joinId.trim()) {
                  playSfx('click');
                  onJoin(joinId.trim(), gridSize, maxShipSize);
                }
              }}
            />
            <button 
              className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 text-white font-black uppercase px-6 rounded-xl transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              onClick={() => {
                playSfx('click');
                joinId.trim() && onJoin(joinId.trim(), gridSize, maxShipSize);
              }}
              disabled={!joinId.trim()}
            >
              <Users className="w-5 h-5" /> Join
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}