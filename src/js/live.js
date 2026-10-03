import { records, isStated, isAddress } from './records.js';

const LLAMA = 'https://api.llama.fi/v2/chains';
const DEX = 'https://api.dexscreener.com/latest/dex';

async function getJson(fetchImpl, url, init, ms = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetchImpl(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Every external URL passes through here: https only, no credentials, exact host allow-list.
export const IMAGE_HOSTS = ['dd.dexscreener.com', 'cdn.dexscreener.com'];
export const LINK_HOSTS = ['dexscreener.com'];
export function safeUrl(raw, hosts) {
  if (typeof raw !== 'string' || raw.length > 600) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  return hosts.includes(u.hostname) ? u.href : null;
}

// One batched RPC round trip: height and gas price.
export async function readChain(fetchImpl = fetch) {
  const body = JSON.stringify([
    { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] },
    { jsonrpc: '2.0', id: 2, method: 'eth_gasPrice', params: [] },
  ]);
  const out = await getJson(fetchImpl, records.rpc.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  const byId = Object.fromEntries(out.map((r) => [r.id, r.result]));
  const block = Number(BigInt(byId[1]));
  const gasGwei = Number(BigInt(byId[2])) / 1e9;
  if (!Number.isFinite(block) || !Number.isFinite(gasGwei)) throw new Error('bad rpc');
  return { block, gasGwei };
}

export async function readTvl(fetchImpl = fetch) {
  const list = await getJson(fetchImpl, LLAMA);
  const hit = list.find((c) => c.name === records.llamaChain.value);
  if (!hit || typeof hit.tvl !== 'number') throw new Error('no tvl');
  return { tvl: hit.tvl };
}

// Chain-wide pairs by liquidity until a contract is stated, then that token's pairs.
export async function readPairs(fetchImpl = fetch, contractRecord = records.contract) {
  const scoped = isStated(contractRecord) && isAddress(contractRecord.value);
  const url = scoped
    ? `${DEX}/tokens/${contractRecord.value}`
    : `${DEX}/search?q=${encodeURIComponent(records.dexChain.value)}`;
  const data = await getJson(fetchImpl, url);
  const ranked = (data.pairs || [])
    .filter((p) => p.chainId === records.dexChain.value && p.liquidity && p.liquidity.usd > 0 && p.baseToken)
    .sort((a, b) => b.liquidity.usd - a.liquidity.usd);
  const seen = new Set();
  const tokens = [];
  for (const p of ranked) {
    const key = p.baseToken.address || p.baseToken.symbol;
    if (seen.has(key)) continue;
    seen.add(key);
    const price = Number(p.priceUsd);
    tokens.push({
      symbol: String(p.baseToken.symbol || '?').slice(0, 12),
      name: String(p.baseToken.name || p.baseToken.symbol || '').slice(0, 28),
      price: Number.isFinite(price) ? price : null,
      change: p.priceChange && typeof p.priceChange.h24 === 'number' ? p.priceChange.h24 : null,
      logo: safeUrl(p.info && p.info.imageUrl, IMAGE_HOSTS),
      url: safeUrl(p.url, LINK_HOSTS),
    });
    if (tokens.length === 12) break;
  }
  const rows = ranked
    .slice(0, 5)
    .map((p) => ({
      pair: `${p.baseToken.symbol}/${p.quoteToken.symbol}`,
      dex: p.dexId,
      liquidity: p.liquidity.usd,
      volume: (p.volume && p.volume.h24) || 0,
      change: p.priceChange && typeof p.priceChange.h24 === 'number' ? p.priceChange.h24 : null,
      url: safeUrl(p.url, LINK_HOSTS),
    }));
  return { scoped, rows, tokens };
}
