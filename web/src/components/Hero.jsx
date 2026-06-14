import { useState } from 'react';
import { jget, fmtDate, getApi } from '../api.js';

export default function Hero({ stats, onFeatured, searchMsg, setSearchMsg }) {
  const [value, setValue] = useState('');

  async function search() {
    const raw = value.trim();
    const id = Number(raw);
    if (raw === '' || !Number.isInteger(id) || id < 0 || id > 9999) {
      setSearchMsg('enter a token id between 0 and 9999');
      return;
    }
    setSearchMsg(`searching for normie #${id}…`);
    try {
      const info = await jget(`${getApi()}/history/burned/${id}`);
      const commitId = info.commitId ?? info.commit_id;
      let died = '—';
      try {
        const commit = await jget(`${getApi()}/history/burns/${commitId}`);
        died = fmtDate(commit.timestamp);
      } catch (_) { /* */ }
      const token = {
        tokenId: id,
        pixelCount: info.pixelCount ?? info.pixel_count ?? '—',
        commitId, died,
      };
      setSearchMsg(`normie #${id} rests here — burned ${died}`);
      onFeatured(token, true);
    } catch (err) {
      setSearchMsg(err.status === 404
        ? `normie #${id} is not among the departed — still alive, unminted, or unrevealed`
        : `search failed (${err.message}) — try again`);
    }
  }

  return (
    <header>
      <h1>normituary</h1>
      <p className="sub">in memory of the burned Normies &mdash; on-chain, forever</p>
      <div className="stats">
        <div className="stat"><b>{stats.dead}</b>departed</div>
        <div className="stat remembered"><b>{stats.remembered}</b>remembered</div>
        <div className="stat"><b>{stats.alive}</b>remain</div>
        <div className="stat"><b>{stats.points}</b>points bequeathed</div>
      </div>
      <div className="search-row">
        <input
          type="number" min="0" max="9999"
          placeholder="search a burned normie by # (0–9999)"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') search(); }}
        />
        <button onClick={search}>find</button>
      </div>
      <div className="search-msg">{searchMsg}</div>
      <div className="intro">
        <div className="intro-logo-wrap">
          <img className="intro-logo" src="/logo.png" alt="normituary" />
        </div>
        <div className="intro-copy">
          <p>When a Normie is burned, it leaves the collection. Its portrait,
             however, is written into SSTORE2 and remains on-chain forever.
             normituary preserves that record.</p>
          <p>Every departed Normie enters a 30-day mourning period. During that
             window, the original burner may claim a free Remembrance: a
             certificate of passage, minted in their name. After 30 days, the
             Remembrance opens to anyone for 0.02 ETH.</p>
          <p>For the first 30 days after launch, all previously burned Normies
             are in mourning.</p>
          <p>
            <a href="#deflationary" className="intro-link">
              All proceeds go to the rebuy &amp; burn deflationary concept of the normituary.
            </a>
          </p>
        </div>
      </div>
    </header>
  );
}
