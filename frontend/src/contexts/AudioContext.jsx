import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AudioContext = createContext();
export const useAudio = () => useContext(AudioContext);

const SOUNDS = {
  click: '/sounds/click.mp3',
  miss: '/sounds/miss.mp3',
  hit: '/sounds/hit.mp3',
  sunk: '/sounds/sunk.mp3',
  victory: '/sounds/victory.mp3',
  defeat: '/sounds/defeat.mp3',
  placeShip: '/sounds/place_ship.mp3',
  startGame: '/sounds/start_game.mp3',
};
const MUSIC = {
  menu: '/music/menu.mp3',
  battle: '/music/battle.mp3',
};

export const AudioProvider = ({ children }) => {
  const [musicOn, setMusicOn] = useState(() => {
    return localStorage.getItem('battleship_music') !== 'false';
  });
  const [sfxOn, setSfxOn] = useState(() => {
    return localStorage.getItem('battleship_sfx') !== 'false';
  });

  const musicRef = useRef(null);
  const currentTrackRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('battleship_music', musicOn);
  }, [musicOn]);
  useEffect(() => {
    localStorage.setItem('battleship_sfx', sfxOn);
  }, [sfxOn]);

  const stopMusic = useCallback(() => {
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current = null;
    }
    currentTrackRef.current = null;
  }, []);

  const playSfx = useCallback((name) => {
    if (!sfxOn) return;
    const path = SOUNDS[name];
    if (!path) return;
    try {
      const audio = new Audio(path);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch {}
  }, [sfxOn]);

  const playMusic = useCallback((trackName) => {
    if (!musicOn) {
      stopMusic();
      return;
    }
    const path = MUSIC[trackName];
    if (!path) return;
    if (currentTrackRef.current === trackName && musicRef.current && !musicRef.current.paused) {
      return; 
    }
    stopMusic();
    try {
      const audio = new Audio(path);
      audio.loop = true;
      audio.volume = 0.3;
      audio.play().catch(() => {});
      musicRef.current = audio;
      currentTrackRef.current = trackName;
    } catch {}
  }, [musicOn, stopMusic]);

  const toggleMusic = useCallback(() => {
    setMusicOn(prev => {
      const next = !prev;
      if (!next) stopMusic();
      else if (currentTrackRef.current) playMusic(currentTrackRef.current);
      return next;
    });
  }, [stopMusic, playMusic]);

  const toggleSfx = useCallback(() => {
    setSfxOn(prev => !prev);
  }, []);

  useEffect(() => {
    return () => stopMusic();
  }, [stopMusic]);

  return (
    <AudioContext.Provider value={{
      musicOn, sfxOn, toggleMusic, toggleSfx,
      playSfx, playMusic, stopMusic,
    }}>
      {children}
    </AudioContext.Provider>
  );
};