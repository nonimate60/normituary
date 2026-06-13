const TREASURY = '0xcaFE2E35cA942c6e4B81713b9C893aB546ac9BA4';

export default function Deflationary() {
  return (
    <section className="deflationary" id="deflationary">
      <div className="field-label">
        <span>// deflationary by design</span>
        <span>treasury &middot; on-chain</span>
      </div>
      <div className="deflationary-body">
        <blockquote className="deflationary-quote">
          &ldquo;every Remembrance funds the next departure&rdquo;
        </blockquote>
        <p>
          Every public Remembrance minted at 0.01 ETH flows directly to the
          normituary treasury:{' '}
          <a
            className="treasury-addr"
            href={`https://etherscan.io/address/${TREASURY}`}
            target="_blank"
            rel="noreferrer"
          >
            {TREASURY}
          </a>
          .
        </p>
        <p>
          The treasury carries a single commitment: whenever its balance covers
          the current Normies floor plus gas, it sweeps the cheapest available
          Normie and burns it. Every mint funds the next departure.
        </p>
        <p>
          The loop is intentional. Public demand for Remembrances reduces the
          supply of living Normies, which in turn creates new departed to be
          remembered. The collection consumes itself slowly, on-chain, forever.
        </p>
        <p>
          All treasury transactions are publicly verifiable on{' '}
          <a
            href={`https://etherscan.io/address/${TREASURY}`}
            target="_blank"
            rel="noreferrer"
          >
            Etherscan
          </a>
          .
        </p>
      </div>
    </section>
  );
}
