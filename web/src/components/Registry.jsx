import Tombstone from './Tombstone.jsx';
import { PAGE_SIZE } from '../api.js';

export default function Registry({ status, page, tokens, exhausted, loading, onPrev, onNext, onSelect }) {
  const slice = tokens.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageInfo = loading
    ? `page ${page + 1} — loading…`
    : `page ${page + 1}${exhausted ? ` of ${Math.max(1, Math.ceil(tokens.length / PAGE_SIZE))}` : ''}`;

  return (
    <>
      <div className="field-label" id="field">
        <span dangerouslySetInnerHTML={{ __html: status }} />
        <span>source: NormiesCanvas &middot; SSTORE2</span>
      </div>
      <section className="grid">
        {slice.map(t => (
          <Tombstone
            key={`${t.commitId}-${t.tokenId}`}
            token={t}
            onClick={() => onSelect(t, true)}
          />
        ))}
      </section>
      <div className="pager">
        <button disabled={page === 0 || loading} onClick={onPrev}>&larr; prev</button>
        <span className="page-info">{pageInfo}</span>
        <button disabled={loading || tokens.length <= (page + 1) * PAGE_SIZE} onClick={onNext}>next &rarr;</button>
      </div>
    </>
  );
}
