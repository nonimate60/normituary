import { Portrait } from '../portraits.jsx';

export default function Memorial({ token, onMint }) {
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
        <button className="mint-btn" onClick={() => token && onMint(token)}>pay respects</button>
      </div>
    </section>
  );
}
