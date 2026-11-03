import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  CloudRain,
  Radio,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Waves,
  Music
} from 'lucide-react';

type SoundscapeType = 'alpha' | 'brown' | 'rain' | 'off';

/**
 * Focus Sound Engine using Web Audio API:
 * Synthesizes 10Hz binaural alpha waves, organic pink/brown noise, and gentle rain
 * 100% offline without needing internet or external accounts.
 */
class OfflineSoundEngine {
  private ctx: AudioContext | null = null;
  private currentType: SoundscapeType = 'off';
  private masterGain: GainNode | null = null;
  private activeNodes: (AudioNode | number)[] = [];

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(volume: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime);
    }
  }

  stop() {
    this.activeNodes.forEach(node => {
      try {
        if (typeof node === 'number') {
          clearInterval(node);
        } else if ('stop' in node && typeof (node as any).stop === 'function') {
          (node as any).stop();
        } else if ('disconnect' in node) {
          node.disconnect();
        }
      } catch (e) {}
    });
    this.activeNodes = [];
    this.currentType = 'off';
  }

  play(type: SoundscapeType) {
    this.stop();
    if (type === 'off') return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    this.currentType = type;

    if (type === 'alpha') {
      // 10Hz Binaural Beat (Carrier: 200Hz Left, 210Hz Right -> 10Hz alpha entrainment)
      const merger = this.ctx.createChannelMerger(2);
      
      const oscL = this.ctx.createOscillator();
      oscL.type = 'sine';
      oscL.frequency.setValueAtTime(200, this.ctx.currentTime);

      const oscR = this.ctx.createOscillator();
      oscR.type = 'sine';
      oscR.frequency.setValueAtTime(210, this.ctx.currentTime);

      const gainL = this.ctx.createGain();
      gainL.gain.setValueAtTime(0.25, this.ctx.currentTime);
      const gainR = this.ctx.createGain();
      gainR.gain.setValueAtTime(0.25, this.ctx.currentTime);

      oscL.connect(gainL);
      gainL.connect(merger, 0, 0);

      oscR.connect(gainR);
      gainR.connect(merger, 0, 1);

      merger.connect(this.masterGain);

      oscL.start();
      oscR.start();
      this.activeNodes.push(oscL, oscR, gainL, gainR, merger);
    } else if (type === 'brown' || type === 'rain') {
      // Noise buffer generator
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise integration
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        output[i] = lastOut * 3.5;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      if (type === 'rain') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(850, this.ctx.currentTime);
      } else {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      }

      whiteNoise.connect(filter);
      filter.connect(this.masterGain);
      whiteNoise.start();
      this.activeNodes.push(whiteNoise, filter);
    }
  }
}

const soundEngine = new OfflineSoundEngine();

