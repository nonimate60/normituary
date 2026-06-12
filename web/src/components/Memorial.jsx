import { Portrait } from '../portraits.jsx';

const TX_BASE = 'https://sepolia.etherscan.io/tx/';

function shortHash(h) {
  return h ? `${h.slice(0, 8)}…${h.slice(-6)}` : '';
}

function mintStatusFor(token, mintState) {
  if (!token || !mintState) return null;
  const id = token.tokenId;
  const isCurrent = mintState.inFlight && mintState.currentTokenId === id;
  if (isCurrent) {
    return { kind: 'loading', text: `paying respects for #${id}… (${mintState.current}/${mintState.total})` };
  }
  const result = (mintState.results || []).slice().reverse().find(r => r.tokenId === id);
  if (!result) return null;
  if (result.status === 'success') {
    return { kind: 'success', text: `respects paid (${result.phase}) — tx ${shortHash(result.hash)}`, hash: result.hash };
  }
  return { kind: 'error', text: `mint failed: ${result.error}` };
}

export default function Memorial({ token, onMint, mintState }) {
  const status = mintStatusFor(token, mintState);
  const disabled = mintState?.inFlight;

  return (
    <section className="memorial" id="memorial">
      <div className="portrait-side">
        {token && <Portrait tokenId={token.tokenId} />}
      </div>
      <div className="info">
        <h2>{token ? `Remember Normie #${token.tokenId}` : 'Remember Normie'}</h2>
        <div
          className="lived"
          dangerouslySetInnerHTML={{
            __html: token
              ? `b. Feb 2026 &nbsp;&dagger;&nbsp; ${token.died} &nbsp;&middot;&nbsp; ${token.pixelCount} pixels`
              : '&mdash;',
          }}
        />
        <p>Every burned Normie leaves its portrait written into SSTORE2 &mdash;
           readable on-chain even after its passing. The Remembrance is the
           certificate of that passage: the original image, the dates, and a
           record of who carried it to the end.</p>
        <div className="phases">
          <div className="phase live">
            <span>mourning period &middot; 30 days</span>
            <span>burner only &middot; free</span>
          </div>
          <div className="phase">
            <span>open remembrance</span>
            <span>public &middot; 0.01 ETH</span>
          </div>
        </div>
        <button
          className="mint-btn"
          disabled={disabled}
          onClick={() => token && onMint(token)}
        >
          {disabled && status?.kind === 'loading' ? 'paying respects…' : 'pay respects'}
        </button>
        {status && (
          <div className="search-msg">
            {status.kind === 'success' ? (
              <>
                {status.text} &middot;{' '}
                <a href={`${TX_BASE}${status.hash}`} target="_blank" rel="noreferrer">view on etherscan</a>
              </>
            ) : status.text}
          </div>
        )}
      </div>
    </section>
  );
}
