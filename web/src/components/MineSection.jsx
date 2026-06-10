import { useEffect, useState } from 'react';
import Tombstone from './Tombstone.jsx';
import { jget, expandCommit, getApi } from '../api.js';

export default function MineSection({ address, onPayRespects }) {
  const [tokens, setTokens] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [status, setStatus] = useState('// your departed');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setTokens([]);
      setSelected(new Set());
      setError(null);
      setLoading(true);
      setStatus(`// your departed — loading for ${address.slice(0, 6)}…${address.slice(-4)}`);
      try {
        const commits = await jget(`${getApi()}/history/burns/address/${address}?limit=100`);
        const all = [];
        for (const b of (Array.isArray(commits) ? commits : [])) {
          if (!b.revealed || b.expired) continue;
          all.push(...await expandCommit(b));
        }
        if (cancelled) return;
        setTokens(all);
        setStatus(all.length === 0
          ? '// your departed — none found'
          : `// your departed — ${all.length} normie${all.length > 1 ? 's' : ''} mourned by this wallet`);
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setStatus('// your departed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [address]);

  function toggle(tokenId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(tokenId)) next.delete(tokenId);
      else next.add(tokenId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev => {
      if (prev.size === tokens.length && tokens.length > 0) return new Set();
      return new Set(tokens.map(t => t.tokenId));
    });
  }

  const n = selected.size;
  const allSelected = n === tokens.length && n > 0;

  return (
    <section>
      <div className="field-label">
        <span>{status}</span>
        <span className="mine-toolbar">
          <button onClick={toggleAll} disabled={tokens.length === 0}>
            {allSelected ? 'clear selection' : 'select all'}
          </button>
          <button
            disabled={n === 0}
            onClick={() => onPayRespects([...selected])}
          >
            pay respects for selected ({n})
          </button>
        </span>
      </div>
      {error && (
        <div className="mine-empty">could not load your burn history ({error})</div>
      )}
      {!error && !loading && tokens.length === 0 && (
        <div className="mine-empty">
          no departed normies found for this wallet &mdash;
          burn one via <a href="https://normies.art" target="_blank" rel="noreferrer">normies.art</a> to begin mourning
        </div>
      )}
      {tokens.length > 0 && (
        <div className="grid">
          {tokens.map(t => (
            <Tombstone
              key={`${t.commitId}-${t.tokenId}`}
              token={t}
              selectable
              selected={selected.has(t.tokenId)}
              onClick={() => toggle(t.tokenId)}
              onRespect={() => onPayRespects([t.tokenId])}
            />
          ))}
        </div>
      )}
    </section>
  );
}
