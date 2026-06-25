import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Target, X, Circle, Skull } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAudio } from '../contexts/AudioContext';

export default function Battle({ connection, roomId, user, gameData, myFleetCells, onLeave, config }) {
  const { gridSize } = config;
  const { playSfx } = useAudio();

  const [enemyBoard, setEnemyBoard] = useState(() => Array(gridSize).fill(null).map(() => Array(gridSize).fill(0)));
  const [myBoard, setMyBoard] = useState(() => {
    const b = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
    if (myFleetCells && myFleetCells.length > 0) {
        myFleetCells.forEach(([x, y]) => { b[x][y] = 1; });
    }
    return b;
  });

  const isMyTurn = gameData?.currentTurn === user?.id;
  const isGameOver = gameData?.state === 'GameOver';
    
  const gameOverSoundPlayed = useRef(false);

  useEffect(() => {
    if (gameData?.lastShot) {
      playSfx(gameData.lastShot.isHit ? 'hit' : 'miss');
    }
  }, [gameData?.lastShot, playSfx]);

  useEffect(() => {
    if (gameData?.lastSunkShip) {
      playSfx('sunk');
    }
  }, [gameData?.lastSunkShip, playSfx]);
  
  useEffect(() => {
    if (gameData?.state === 'GameOver' && !gameOverSoundPlayed.current) {
      gameOverSoundPlayed.current = true;
      playSfx(gameData.winnerId === user.id ? 'victory' : 'defeat');
    }
    if (gameData?.state !== 'GameOver') {
      gameOverSoundPlayed.current = false;
    }
  }, [gameData?.state, gameData?.winnerId, user.id, playSfx]);

  useEffect(() => {
    if (gameData?.lastShot) {
      const { x, y, isHit, isMyShot } = gameData.lastShot;
      if (isMyShot) {
        setEnemyBoard(prev => {
          const next = prev.map(row => [...row]);
          next[x][y] = isHit ? 3 : 2;
          return next;
        });
      } else {
        setMyBoard(prev => {
          const next = prev.map(row => [...row]);
          next[x][y] = isHit ? 3 : 2;
          return next;
        });
      }
    }
  }, [gameData?.lastShot]);

  useEffect(() => {
    if (gameData?.lastSunkShip) {
      const { coords, shooterId } = gameData.lastSunkShip;
      
      if (shooterId === user.id) {
        setEnemyBoard(prev => {
          const next = prev.map(row => [...row]);
          coords.forEach(([x, y]) => { next[x][y] = 4; });
          
          coords.forEach(([x, y]) => {
             const allNeighbors = [
                 [x-1,y-1], [x-1,y], [x-1,y+1],
                 [x,y-1],            [x,y+1],
                 [x+1,y-1], [x+1,y], [x+1,y+1]
             ];
             allNeighbors.forEach(([nx, ny]) => {
                if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && next[nx][ny] === 0) {
                   next[nx][ny] = 2; 
                }
             });
          });
          return next;
        });
      } else {
        setMyBoard(prev => {
          const next = prev.map(row => [...row]);
          coords.forEach(([x, y]) => { next[x][y] = 4; });
          return next;
        });
      }
    }
  }, [gameData?.lastSunkShip]);

  const handleShot = (x, y) => {
    if (!isMyTurn || isGameOver) return;
    if (enemyBoard[x][y] !== 0) return;
    connection.invoke('MakeShot', roomId, x, y);
  };

  const renderCellContent = (cellState) => {
    if (cellState === 2) {
      return (
        <motion.div key="miss" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center w-full h-full">
          <Circle className="w-1/2 h-1/2 text-blue-300 opacity-60" strokeWidth={3} />
        </motion.div>
      );
    }
    if (cellState === 3) {
      return (
        <motion.div key="hit" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200 }} className="flex items-center justify-center w-full h-full bg-red-500/20">
          <X className="w-3/4 h-3/4 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" strokeWidth={4} />
        </motion.div>
      );
    }
    if (cellState === 4) {
      return (
        <motion.div key="sunk" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center w-full h-full bg-red-900/60 border border-red-500 shadow-[inset_0_0_15px_rgba(220,38,38,0.6)]">
          <Skull className="w-2/3 h-2/3 text-red-400 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]" strokeWidth={2.5} />
        </motion.div>
      );
    }
    if (cellState === 1) {
      return <div key="ship" className="w-full h-full bg-yellow-400/80 rounded-sm shadow-[inset_0_0_10px_rgba(202,138,4,0.5)]"></div>;
    }
    return null;
  };

  const cellClass = "aspect-square w-full h-full border border-blue-500/20 rounded-sm relative overflow-hidden transition-all duration-200";

  return (
    <div className="flex flex-col items-center gap-4 lg:gap-6 py-2 w-full max-w-7xl mx-auto overflow-x-hidden">
      <motion.div 
        animate={{ 
          scale: isMyTurn && !isGameOver ? [1, 1.02, 1] : 1,
          boxShadow: isMyTurn && !isGameOver ? "0px 0px 40px rgba(59, 130, 246, 0.4)" : "0px 0px 0px rgba(0,0,0,0)"
        }}
        transition={{ repeat: Infinity, duration: 2 }}
        className={`px-8 lg:px-12 py-3 lg:py-4 rounded-2xl border-4 text-xl lg:text-2xl font-black uppercase tracking-widest backdrop-blur-md shadow-2xl flex items-center gap-4 text-center
          ${isGameOver 
            ? (gameData.winnerId === user.id ? 'border-yellow-400 text-yellow-400 bg-yellow-400/10' : 'border-red-600 text-red-500 bg-red-600/10')
            : (isMyTurn ? 'border-blue-500 text-blue-400 bg-blue-900/20' : 'border-gray-700 text-gray-500 bg-gray-900/50')}`}
      >
        {isGameOver 
          ? (gameData.winnerId === user.id ? "🏆 MATCH WON" : "💀 MATCH LOST")
          : (isMyTurn ? "YOUR TURN - FIRE!" : "WAITING FOR ENEMY...")}
      </motion.div>

      {isGameOver && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => { playSfx('click'); onLeave(); }}
          className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest transition-colors shadow-[0_0_30px_rgba(220,38,38,0.6)] animate-pulse"
        >
          RETURN TO LOBBY
        </motion.button>
      )}

      <div className="flex flex-col md:flex-row gap-6 md:gap-8 lg:gap-16 justify-center items-center md:items-start w-full mt-2 px-2">
        
        <div className={`relative p-3 sm:p-5 rounded-4xl transition-all duration-700 border-2 w-full max-w-90 lg:max-w-112.5
          ${isMyTurn && !isGameOver 
            ? 'bg-blue-950/40 border-blue-500/50 shadow-[0_0_60px_rgba(59,130,246,0.15)] scale-100' 
            : 'bg-gray-900/60 border-gray-800 opacity-60 scale-95 grayscale-30'}`}>
          
          <h3 className="text-center mb-4 lg:mb-5 font-black uppercase tracking-widest text-lg lg:text-xl text-blue-400 flex items-center justify-center gap-3 drop-shadow-lg">
            <Target className={`w-6 h-6 lg:w-7 lg:h-7 ${isMyTurn && !isGameOver ? 'animate-pulse text-red-400' : ''}`} /> Enemy Waters
          </h3>
          
          <div 
            className="grid gap-1 bg-[#0a0f1d] border-2 border-blue-500/30 p-2 lg:p-2.5 rounded-2xl w-full"
            style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
          >
            {enemyBoard.map((row, x) => row.map((cell, y) => (
              <div 
                key={`e-${x}-${y}`} 
                onClick={() => handleShot(x, y)}
                className={`${cellClass} ${cell === 0 && isMyTurn && !isGameOver ? 'hover:bg-blue-500/20 hover:border-blue-400 cursor-crosshair z-10 shadow-lg hover:scale-110' : 'bg-[#111827]/80 cursor-default'}`}
              >
                {cell === 0 && isMyTurn && !isGameOver && (
                  <div className="absolute inset-0 opacity-0 hover:opacity-100 flex items-center justify-center bg-red-500/10 transition-opacity">
                    <Target className="w-1/2 h-1/2 text-red-400/50 animate-ping" />
                  </div>
                )}
                {renderCellContent(cell)}
              </div>
            )))}
          </div>
        </div>

        <div className={`relative p-3 sm:p-5 rounded-4xl transition-all duration-700 border-2 bg-gray-900/40 border-gray-700/50 shadow-2xl w-full max-w-90 lg:max-w-112.5
          ${!isMyTurn && !isGameOver ? 'scale-100 opacity-100' : 'scale-95 opacity-80'}`}>
          <h3 className="text-center mb-4 lg:mb-5 font-black uppercase tracking-widest text-lg lg:text-xl text-gray-400">
            Your Fleet Radar
          </h3>
          
          <div 
            className="grid gap-1 bg-black/60 border-2 border-gray-700 p-2 lg:p-2.5 rounded-2xl w-full"
            style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
          >
            {myBoard.map((row, x) => row.map((cell, y) => (
              <div 
                key={`m-${x}-${y}`} 
                className={`${cellClass} bg-gray-800/30`}
              >
                {renderCellContent(cell)}
              </div>
            )))}
          </div>
        </div>

      </div>
    </div>
  );
}