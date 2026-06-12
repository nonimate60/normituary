import { useEffect, useState } from 'react';
import Tombstone from './Tombstone.jsx';
import { jget, expandCommit, getApi } from '../api.js';

const TX_BASE = 'https://sepolia.etherscan.io/tx/';

function shortHash(h) {
  return h ? `${h.slice(0, 8)}…${h.slice(-6)}` : '';
}

function MintBanner({ mintState }) {
  if (!mintState || (mintState.total === 0 && !mintState.error)) return null;
  const { inFlight, current, total, currentTokenId, results, done, error } = mintState;

  if (inFlight) {
    return (
      <div className="mine-empty">
        paying respects {current}/{total}
        {currentTokenId != null && <> &middot; minting #{currentTokenId}…</>}
      </div>
    );
  }

  if (done) {
    const successes = results.filter(r => r.status === 'success');
    const failures = results.filter(r => r.status === 'failed');
    return (
      <div className="mine-empty">
        <div>
          {successes.length} of {total} succeeded
          {failures.length > 0 && <> &middot; {failures.length} failed</>}
          {error && total === 0 && <>: {error}</>}
        </div>
        {successes.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {successes.map(r => (
              <span key={r.hash} style={{ marginRight: 12 }}>
                #{r.tokenId}{' '}
                <a href={`${TX_BASE}${r.hash}`} target="_blank" rel="noreferrer">
                  {shortHash(r.hash)}
                </a>
              </span>
            ))}
          </div>
        )}
        {failures.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {failures.map(r => (
              <div key={`${r.tokenId}-${r.error}`}>
                #{r.tokenId} &mdash; {r.error}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default function MineSection({ address, onPayRespects, mintState }) {
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
  const minting = !!mintState?.inFlight;

  return (
    <section>
      <div className="field-label">
        <span>{status}</span>
        <span className="mine-toolbar">
          <button onClick={toggleAll} disabled={tokens.length === 0 || minting}>
            {allSelected ? 'clear selection' : 'select all'}
          </button>
          <button
            disabled={n === 0 || minting}
            onClick={() => onPayRespects([...selected])}
          >
            {minting
              ? `paying respects ${mintState.current}/${mintState.total}…`
              : `pay respects for selected (${n})`}
          </button>
        </span>
      </div>
      <MintBanner mintState={mintState} />
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
