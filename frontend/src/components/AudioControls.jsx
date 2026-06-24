import { Volume2, VolumeX, Music, Music2 } from 'lucide-react';
import { useAudio } from '../contexts/AudioContext';

export default function AudioControls() {
  const { musicOn, sfxOn, toggleMusic, toggleSfx } = useAudio();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex gap-3">
      <button
        onClick={toggleMusic}
        className="w-10 h-10 rounded-full bg-gray-900/80 border border-gray-700 flex items-center justify-center
                   hover:bg-gray-800 transition-colors shadow-lg"
        title={musicOn ? 'Music ON' : 'Music OFF'}
      >
        {musicOn ? <Music size={18} className="text-blue-400" /> : <Music2 size={18} className="text-gray-500" />}
      </button>
      <button
        onClick={toggleSfx}
        className="w-10 h-10 rounded-full bg-gray-900/80 border border-gray-700 flex items-center justify-center
                   hover:bg-gray-800 transition-colors shadow-lg"
        title={sfxOn ? 'SFX ON' : 'SFX OFF'}
      >
        {sfxOn ? <Volume2 size={18} className="text-blue-400" /> : <VolumeX size={18} className="text-gray-500" />}
      </button>
    </div>
  );
}