export const MusicFocusBar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSound, setActiveSound] = useState<SoundscapeType>('off');
  const [volume, setVolume] = useState(0.4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [spotifyEmbedUrl, setSpotifyEmbedUrl] = useState('https://open.spotify.com/embed/playlist/37i9dQZF1DX8Uebhn9wzrS?utm_source=generator&theme=0');
  const [customSpotifyUrl, setCustomSpotifyUrl] = useState('');
  const [audioSource, setAudioSource] = useState<'soundscape' | 'spotify'>('soundscape');

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    soundEngine.setVolume(volume);
  }, [volume]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleSound = (type: SoundscapeType) => {
    if (activeSound === type && isPlaying) {
      soundEngine.stop();
      setIsPlaying(false);
      setActiveSound('off');
    } else {
      soundEngine.play(type);
      setActiveSound(type);
      setIsPlaying(true);
    }
  };

  const handleApplyCustomSpotify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSpotifyUrl.trim()) return;
    try {
      const parsed = new URL(customSpotifyUrl.trim());
      if (parsed.hostname === 'open.spotify.com' || parsed.hostname.endsWith('.spotify.com')) {
        let path = parsed.pathname;
        if (!path.startsWith('/embed/')) {
          path = '/embed' + path;
        }
        setSpotifyEmbedUrl(`https://open.spotify.com${path}`);
        setAudioSource('spotify');
        setCustomSpotifyUrl('');
      } else {
        alert('Please enter a valid Spotify track or playlist URL.');
      }
    } catch {
      alert('Invalid URL format.');
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Sleek Minimalist Top Bar Capsule */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
          isPlaying || audioSource === 'spotify'
            ? 'bg-zinc-900 border-zinc-700 text-zinc-100 shadow-xs'
            : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
        }`}
        title="Focus Music & Ambient Soundscapes"
      >
        <Music className="w-3.5 h-3.5 text-zinc-400" />
        
        {/* Equalizer Visualizer Bars */}
        <div className="flex items-end gap-0.5 h-3 w-3.5 pb-0.5">
          <span className={`w-0.5 rounded-xs bg-zinc-300 transition-all ${isPlaying ? 'animate-[pulse_0.8s_ease-in-out_infinite] h-2.5' : 'h-1'}`} />
          <span className={`w-0.5 rounded-xs bg-zinc-300 transition-all ${isPlaying ? 'animate-[pulse_1.1s_ease-in-out_infinite_0.2s] h-3' : 'h-1.5'}`} />
          <span className={`w-0.5 rounded-xs bg-zinc-300 transition-all ${isPlaying ? 'animate-[pulse_0.9s_ease-in-out_infinite_0.4s] h-2' : 'h-1'}`} />
          <span className={`w-0.5 rounded-xs bg-zinc-300 transition-all ${isPlaying ? 'animate-[pulse_1.2s_ease-in-out_infinite_0.1s] h-2.5' : 'h-0.5'}`} />
        </div>

        <span className="hidden md:inline font-mono text-[11px] tracking-tight">
          {isPlaying ? (activeSound === 'alpha' ? '10Hz Alpha' : activeSound === 'brown' ? 'Brown Noise' : 'Rain') : 'Audio'}
        </span>
        <ChevronDown className="w-3 h-3 text-zinc-500" />
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl antigravity-glass p-4 text-xs text-zinc-200 z-50 shadow-2xl animate-in fade-in zoom-in-95 duration-150 border border-white/10">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-zinc-400" />
              <span className="font-semibold text-zinc-100 text-sm">Research Audio Dock</span>
            </div>
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setAudioSource('soundscape')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  audioSource === 'soundscape' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Offline Waves
              </button>
              <button
                type="button"
                onClick={() => setAudioSource('spotify')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  audioSource === 'spotify' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Spotify
              </button>
            </div>
          </div>

          {audioSource === 'soundscape' ? (
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Offline synthesized frequencies designed to stimulate high neuroplasticity and deep focus without internet access.
              </p>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleSound('alpha')}
                  className={`p-2.5 rounded-lg border text-left flex flex-col justify-between h-20 transition-all ${
                    activeSound === 'alpha' && isPlaying
                      ? 'bg-zinc-100 text-zinc-950 border-white font-medium shadow-md'
                      : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <Waves className="w-4 h-4 text-zinc-400" />
                  <div>
                    <div className="font-semibold text-xs">10Hz Alpha</div>
                    <div className="text-[10px] opacity-70">Focus beat</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleSound('brown')}
                  className={`p-2.5 rounded-lg border text-left flex flex-col justify-between h-20 transition-all ${
                    activeSound === 'brown' && isPlaying
                      ? 'bg-zinc-100 text-zinc-950 border-white font-medium shadow-md'
                      : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <Radio className="w-4 h-4 text-zinc-400" />
                  <div>
                    <div className="font-semibold text-xs">Brown Noise</div>
                    <div className="text-[10px] opacity-70">Deep work</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleSound('rain')}
                  className={`p-2.5 rounded-lg border text-left flex flex-col justify-between h-20 transition-all ${
                    activeSound === 'rain' && isPlaying
                      ? 'bg-zinc-100 text-zinc-950 border-white font-medium shadow-md'
                      : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <CloudRain className="w-4 h-4 text-zinc-400" />
                  <div>
                    <div className="font-semibold text-xs">Rain Ambience</div>
                    <div className="text-[10px] opacity-70">Gentle storm</div>
                  </div>
                </button>
              </div>

              {/* Master Volume Slider */}
              <div className="pt-2 flex items-center gap-3">
                <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-200"
                />
                <span className="font-mono text-[10px] text-zinc-400 w-8">{Math.round(volume * 100)}%</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] text-zinc-400">
                Playing in background. Audio continues uninterrupted when minimized.
              </div>
              {/* Custom Spotify Playlist Input */}
              <form onSubmit={handleApplyCustomSpotify} className="flex gap-2">
                <input
                  type="url"
                  placeholder="Paste Spotify album/playlist URL..."
                  value={customSpotifyUrl}
                  onChange={(e) => setCustomSpotifyUrl(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-xs transition-colors shrink-0"
                >
                  Load
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Permanently Mounted Background Spotify Iframe Layer */}
      {/* Kept mounted in the DOM so closing/minimizing the popover never stops Spotify playback! */}
      <div
        className={`fixed z-40 transition-all duration-200 ${
          isOpen && audioSource === 'spotify'
            ? 'top-16 right-4 sm:right-6 w-80 sm:w-96 p-3 rounded-xl antigravity-glass border border-white/10 shadow-2xl block'
            : 'top-[-9999px] left-[-9999px] w-[1px] h-[1px] opacity-0 pointer-events-none'
        }`}
      >
        <div className="rounded-lg overflow-hidden border border-zinc-800 bg-black">
          <iframe
            style={{ borderRadius: '12px' }}
            src={spotifyEmbedUrl}
            width="100%"
            height={isOpen && audioSource === 'spotify' ? '152' : '1'}
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            title="Spotify Player"
          />
        </div>
      </div>
    </div>
  );
};
