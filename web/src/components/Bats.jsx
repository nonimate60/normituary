import { useEffect, useRef, useState } from 'react';
import { playHit } from '../audio.js';

const SPAWN_COUNT = 6;
const SPEED_MIN = 60;   // px / sec
const SPEED_MAX = 140;
const SIZE = 28;        // px

const BAT_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 8" shape-rendering="crispEdges">
  <g fill="#48494b">
    <rect x="2" y="1" width="1" height="1"/>
    <rect x="11" y="1" width="1" height="1"/>
    <rect x="3" y="2" width="2" height="1"/>
    <rect x="9" y="2" width="2" height="1"/>
    <rect x="6" y="2" width="2" height="1"/>
    <rect x="1" y="3" width="12" height="1"/>
    <rect x="2" y="4" width="10" height="1"/>
    <rect x="3" y="5" width="2" height="1"/>
    <rect x="9" y="5" width="2" height="1"/>
    <rect x="6" y="5" width="2" height="1"/>
  </g>
</svg>
`).replace(/%20/g, ' ');

const BAT_DEAD_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 8" shape-rendering="crispEdges">
  <g fill="#48494b">
    <rect x="1" y="3" width="12" height="1"/>
    <rect x="2" y="4" width="10" height="1"/>
    <rect x="6" y="2" width="2" height="1"/>
    <rect x="5" y="5" width="1" height="1"/>
    <rect x="8" y="5" width="1" height="1"/>
  </g>
</svg>
`).replace(/%20/g, ' ');

function randBat(id, w, h) {
  const fromLeft = Math.random() < 0.5;
  const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
  return {
    id,
    x: fromLeft ? -SIZE : w + SIZE,
    y: 40 + Math.random() * Math.max(80, h - 200),
    vx: (fromLeft ? 1 : -1) * speed,
    vy: 0,
    dying: false,
    flap: Math.random() * Math.PI * 2,
  };
}

export default function Bats() {
  const [bats, setBats] = useState([]);
  const frameRef = useRef(0);
  const lastRef = useRef(0);
  const sizeRef = useRef({ w: window.innerWidth, h: window.innerHeight });
  const nextId = useRef(1);

  useEffect(() => {
    const onResize = () => {
      sizeRef.current = { w: window.innerWidth, h: window.innerHeight };
    };
    window.addEventListener('resize', onResize);

    setBats(Array.from({ length: SPAWN_COUNT }, () => {
      const { w, h } = sizeRef.current;
      return randBat(nextId.current++, w, h);
    }));

    const tick = (t) => {
      const last = lastRef.current || t;
      const dt = Math.min(0.05, (t - last) / 1000);
      lastRef.current = t;
      const { w, h } = sizeRef.current;

      setBats(prev => {
        const out = [];
        for (const b of prev) {
          let { x, y, vx, vy, dying, flap } = b;
          if (dying) {
            vy += 900 * dt;          // gravity
            x += vx * dt * 0.4;
            y += vy * dt;
            if (y > h + SIZE) continue;
            out.push({ ...b, x, y, vx, vy, flap });
          } else {
            flap += dt * 12;
            x += vx * dt;
            y += Math.sin(flap * 0.6) * 18 * dt;
            const off = (vx > 0 && x > w + SIZE * 2) || (vx < 0 && x < -SIZE * 2);
            if (off) {
              out.push(randBat(b.id, w, h));
            } else {
              out.push({ ...b, x, y, flap });
            }
          }
        }
        // top up if we lost some
        while (out.length < SPAWN_COUNT) {
          out.push(randBat(nextId.current++, w, h));
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
    setBats(prev => prev.map(b => b.id === id
      ? { ...b, dying: true, vx: b.vx * 0.2, vy: -120 }
      : b));
  }

  return (
    <div className="bats-layer" aria-hidden="true">
      {bats.map(b => (
        <button
          key={b.id}
          type="button"
          className={`bat${b.dying ? ' dead' : ''}`}
          style={{
            transform: `translate(${b.x}px, ${b.y}px) scaleX(${b.vx < 0 ? -1 : 1})`,
            backgroundImage: `url("data:image/svg+xml;charset=utf-8,${b.dying ? BAT_DEAD_SVG : BAT_SVG}")`,
          }}
          onClick={(e) => { e.stopPropagation(); if (!b.dying) kill(b.id); }}
          tabIndex={-1}
        />
      ))}
    </div>
  );
}
