const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export const PAGE_SIZE = 12;
export const COMMIT_BATCH = 20;

export const getApi = () => API;

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
