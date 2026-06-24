import { useState, useEffect, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Toaster, toast } from 'react-hot-toast';
import { AudioProvider, useAudio } from './contexts/AudioContext';
import AudioControls from './components/AudioControls';
import Lobby from './components/Lobby';
import Placement from './components/Placement';
import Battle from './components/Battle';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5107';

const generateGameConfig = (requestedGridSize, requestedMaxShipSize) => {
  const gridSize = Math.max(8, Math.min(15, requestedGridSize));
  let maxShipSize = Math.max(1, Math.min(6, requestedMaxShipSize));

  const calculateFleetCells = (maxSize) => {
    let total = 0;
    for (let size = 1; size <= maxSize; size++) total += size * (maxSize - size + 1);
    return total;
  };

  const boardArea = gridSize * gridSize;
  while (maxShipSize > 1 && calculateFleetCells(maxShipSize) > boardArea * 0.22) {
    maxShipSize--;
  }

  const fleet = [];
  for (let size = maxShipSize; size >= 1; size--) {
    fleet.push({ type: `ship-${size}`, size: size, count: maxShipSize - size + 1 });
  }

  return { gridSize, maxShipSize, fleet };
};

function AppContent() {
  const { playSfx, playMusic, stopMusic } = useAudio();

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('battleship_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [connection, setConnection] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [config, setConfig] = useState(generateGameConfig(10, 4));
  const [gameData, setGameData] = useState({
    state: 'WaitingForPlayer',
    currentTurn: null,
    players: {},
    lastShot: null,
  });
  const [myFleetCells, setMyFleetCells] = useState([]);

  useEffect(() => {
    if (user && !connection) {
      connectToHub(user.id);
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (connection) connection.stop();
    };
  }, [connection]);

  useEffect(() => {
    if (!user) {
      stopMusic();
      return;
    }
    if (!roomId || gameData.state === 'WaitingForPlayer' || gameData.state === 'PlacingShips') {
      playMusic('menu');
    } else if (gameData.state === 'Battle' || gameData.state === 'GameOver') {
      playMusic('battle');
    }
  }, [user, roomId, gameData.state, playMusic, stopMusic]);

  const handleLogin = async (name) => {
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name })
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        localStorage.setItem('battleship_user', JSON.stringify(userData));
        connectToHub(userData.id);
        playSfx('click');
      }
    } catch (err) { toast.error("Server connection error"); }
  };

  const connectToHub = async (userId) => {
    const newConnection = new HubConnectionBuilder()
      .withUrl(`${API_URL}/battleHub?userId=${userId}`)
      .configureLogging(LogLevel.Information)
      .withAutomaticReconnect()
      .build();

    newConnection.on('ReceiveGameState', (dto) => {
      setRoomId(dto.roomId);
      if (dto.gridSize && dto.maxShipSize) {
        setConfig(generateGameConfig(dto.gridSize, dto.maxShipSize));
      }
      const states = ['WaitingForPlayer', 'PlacingShips', 'Battle', 'GameOver'];
      setGameData(prev => ({
        ...prev,
        state: states[dto.state] || states[0],
        currentTurn: dto.currentTurnUserId,
        players: dto.players
      }));
    });

    newConnection.on('GameStarted', () => {
      toast.success('Enemy joined! Prepare your fleet.', { icon: '⚔️' });
      setGameData(prev => ({ ...prev, state: 'PlacingShips' }));
      playSfx('click'); 
    });

    newConnection.on('InvalidPlacement', () => {
      toast.error('Invalid ship placement!');
    });

    newConnection.on('BattlePhaseStarted', (firstTurnUserId) => {
      toast.success('Battle Started! Destroy the enemy!', { icon: '🔥' });
      setGameData(prev => ({
        ...prev, state: 'Battle', currentTurn: firstTurnUserId, lastShot: null
      }));
      playSfx('startGame');
    });

    newConnection.on('ReceiveShotResult', (x, y, isHit) => {
      setGameData(prev => {
        const isMyShot = prev.currentTurn === userId;
        let nextTurnUserId = prev.currentTurn;
        if (!isHit) nextTurnUserId = isMyShot ? 'opponent' : userId;
        return {
          ...prev, currentTurn: nextTurnUserId, lastShot: { x, y, isHit, isMyShot }
        };
      });
    });

    newConnection.on('ShipSunk', (sunkCoords, shooterId) => {
      setGameData(prev => ({
        ...prev,
        lastSunkShip: { coords: sunkCoords, shooterId, id: Date.now() }
      }));
    });

    newConnection.on('GameOver', (winnerId) => {
      setGameData(prev => ({ ...prev, state: 'GameOver', winnerId }));
    });

    try {
      await newConnection.start();
      setConnection(newConnection);
      toast.success("Connected to HQ");
    } catch (e) {
      toast.error("Failed to connect to game server");
    }
  };

  const createRoom = async (gridSz, maxShipSz) => {
      if (connection) {
          try {
              const correctedConfig = generateGameConfig(gridSz, maxShipSz); 
              setConfig(correctedConfig);
              const id = await connection.invoke('CreateRoom', correctedConfig.gridSize, correctedConfig.maxShipSize);
              setRoomId(id);
              setGameData(prev => ({ ...prev, state: 'WaitingForPlayer' }));
              playSfx('click');
          } catch (err) { toast.error("Failed to create room"); }
      }
  };

  const joinRoom = async (id, gridSz, maxShipSz) => {
      if (connection && id) {
          try {
              const correctedConfig = generateGameConfig(gridSz, maxShipSz);
              setConfig(correctedConfig);
              await connection.invoke('JoinRoom', id);
              setRoomId(id);
              playSfx('click');
          } catch (err) { toast.error(err.message || "Failed to join room"); }
      }
  };

  const handleSetSail = async (shipCoordinates) => {
    if (connection) {
      try {
        setMyFleetCells(shipCoordinates);
        await connection.invoke('PlaceShips', roomId, shipCoordinates);
        toast.success("Fleet deployed! Waiting for enemy ready...");
        playSfx('click');
      } catch (err) { toast.error("Error deploying fleet"); }
    }
  };

  const handleLogout = () => {
    if (connection) connection.stop();
    localStorage.removeItem('battleship_user');
    setUser(null);
    setConnection(null);
    setRoomId('');
    stopMusic();
    playSfx('click');
  };

  const resetGameSession = () => {
    if (gameData.state === 'GameOver' && gameData.winnerId) {
      setUser(prev => ({
        ...prev,
        wins: gameData.winnerId === prev.id ? prev.wins + 1 : prev.wins,
        losses: gameData.winnerId !== prev.id ? prev.losses + 1 : prev.losses
      }));
    }
    if (connection) connection.stop();
    setConnection(null);
    setRoomId('');
    setGameData({ state: 'WaitingForPlayer', currentTurn: null, players: {}, lastShot: null });
    playSfx('click');
    if (user) connectToHub(user.id);
  };

  return (
    <div className="min-h-screen text-white font-sans overflow-hidden bg-[#0f172a] selection:bg-blue-500/30">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid #3b82f6' } }} />
      <AudioControls />

      <main className="container mx-auto px-4 py-8 relative z-10 h-full">
        {!user ? (
          <Lobby user={user} onLogin={handleLogin} />
        ) : !connection || !roomId ? (
          <Lobby
            user={user}
            onLogout={handleLogout}
            onCreate={createRoom}
            onJoin={joinRoom}
          />
        ) : gameData.state === 'WaitingForPlayer' ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="w-24 h-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-8"></div>
            <h2 className="text-4xl font-black uppercase tracking-widest text-blue-400 mb-4">Waiting for Enemy</h2>
            <div
              className="bg-gray-800/80 border-2 border-blue-500 px-8 py-4 rounded-xl text-5xl font-mono tracking-widest cursor-pointer hover:bg-gray-700 transition-colors shadow-[0_0_30px_rgba(59,130,246,0.3)]"
              onClick={() => { navigator.clipboard.writeText(roomId); toast.success("Copied!"); }}
            >
              {roomId}
            </div>
            <p className="mt-6 text-gray-400">Settings: {config.gridSize}x{config.gridSize} Grid, Max Ship: {config.maxShipSize}</p>
          </div>
        ) : gameData.state === 'PlacingShips' ? (
          <Placement onSetSail={handleSetSail} config={config} />
        ) : (
          <Battle
            connection={connection}
            roomId={roomId}
            user={user}
            gameData={gameData}
            myFleetCells={myFleetCells}
            onLeave={resetGameSession}
            config={config}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AudioProvider>
      <AppContent />
    </AudioProvider>
  );
}
