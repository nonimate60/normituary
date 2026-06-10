const API_CANDIDATES = [
  'http://142.93.51.73:8080',
  'https://api.normies.art',
];

export const PAGE_SIZE = 12;
export const COMMIT_BATCH = 20;

let API = API_CANDIDATES[API_CANDIDATES.length - 1];

export const getApi = () => API;

export async function pickApi() {
  for (const base of API_CANDIDATES) {
    try {
      const r = await fetch(base + '/history/stats', { signal: AbortSignal.timeout(4000) });
      if (r.ok) { API = base; return; }
    } catch (_) { /* next */ }
  }
}

export const fmtDate = ts => new Date(Number(ts) * 1000)
  .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

export const fmtNum = n => Number(n).toLocaleString('en-US');

export async function jget(url) {
  const r = await fetch(url);
  if (!r.ok) throw Object.assign(new Error(`${r.status} at ${url}`), { status: r.status });
  return r.json();
}

export async function expandCommit(b) {
  const detail = await jget(`${API}/history/burns/${b.commitId}`);
  return (detail.burnedTokens || []).map(t => ({
    tokenId: t.tokenId,
    pixelCount: t.pixelCount,
    commitId: b.commitId,
    died: fmtDate(b.timestamp),
  }));
}
