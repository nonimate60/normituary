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

    a.volume = 0.5;
    let unlock = null;
    a.play().then(() => setPlaying(true)).catch(() => {
      unlock = () => {
        a.play().then(() => setPlaying(true)).catch(() => {});
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
      };
      document.addEventListener('pointerdown', unlock, { once: true });
      document.addEventListener('keydown', unlock, { once: true });
    });

    return () => {
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onErr);
      if (unlock) {
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
      }
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
      <audio ref={audioRef} src={TRACK} loop preload="auto" />
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
