import { useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';

import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import MineSection from './components/MineSection.jsx';
import Registry from './components/Registry.jsx';
import Memorial from './components/Memorial.jsx';
import Bats from './components/Bats.jsx';
import Deflationary from './components/Deflationary.jsx';

import { jget, expandCommit, getApi, fmtNum, PAGE_SIZE, COMMIT_BATCH } from './api.js';
import { usePayRespects } from './hooks/usePayRespects.js';

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
  const { payRespectsBatch } = usePayRespects();

  const [stats, setStats] = useState({ dead: '—', alive: '—', points: '—' });
  const [tokens, setTokens] = useState([]);
  const [page, setPage] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('// loading the registry of departures…');
  const [featured, setFeatured] = useState(null);
  const [searchMsg, setSearchMsg] = useState('');
  const [mintState, setMintState] = useState({
    inFlight: false,
    current: 0,
    total: 0,
    currentTokenId: null,
    results: [],
    error: null,
    done: false,
  });

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

  async function payRespects(tokenIds) {
    if (!Array.isArray(tokenIds) || tokenIds.length === 0) return;
    if (!isConnected || !address) {
      setMintState({
        inFlight: false, current: 0, total: 0, currentTokenId: null,
        results: [], error: 'connect your wallet to pay respects', done: true,
      });
      return;
    }

    const total = tokenIds.length;
    setMintState({
      inFlight: true, current: 0, total, currentTokenId: null,
      results: [], error: null, done: false,
    });

    try {
      const { results, validCount } = await payRespectsBatch({
        normieIds: tokenIds,
        burnerAddress: address,
        onProgress: ({ stage, tokenId, count }) => {
          if (stage === 'fetching-vouchers') {
            setMintState(s => ({ ...s, currentTokenId: null, current: 0 }));
          } else if (stage === 'batch-tx') {
            setMintState(s => ({ ...s, currentTokenId: null, current: count }));
          } else if (stage === 'single-tx') {
            setMintState(s => ({ ...s, currentTokenId: tokenId, current: s.current + 1 }));
          }
        },
      });

      const error = validCount === 0 ? 'no memorials available to claim' : null;
      setMintState({
        inFlight: false, current: total, total, currentTokenId: null,
        results, error, done: true,
      });
    } catch (err) {
      const msg = err?.shortMessage || err?.message || String(err);
      setMintState({
        inFlight: false, current: 0, total, currentTokenId: null,
        results: [], error: msg, done: true,
      });
    }
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
        setStatus(`// registry of departures &mdash; live, ${fmtNum(dead)} burned &middot; newest first`);
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
        setStatus('// DEMO MODE &mdash; placeholder data (backend unreachable)');
      }
    })();
  }, []);

  return (
    <div className="wrap">
      <Bats />
      <Nav />
      <Hero
        stats={stats}
        onFeatured={handleFeatured}
        searchMsg={searchMsg}
        setSearchMsg={setSearchMsg}
      />
      {isConnected && address && (
        <MineSection
          address={address}
          onPayRespects={payRespects}
          mintState={mintState}
        />
      )}
      <Memorial
        token={featured}
        onMint={(t) => payRespects([t.tokenId])}
        mintState={mintState}
      />
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
      <Deflationary />
      <footer>
        <span>normituary &middot; on-chain data &middot; CC0</span>
        <span>built by the community</span>
      </footer>
    </div>
  );
}
