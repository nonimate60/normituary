import { useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';

import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import MineSection from './components/MineSection.jsx';
import Registry from './components/Registry.jsx';
import Memorial from './components/Memorial.jsx';

import { pickApi, jget, expandCommit, getApi, fmtNum, PAGE_SIZE, COMMIT_BATCH } from './api.js';

const DEMO = [
  { tokenId: 42, died: 'Mar 02, 2026', pixelCount: 490, commitId: 'demo' },
  { tokenId: 871, died: 'Mar 19, 2026', pixelCount: 533, commitId: 'demo' },
  { tokenId: 3204, died: 'Apr 27, 2026', pixelCount: 612, commitId: 'demo' },
  { tokenId: 7777, died: 'May 30, 2026', pixelCount: 501, commitId: 'demo' },
  { tokenId: 128, died: 'Jun 03, 2026', pixelCount: 548, commitId: 'demo' },
  { tokenId: 5050, died: 'Jun 07, 2026', pixelCount: 495, commitId: 'demo' },
];

export default function App() {
  const { address, isConnected } = useAccount();

  const [stats, setStats] = useState({ dead: '—', alive: '—', points: '—' });
  const [tokens, setTokens] = useState([]);
  const [page, setPage] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('// loading the registry of departures…');
  const [featured, setFeatured] = useState(null);
  const [searchMsg, setSearchMsg] = useState('');

  const regRef = useRef({ commitOffset: 0, exhausted: false, tokens: [] });
  const bootedRef = useRef(false);

  async function ensureTokens(count) {
    const reg = regRef.current;
    while (reg.tokens.length < count && !reg.exhausted) {
      const batch = await jget(`${getApi()}/history/burns?limit=${COMMIT_BATCH}&offset=${reg.commitOffset}`);
      reg.commitOffset += COMMIT_BATCH;
      if (!Array.isArray(batch) || batch.length === 0) { reg.exhausted = true; break; }
      if (batch.length < COMMIT_BATCH) reg.exhausted = true;
      for (const b of batch) {
        if (!b.revealed || b.expired) continue;
        reg.tokens.push(...await expandCommit(b));
      }
    }
    setTokens([...reg.tokens]);
    setExhausted(reg.exhausted);
  }

  async function goToPage(p) {
    setLoading(true);
    await ensureTokens((p + 1) * PAGE_SIZE + 1);
    const reg = regRef.current;
    if (reg.tokens.length === 0 && p > 0) {
      setLoading(false);
      return goToPage(p - 1);
    }
    setPage(p);
    setLoading(false);
  }

  function payRespects(tokenIds) {
    const list = tokenIds.map(t => '#' + t).join(', ');
    setSearchMsg(`pay respects → would mint ${tokenIds.length} memorial(s) for ${list} — contract integration pending`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleFeatured(token, scroll) {
    if (!token) return;
    setFeatured(token);
    if (scroll) {
      requestAnimationFrame(() => {
        document.getElementById('memorial')?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    (async () => {
      try {
        await pickApi();
        const s = await jget(`${getApi()}/history/stats`);
        const dead = Number(s.totalBurnedTokens);
        setStats({
          dead: fmtNum(dead),
          alive: fmtNum(10000 - dead),
          points: fmtNum(s.totalActionPointsDistributed),
        });
        await ensureTokens(PAGE_SIZE + 1);
        setPage(0);
        setLoading(false);
        const reg = regRef.current;
        if (reg.tokens[0]) setFeatured(reg.tokens[0]);
        const api = getApi();
        setStatus(`// registry of departures &mdash; live via ${api.includes('142.93') || api.includes('yourdomain') ? 'vps cache' : 'direct api'}, ${fmtNum(dead)} burned &middot; newest first`);
      } catch (err) {
        console.warn('Falling back to demo mode:', err);
        const demoTokens = DEMO.slice().reverse();
        regRef.current.tokens = demoTokens;
        regRef.current.exhausted = true;
        setTokens(demoTokens);
        setExhausted(true);
        setPage(0);
        setLoading(false);
        setFeatured(demoTokens[0]);
        setStats({ dead: '1,897', alive: '8,103', points: '14,205' });
        setStatus('// DEMO MODE &mdash; placeholder data (API unreachable from the browser; a VPS cache proxy fixes this in production)');
      }
    })();
  }, []);

  return (
    <div className="wrap">
      <Nav />
      <Hero
        stats={stats}
        onFeatured={handleFeatured}
        searchMsg={searchMsg}
        setSearchMsg={setSearchMsg}
      />
      {isConnected && address && (
        <MineSection address={address} onPayRespects={payRespects} />
      )}
      <Registry
        status={status}
        page={page}
        tokens={tokens}
        exhausted={exhausted}
        loading={loading}
        onPrev={() => goToPage(page - 1)}
        onNext={() => goToPage(page + 1)}
        onSelect={handleFeatured}
      />
      <Memorial token={featured} onMint={(t) => payRespects([t.tokenId])} />
      <footer>
        <span>normituary &middot; on-chain data via api.normies.art &middot; CC0</span>
        <span>built by the community</span>
      </footer>
    </div>
  );
}
