import { useEffect, useRef } from 'react';
import { getApi } from './api.js';

function drawPlaceholder(canvas, seed) {
  canvas.width = 40; canvas.height = 40;
  const ctx = canvas.getContext('2d');
  let s = (seed || 1) + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  ctx.fillStyle = '#e3e5e4'; ctx.fillRect(0, 0, 40, 40);
  ctx.fillStyle = '#48494b';
  const px = (x, y) => ctx.fillRect(x, y, 1, 1);
  for (let y = 6; y < 36; y++) for (let x = 8; x < 32; x++) {
    const dx = (x - 20) / 11, dy = (y - 21) / 14, d = dx * dx + dy * dy;
    if (d < 1 && d > 0.82) px(x, y);
  }
  for (let y = 5; y < 12; y++) for (let x = 9; x < 31; x++) {
    const dx = (x - 20) / 11, dy = (y - 21) / 14;
    if (dx * dx + dy * dy < 1 && rnd() > 0.45) px(x, y);
  }
  const ey = 17 + Math.floor(rnd() * 2);
  [[14, ey], [24, ey]].forEach(([x, y]) => { px(x, y); px(x + 1, y); px(x, y + 1); px(x + 1, y + 1); });
  px(19, 24); px(20, 24);
  for (let x = 16; x < 24; x++) px(x, 29);
}

export function Portrait({ tokenId }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';
    const img = new Image();
    img.src = `${getApi()}/history/burned/${tokenId}/image.svg`;
    img.alt = `Normie #${tokenId}`;
    img.onerror = () => {
      img.remove();
      const c = document.createElement('canvas');
      drawPlaceholder(c, Number(tokenId));
      container.appendChild(c);
    };
    container.appendChild(img);
  }, [tokenId]);

  return <span ref={containerRef} style={{ display: 'contents' }} />;
}
