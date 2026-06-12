import { useEffect, useRef, useState } from 'react';
import { playClick } from '../audio.js';

const TRACK = '/8-bit Mystical by MisocStock.mp3';

export default function AudioPlayer() {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnd = () => setPlaying(false);
    const onErr = () => setAvailable(false);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onErr);
    return () => {
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onErr);
    };
  }, []);

  function toggle() {
    playClick();
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().then(() => setPlaying(true)).catch(() => setAvailable(false));
    }
  }

  if (!available) return null;

  return (
    <>
      <audio ref={audioRef} src={TRACK} loop preload="none" />
      <button
        type="button"
        className={`audio-btn${playing ? ' playing' : ''}`}
        onClick={toggle}
        title={playing ? 'pause music' : 'play music'}
        aria-label={playing ? 'pause music' : 'play music'}
      >
        <span aria-hidden="true">{playing ? '■' : '▶'}</span>
        <span className="audio-label">{playing ? 'pause' : 'play'}</span>
      </button>
    </>
  );
}
