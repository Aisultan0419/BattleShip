import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { RotateCcw, Shuffle, Check } from 'lucide-react';
import { motion } from 'framer-motion';

const GAP_SIZE = 4; 

export default function Placement({ onSetSail, config }) {
  const { gridSize, fleet } = config;
  
  const [cellSize, setCellSize] = useState(40);

  useEffect(() => {
    const handleResize = () => {
      const availableWidth = window.innerWidth < 1024 ? window.innerWidth - 60 : 550;
      const calculatedSize = Math.floor((availableWidth - GAP_SIZE * (gridSize - 1)) / gridSize);
      setCellSize(Math.max(16, Math.min(40, calculatedSize)));
    };
    
    handleResize(); 
    window.addEventListener('resize', handleResize); 
    return () => window.removeEventListener('resize', handleResize);
  }, [gridSize]);

  const step = cellSize + GAP_SIZE; 

  const [availableShips, setAvailableShips] = useState(() => {
    const ships = [];
    let id = 0;
    fleet.forEach(({ size, count }) => {
      for (let i = 0; i < count; i++) {
        ships.push({ id: `ship-${id++}`, size });
      }
    });
    return ships;
  });

  const [placedShips, setPlacedShips] = useState([]);
  const [draggingShip, setDraggingShip] = useState(null); 
  const [hoverPos, setHoverPos] = useState(null); 
  const [isVertical, setIsVertical] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'KeyR') {
        e.preventDefault();
        setIsVertical(v => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isValidPosition = (x, y, size, vertical, ignoreShipId = null) => {
    if (vertical) {
      if (x + size > gridSize) return false;
    } else {
      if (y + size > gridSize) return false;
    }

    const tempBoard = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
    placedShips.forEach(ship => {
      if (ship.id === ignoreShipId) return;
      for (let i = 0; i < ship.size; i++) {
        const sx = ship.vertical ? ship.x + i : ship.x;
        const sy = ship.vertical ? ship.y : ship.y + i;
        tempBoard[sx][sy] = 1;
        
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = sx + dx;
            const ny = sy + dy;
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
              tempBoard[nx][ny] = 1;
            }
          }
        }
      }
    });

    for (let i = 0; i < size; i++) {
      const cx = vertical ? x + i : x;
      const cy = vertical ? y : y + i;
      if (tempBoard[cx][cy] !== 0) return false;
    }
    return true;
  };

  const handleDragStart = (e, ship, source) => {
    if (source === 'board') setIsVertical(ship.vertical);
    setDraggingShip({ ship, source });
  };

  const handleDragOver = (e, x, y) => {
    e.preventDefault();
    if (hoverPos?.x !== x || hoverPos?.y !== y) {
      setHoverPos({ x, y });
    }
  };

  const handleDragEnd = () => {
    setDraggingShip(null);
    setHoverPos(null);
  };

  const handleDrop = (e, x, y) => {
    e.preventDefault();
    setHoverPos(null);
    if (!draggingShip) return;

    const { ship, source } = draggingShip;
    
    if (isValidPosition(x, y, ship.size, isVertical, ship.id)) {
      if (source === 'fleet') {
        setAvailableShips(prev => prev.filter(s => s.id !== ship.id));
      }
      if (source === 'board') {
        setPlacedShips(prev => prev.filter(s => s.id !== ship.id));
      }
      setPlacedShips(prev => [...prev, { ...ship, x, y, vertical: isVertical }]);
    } else {
      toast.error("Invalid position! Ships cannot touch or overlap.");
    }
    setDraggingShip(null);
  };

  const handleRotateShip = (ship) => {
    const newVertical = !ship.vertical;
    if (isValidPosition(ship.x, ship.y, ship.size, newVertical, ship.id)) {
      setPlacedShips(prev => prev.map(s => s.id === ship.id ? { ...s, vertical: newVertical } : s));
    } else {
      toast.error("Not enough space to rotate!");
    }
  };

  const autoPlace = () => {
    let remainingShips = [...availableShips, ...placedShips].sort((a,b) => b.size - a.size);
    let newPlaced = [];
    let tempBoard = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
    
    const tryPlace = (ship) => {
      let attempts = 0;
      while (attempts < 500) {
        const x = Math.floor(Math.random() * gridSize);
        const y = Math.floor(Math.random() * gridSize);
        const vertical = Math.random() > 0.5;
        
        let valid = true;
        if (vertical ? x + ship.size > gridSize : y + ship.size > gridSize) valid = false;
        else {
          for (let i = 0; i < ship.size; i++) {
            const cx = vertical ? x + i : x;
            const cy = vertical ? y : y + i;
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
                  if (tempBoard[nx][ny] === 1) valid = false;
                }
              }
            }
          }
        }
        
        if (valid) {
          for (let i = 0; i < ship.size; i++) {
            const cx = vertical ? x + i : x;
            const cy = vertical ? y : y + i;
            tempBoard[cx][cy] = 1;
          }
          newPlaced.push({ ...ship, x, y, vertical });
          return true;
        }
        attempts++;
      }
      return false;
    };

    for (let ship of remainingShips) {
      if (!tryPlace(ship)) {
        toast.error("Auto-placement failed. Try a larger grid or fewer ships.");
        return; 
      }
    }

    setAvailableShips([]);
    setPlacedShips(newPlaced);
    toast.success("Fleet deployed automatically!");
  };

  const handleSetSail = () => {
    if (availableShips.length > 0) {
      toast.error(`Commander, ${availableShips.length} ships are not yet deployed!`);
      return;
    }
    const cells = [];
    placedShips.forEach(ship => {
      for (let i = 0; i < ship.size; i++) {
        cells.push([
          ship.vertical ? ship.x + i : ship.x,
          ship.vertical ? ship.y : ship.y + i
        ]);
      }
    });
    onSetSail(cells);
  };

  const handleReturnToFleet = (ship) => {
    setPlacedShips(prev => prev.filter(s => s.id !== ship.id));
    setAvailableShips(prev => [...prev, ship].sort((a,b) => b.size - a.size));
  };

  const renderGridCell = (x, y) => {
    let isHovered = false;
    let isValidHover = false;

    if (draggingShip && hoverPos) {
      const { size } = draggingShip.ship;
      const hx = hoverPos.x;
      const hy = hoverPos.y;
      
      const inHoverRange = isVertical 
        ? (x >= hx && x < hx + size && y === hy)
        : (y >= hy && y < hy + size && x === hx);

      if (inHoverRange) {
        isHovered = true;
        isValidHover = isValidPosition(hx, hy, size, isVertical, draggingShip.source === 'board' ? draggingShip.ship.id : null);
      }
    }

    let bgColor = 'bg-game-grid/40';
    let borderStyle = 'border-blue-900/50';

    if (isHovered) {
      bgColor = isValidHover ? 'bg-emerald-500/80' : 'bg-red-500/80';
      borderStyle = isValidHover ? 'border-emerald-400' : 'border-red-400';
    }

    return (
      <div 
        key={`cell-${x}-${y}`} 
        className={`border ${borderStyle} transition-all duration-150 ${bgColor}`}
        style={{ width: cellSize, height: cellSize }} 
        onDragOver={(e) => handleDragOver(e, x, y)}
        onDragLeave={() => setHoverPos(null)}
        onDrop={(e) => handleDrop(e, x, y)}
        onContextMenu={(e) => { e.preventDefault(); setIsVertical(v => !v); }}
      />
    );
  };

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 p-4 lg:p-8 glass-panel w-full max-w-6xl mx-auto text-white">
      
      <div className="flex flex-col gap-6 w-full lg:w-72 relative z-50 shrink-0">
        <div className="text-center">
          <h2 className="text-2xl font-black uppercase text-game-primary tracking-widest mb-2">Fleet Reserve</h2>
          <p className="text-sm text-gray-400">Grid: {gridSize}x{gridSize}</p>
        </div>
        
        <div className="flex flex-col gap-3 min-h-62.5 bg-game-bg/50 p-4 rounded-xl border border-game-grid shadow-inner max-h-[40vh] overflow-y-auto">
          {fleet.map(({ size }) => {
            const availableOfSize = availableShips.filter(s => s.size === size);
            if (availableOfSize.length === 0) return null;
            return (
              <div key={size} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors group">
                <div 
                  className="flex gap-1 cursor-grab active:cursor-grabbing group-hover:scale-105 transition-transform"
                  draggable
                  onDragStart={(e) => handleDragStart(e, availableOfSize[0], 'fleet')}
                  onDragEnd={handleDragEnd}
                >
                  {Array(size).fill(0).map((_, i) => (
                    <div key={i} className="w-5 h-5 sm:w-6 sm:h-6 bg-yellow-400 border border-yellow-200 rounded-sm shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                  ))}
                </div>
                <span className="text-gray-300 font-mono font-bold text-lg bg-game-grid/50 px-3 py-1 rounded-md">x{availableOfSize.length}</span>
              </div>
            );
          })}
          {availableShips.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-emerald-400 gap-2 opacity-80 py-8">
              <Check className="w-12 h-12" />
              <p className="font-bold uppercase tracking-widest">All Deployed</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={() => setIsVertical(!isVertical)} className="flex items-center justify-center gap-2 bg-game-bg border border-game-grid hover:border-game-primary px-4 py-3 rounded-xl font-bold transition-all text-gray-300 hover:text-white">
            <RotateCcw size={18} className={isVertical ? 'rotate-90 transition-transform' : 'transition-transform'} />
            {isVertical ? 'Vertical Mode' : 'Horizontal Mode'}
          </button>
          
          <button onClick={autoPlace} className="flex items-center justify-center gap-2 bg-indigo-600/20 border border-indigo-500 text-indigo-300 hover:bg-indigo-600 hover:text-white px-4 py-3 rounded-xl font-bold transition-all">
            <Shuffle size={18} />
            Auto Formation
          </button>
          
          <button 
            onClick={handleSetSail} 
            className={`mt-4 flex items-center justify-center gap-2 px-8 py-4 font-black uppercase rounded-xl transition-all duration-300 transform
              ${availableShips.length === 0 
                ? 'bg-emerald-500 hover:bg-emerald-400 text-game-bg hover:scale-105 shadow-[0_0_20px_rgba(16,185,129,0.4)]' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}
          >
            <Check size={20} />
            Set Sail
          </button>
        </div>
      </div>

      <div className="relative flex justify-center w-full">
        <div className="relative bg-game-bg p-3 rounded-2xl border-2 border-game-grid shadow-[0_0_30px_rgba(0,0,0,0.5)] select-none">
          <div 
            className="relative grid gap-1 z-10 mx-auto"
            style={{ 
              gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
              width: (cellSize * gridSize) + (GAP_SIZE * (gridSize - 1)), 
              height: (cellSize * gridSize) + (GAP_SIZE * (gridSize - 1))
            }}
          >
            {Array(gridSize).fill(null).map((_, x) => 
              Array(gridSize).fill(null).map((_, y) => renderGridCell(x, y))
            )}

            {placedShips.map(ship => (
              <motion.div
                key={ship.id}
                initial={false}
                animate={{ rotate: ship.vertical ? 90 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={{
                  position: 'absolute',
                  top: ship.x * step,
                  left: ship.y * step,
                  width: ship.size * step - GAP_SIZE,
                  height: cellSize,
                  transformOrigin: `${cellSize / 2}px ${cellSize / 2}px`, 
                  opacity: draggingShip?.ship.id === ship.id ? 0.3 : 1,
                }}
                className={`bg-yellow-400 border-2 border-yellow-200 rounded-sm shadow-[0_0_15px_rgba(250,204,21,0.6)] cursor-grab active:cursor-grabbing z-30 ${draggingShip && draggingShip.ship.id !== ship.id ? 'pointer-events-none' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, ship, 'board')}
                onDragEnd={handleDragEnd}
                onDoubleClick={() => handleReturnToFleet(ship)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRotateShip(ship); 
                }}
              >
                <div className="flex w-full h-full pointer-events-none">
                  {Array(ship.size).fill(0).map((_, i) => (
                    <div key={i} className="flex-1 border-r-2 border-yellow-600/30 last:border-0" />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}