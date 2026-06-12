import { useEffect, useRef, useState } from 'react';
import { playHit } from '../audio.js';

const SPAWN_COUNT = 3;
const SPEED_MIN = 130;   // px / sec
const SPEED_MAX = 200;
const WIDTH = 36;
const HEIGHT = 22;

// Two pixel-art wing positions (down / up). 18x11 grid, ink color.
function batSvg(frame) {
  const grids = {
    down: [
      '..XX..........XX..',
      '.XXXX........XXXX.',
      'XXXXXX.XXXX.XXXXXX',
      '.XXXXXXXXXXXXXXXX.',
      '..XXXXXXXXXXXXXX..',
      '...XXXX.XXXX.XX...',
      '......X.XX..X.....',
      '..................',
      '..................',
      '..................',
      '..................',
    ],
    up: [
      'XXX............XXX',
      '.XXXX..........XXX',
      '..XXXX..XXXX..XXX.',
      '...XXXXXXXXXXXXX..',
      '...XXXXXXXXXXXXX..',
      '....XXXXXXXXXXX...',
      '.....XXXXXXXXX....',
      '......XXX.XXX.....',
      '......X.X.X.X.....',
      '..................',
      '..................',
    ],
  };
  const rows = grids[frame];
  let rects = '';
  for (let y = 0; y < rows.length; y++) {
    let x = 0;
    while (x < rows[y].length) {
      if (rows[y][x] === 'X') {
        let w = 1;
        while (rows[y][x + w] === 'X') w++;
        rects += `<rect x="${x}" y="${y}" width="${w}" height="1"/>`;
        x += w;
      } else x++;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 11" shape-rendering="crispEdges"><g fill="#48494b">${rects}</g></svg>`;
  return encodeURIComponent(svg).replace(/%20/g, ' ');
}
const FRAME_DOWN = batSvg('down');
const FRAME_UP = batSvg('up');
const FRAME_DEAD = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 11" shape-rendering="crispEdges"><g fill="#48494b">` +
  `<rect x="2" y="6" width="14" height="1"/>` +
  `<rect x="3" y="7" width="12" height="1"/>` +
  `<rect x="8" y="4" width="2" height="1"/>` +
  `<rect x="6" y="8" width="1" height="1"/>` +
  `<rect x="11" y="8" width="1" height="1"/>` +
  `</g></svg>`
).replace(/%20/g, ' ');

function randHeading() {
  return Math.random() * Math.PI * 2;
}

function spawnBat(id, w, h) {
  const angle = randHeading();
  const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
  // start somewhere off-screen on a random edge
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0)      { x = -WIDTH; y = Math.random() * h; }
  else if (side === 1) { x = w + WIDTH; y = Math.random() * h; }
  else if (side === 2) { x = Math.random() * w; y = -HEIGHT; }
  else                 { x = Math.random() * w; y = h + HEIGHT; }
  return {
    id, x, y, angle, speed,
    flapT: Math.random() * 0.2,
    flapUp: false,
    dying: false,
    vy: 0,
    vx: 0,
  };
}

export default function Bats() {
  const [bats, setBats] = useState([]);
  const frameRef = useRef(0);
  const lastRef = useRef(0);
  const sizeRef = useRef({ w: window.innerWidth, h: window.innerHeight });
  const nextId = useRef(1);

  useEffect(() => {
    const onResize = () => { sizeRef.current = { w: window.innerWidth, h: window.innerHeight }; };
    window.addEventListener('resize', onResize);

    setBats(Array.from({ length: SPAWN_COUNT }, () => {
      const { w, h } = sizeRef.current;
      return spawnBat(nextId.current++, w, h);
    }));

    const tick = (t) => {
      const last = lastRef.current || t;
      const dt = Math.min(0.05, (t - last) / 1000);
      lastRef.current = t;
      const { w, h } = sizeRef.current;

      setBats(prev => {
        const out = [];
        for (const b of prev) {
          if (b.dying) {
            const vx = b.vx * Math.pow(0.4, dt);
            const vy = b.vy + 1100 * dt;
            const x = b.x + vx * dt;
            const y = b.y + vy * dt;
            if (y > h + HEIGHT) continue;
            out.push({ ...b, x, y, vx, vy, flapT: b.flapT });
            continue;
          }

          // wander: random angular drift
          let angle = b.angle + (Math.random() - 0.5) * dt * 3.5;

          // gentle steering back toward viewport if approaching edges
          const margin = 80;
          const cx = w / 2, cy = h / 2;
          if (b.x < margin || b.x > w - margin || b.y < margin || b.y > h - margin) {
            const toCenter = Math.atan2(cy - b.y, cx - b.x);
            // blend current heading toward center direction
            const diff = Math.atan2(Math.sin(toCenter - angle), Math.cos(toCenter - angle));
            angle += diff * Math.min(1, dt * 2);
          }

          const x = b.x + Math.cos(angle) * b.speed * dt;
          const y = b.y + Math.sin(angle) * b.speed * dt;

          // recycle if it drifts far off-screen anyway
          if (x < -WIDTH * 3 || x > w + WIDTH * 3 || y < -HEIGHT * 3 || y > h + HEIGHT * 3) {
            out.push(spawnBat(b.id, w, h));
            continue;
          }

          let flapT = b.flapT + dt;
          let flapUp = b.flapUp;
          if (flapT > 0.11) { flapT = 0; flapUp = !b.flapUp; }

          out.push({ ...b, x, y, angle, flapT, flapUp });
        }
        while (out.length < SPAWN_COUNT) {
          out.push(spawnBat(nextId.current++, w, h));
        }
        return out;
      });

      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  function kill(id) {
    playHit();
    setBats(prev => prev.map(b => {
      if (b.id !== id) return b;
      const vx = Math.cos(b.angle) * b.speed * 0.3;
      const vy = -180;
      return { ...b, dying: true, vx, vy };
    }));
  }

  return (
    <div className="bats-layer" aria-hidden="true">
      {bats.map(b => {
        const flipX = Math.cos(b.angle) < 0 ? -1 : 1;
        const sprite = b.dying ? FRAME_DEAD : (b.flapUp ? FRAME_UP : FRAME_DOWN);
        return (
          <button
            key={b.id}
            type="button"
            className={`bat${b.dying ? ' dead' : ''}`}
            style={{
              transform: `translate(${b.x}px, ${b.y}px) scaleX(${flipX})`,
              backgroundImage: `url("data:image/svg+xml;charset=utf-8,${sprite}")`,
            }}
            onClick={(e) => { e.stopPropagation(); if (!b.dying) kill(b.id); }}
            tabIndex={-1}
          />
        );
      })}
    </div>
  );
}
