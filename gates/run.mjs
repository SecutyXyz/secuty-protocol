// Gate runner. 30 gates max. Synthetic fixtures only; no live network.
// Static gates read src/dist; browser gates drive headless Edge over CDP with a faked fetch.
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);

const t0 = Date.now();
const results = [];
let gateNo = 0;
async function gate(name, fn) {
  gateNo++;
  const id = String(gateNo).padStart(2, '0');
  try {
    const note = await fn();
    results.push({ id, name, ok: true });
    console.log(`PASS ${id} ${name}${note ? ' â€” ' + note : ''}`);
  } catch (e) {
    results.push({ id, name, ok: false });
    console.log(`FAIL ${id} ${name}\n     ${String(e.message || e).split('\n').join('\n     ')}`);
  }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const rel = (p) => p.slice(ROOT.length + 1).replaceAll('\\', '/');
const srcFiles = walk(SRC);
const read = (p) => readFileSync(p, 'utf8');
const ofExt = (...e) => srcFiles.filter((f) => e.includes(extname(f)));

const rec = await import(pathToFileURL(join(SRC, 'js/records.js')));
const live = await import(pathToFileURL(join(SRC, 'js/live.js')));
const fmt = await import(pathToFileURL(join(SRC, 'js/format.js')));

/* ================= static / unit gates ================= */

await gate('dist contains the built site', () => {
  for (const f of ['index.html', 'styles/tokens.css', 'styles/main.css', 'js/main.js', 'assets/favicon.svg']) {
    assert(existsSync(join(DIST, f)), `dist/${f} missing`);
  }
});

await gate('repo hygiene: no agent files, no AI attribution', () => {
  const bad = [];
  const forbidden = ['CLAUDE' + '.md', '.cla' + 'ude'];
  const re = new RegExp(['cla' + 'ude', 'anthro' + 'pic', 'co-authored' + '-by', 'generated ' + 'with'].join('|'), 'i');
  for (const n of readdirSync(ROOT)) if (forbidden.includes(n)) bad.push(n);
  for (const f of [...srcFiles, ...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, 'gates')), join(ROOT, 'package.json')]) {
    if (f.endsWith('run.mjs') || f.endsWith('.json') && f.includes('fixtures')) continue;
    if (re.test(read(f))) bad.push(rel(f));
  }
  assert(!bad.length, 'found: ' + bad.join(', '));
});

await gate('palette: colour literals live only in tokens.css', () => {
  const bad = [];
  for (const f of ofExt('.css', '.js', '.html')) {
    if (f.endsWith('tokens.css')) continue;
    const s = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
    if (f.endsWith('.css') && /#[0-9a-fA-F]{3,8}\b/.test(s)) bad.push(rel(f) + ' hex');
    if (/\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\(/.test(s)) bad.push(rel(f) + ' colour fn');
    if (f.endsWith('.css') && /:\s*(white|black|red|green|blue|gray|grey|silver|yellow|orange)\b/i.test(s)) bad.push(rel(f) + ' named');
  }
  assert(!bad.length, bad.join('; '));
});

await gate('palette: every token is a sampled pixel (with provenance) or derived from one; favicon from the logo', () => {
  const t = read(join(SRC, 'styles/tokens.css'));
  assert(/k-means/i.test(t) && /nearest REAL pixel/.test(t), 'tokens file must state k-means + snap-to-pixel provenance');
  assert(!/UNSAMPLED|PLACEHOLDER/.test(t), 'tokens still flagged as placeholder');
  const lines = t.split('\n').filter((l) => /^\s*--[\w-]+:\s*#/.test(l));
  assert(lines.length >= 15, 'too few colour tokens: ' + lines.length);
  const sampled = new Set();
  for (const l of lines) {
    const [, name, hex] = l.match(/^\s*(--[\w-]+):\s*(#[0-9a-fA-F]+)/);
    assert(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex), `${name}: bad hex ${hex}`);
    const c = l.slice(l.indexOf('/*'));
    const real = /@ \(\d+,\d+\)/.test(c);
    const derived = /derived:|= --[\w-]+/.test(c);
    assert(real || derived, `${name} has no provenance comment`);
    if (real) sampled.add(hex.toLowerCase());
  }
  const svg = read(join(SRC, 'assets/favicon.svg'));
  assert(!/PLACEHOLDER/i.test(svg) && /Pixel grid/.test(svg) && /brand\/LOGO SECUTY/.test(svg), 'favicon must cite the logo it was built from');
  for (const [, h] of svg.matchAll(/#([0-9a-fA-F]{6})\b/g)) assert(sampled.has('#' + h.toLowerCase()), 'favicon colour #' + h + ' is not a sampled token');
  assert((svg.match(/<rect /g) || []).length > 200, 'favicon pixel grid looks empty');
  for (const f of ['logo-192.png', 'logo-512.png', 'cover.jpg']) assert(existsSync(join(SRC, 'assets', f)), f + ' missing');
});

await gate('no ch units; reduced-motion block neutralises animation and transition', () => {
  const bad = ofExt('.css', '.html', '.js').filter((f) => /\d(\.\d+)?ch\b/.test(read(f)));
  assert(!bad.length, 'ch units in ' + bad.map(rel).join(', '));
  const css = read(join(SRC, 'styles/main.css'));
  const m = css.match(/@media \(prefers-reduced-motion:reduce\)\{([\s\S]*)\}\s*$/);
  assert(m, 'no reduced-motion media block');
  assert(/animation:none!important/.test(m[1]) && /transition:none!important/.test(m[1]), 'blanket override missing');
  assert(/scroll-behavior:auto/.test(m[1]), 'smooth scroll not reset');
});

await gate('register: every record is stated | absent | unconfirmed and consistent', () => {
  for (const [k, r] of Object.entries(rec.records)) {
    assert(rec.STATES.includes(r.state), `${k}: bad state ${r.state}`);
    const has = r.value != null || !!r.url;
    if (r.state === 'absent') assert(!has, `${k}: absent record carries data`);
    if (r.state === 'stated') assert(has, `${k}: stated record is empty`);
  }
  for (const k of ['x', 'github']) assert(rec.records[k].state === 'absent', `${k} should be absent for now`);
  const c = rec.records.contract;
  assert(c.state === 'absent' || c.state === 'stated', 'contract must be absent or stated, was ' + c.state);
  if (c.state === 'stated') assert(rec.isAddress(c.value), 'stated contract is not a well-formed address');
});

await gate('0x gate: valid hex accepted in any case, bad input rejected, never blanket', () => {
  const lower = '0x' + 'ab12'.repeat(10);
  const upper = '0x' + 'AB12'.repeat(10);
  const mixed = '0x' + 'aB1c'.repeat(10);
  const zeros = '0x' + '0'.repeat(40);
  for (const ok of [lower, upper, mixed, zeros]) assert(rec.isAddress(ok), 'should accept ' + ok);
  for (const no of ['0x', '0x12', '0x' + 'g'.repeat(40), 'ab12'.repeat(10), '0x' + 'a'.repeat(41), '', null, 42]) {
    assert(!rec.isAddress(no), 'should reject ' + no);
  }
});

await gate('CA view: absent is inert with no date; stated is full and copyable', () => {
  const a = rec.caView({ state: 'absent', value: null });
  assert(a.kind === 'inert', 'absent must be inert');
  assert(!/\d{1,4}[-/.]\d{1,2}|\b(20\d\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(a.text), 'absent text must not carry a date');
  const addr = '0x' + 'Ab12'.repeat(10);
  const s = rec.caView({ state: 'stated', value: addr });
  assert(s.kind === 'copy' && s.text === addr, 'stated must show the full address as copyable');
  const u = rec.caView({ state: 'unconfirmed', value: addr });
  assert(u.kind === 'inert', 'unconfirmed must stay inert');
  const bad = rec.caView({ state: 'stated', value: '0x12' });
  assert(bad.kind === 'inert', 'malformed stated value must not be offered for copy');
});

await gate('link rule: no href unless stated; handle derived from stored URL', () => {
  assert(rec.linkView({ state: 'absent', url: 'https://x.com/someone' }).href === null, 'absent must not link even if a URL is lying around');
  assert(rec.linkView({ state: 'unconfirmed', url: 'https://x.com/someone' }).href === null, 'unconfirmed must not link');
  const ok = rec.linkView({ state: 'stated', url: 'https://x.com/secuty_xyz' });
  assert(ok.href === 'https://x.com/secuty_xyz' && ok.handle === 'secuty_xyz', 'stated must link and derive handle');
  assert(rec.handleOf('https://github.com/org/repo') === 'org', 'github handle');
  const html = read(join(SRC, 'index.html')) + read(join(SRC, 'js/main.js'));
  assert(!/https?:\/\/(www\.)?(x|twitter|github)\.com/.test(html), 'a social URL is hard-coded outside the records');
  assert(!/secuty_xyz/.test(html + read(join(SRC, 'js/live.js'))), 'a handle is hard-coded outside the records');
});

const FAKE = {
  block: '0x4b54cb9',
  gas: '0x192adf0',
  llama: [
    { name: 'Some Other Chain', tvl: 5 },
    { name: 'Robinhood Chain', tvl: 1048127045.43, chainId: 4663 },
  ],
  pair(sym, liq, chainId = 'robinhood', img = null) {
    return {
      chainId, dexId: 'testdex', url: `https://dexscreener.com/${chainId}/${sym.toLowerCase()}`,
      baseToken: { symbol: sym, name: sym + ' Token', address: '0x' + sym.padEnd(40, '0') },
      quoteToken: { symbol: 'WETH' }, priceUsd: '0.0123',
      info: img ? { imageUrl: img } : undefined,
      liquidity: { usd: liq }, volume: { h24: liq / 4 }, priceChange: { h24: 1.5 },
    };
  },
};
const fakeFetchFor = (calls) => async (url, init = {}) => {
  calls.push(String(url));
  const json = (d) => ({ ok: true, status: 200, json: async () => d });
  if (String(url).includes('rpc.mainnet')) {
    const batch = JSON.parse(init.body);
    return json(batch.map((r) => ({ jsonrpc: '2.0', id: r.id, result: r.method === 'eth_blockNumber' ? FAKE.block : FAKE.gas })));
  }
  if (String(url).includes('llama')) return json(FAKE.llama);
  if (String(url).includes('dexscreener')) {
    return json({ pairs: [FAKE.pair('LOW', 10), FAKE.pair('TOP', 9000), FAKE.pair('ELSE', 99999, 'other'), FAKE.pair('MID', 500)] });
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

await gate('live: RPC batch decoded to block and gwei', async () => {
  const r = await live.readChain(fakeFetchFor([]));
  assert(r.block === 0x4b54cb9, 'block ' + r.block);
  assert(Math.abs(r.gasGwei - 0x192adf0 / 1e9) < 1e-12, 'gas ' + r.gasGwei);
  await live.readChain(async () => ({ ok: false, status: 500, json: async () => ({}) })).then(
    () => { throw new Error('http 500 should throw'); },
    (e) => assert(/http 500/.test(e.message), 'wrong error ' + e.message),
  );
});

await gate('live: TVL picked by chain name; pairs filtered, sorted, scoped by record', async () => {
  const tvl = await live.readTvl(fakeFetchFor([]));
  assert(Math.abs(tvl.tvl - 1048127045.43) < 1e-6, 'tvl ' + tvl.tvl);
  const calls = [];
  const wide = await live.readPairs(fakeFetchFor(calls), { state: 'absent', value: null });
  assert(!wide.scoped && /search\?q=robinhood/.test(calls[0]), 'chain-wide search expected');
  assert(wide.rows.map((r) => r.pair).join() === 'TOP/WETH,MID/WETH,LOW/WETH', 'order/filter ' + wide.rows.map((r) => r.pair));
  const addr = '0x' + 'cD34'.repeat(10);
  const scoped = await live.readPairs(fakeFetchFor((calls.length = 0, calls)), { state: 'stated', value: addr });
  assert(scoped.scoped && calls[0].endsWith('/tokens/' + addr), 'token-scoped URL expected: ' + calls[0]);
  assert(wide.tokens.map((t) => t.symbol).join() === 'TOP,MID,LOW' && wide.tokens[0].price === 0.0123, 'marquee tokens ' + JSON.stringify(wide.tokens));
  const okImg = 'https://dd.dexscreener.com/ds-data/tokens/robinhood/a.png';
  assert(live.safeUrl(okImg, live.IMAGE_HOSTS) === okImg, 'good image URL rejected');
  for (const bad of ['javascript:alert(1)', 'data:image/png;base64,AA', 'http://dd.dexscreener.com/a.png', 'https://evil.example/a.png',
    'https://dd.dexscreener.com.evil.example/a.png', 'https://user:pw@dd.dexscreener.com/a.png', 'https://dd.dexscreener.com:8443/a.png', '//dd.dexscreener.com/a.png', '', null, 5]) {
    assert(live.safeUrl(bad, live.IMAGE_HOSTS) === null, 'unsafe URL accepted: ' + bad);
  }
  assert(fmt.fmtUsdCompact(1048127045) === '$1.05B' && fmt.fmtInt(78000000) === '78,000,000', 'formatters');
});

await gate('copy: no content-word bigram shared with the reference', async () => {
  const STOP = new Set(JSON.parse(read(join(ROOT, 'gates/fixtures/stopwords.json'))));
  const ref = new Set(JSON.parse(read(join(ROOT, 'gates/fixtures/ref-bigrams.json'))));
  assert(ref.size > 100, 'reference bigram fixture missing');
  const html = read(join(SRC, 'index.html')).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  const flat = (v, out = []) => (typeof v === 'string' ? out.push(v) : v && typeof v === 'object' && Object.values(v).forEach((x) => flat(x, out)), out);
  const mods = await import(pathToFileURL(join(SRC, 'js/modules.js')));
  const scen = await import(pathToFileURL(join(SRC, 'js/scenarios.js')));
  const mainStrings = [...read(join(SRC, 'js/main.js')).matchAll(/'([^'\n]{8,})'/g)].map((m) => m[1]).filter((s) => s.includes(' '));
  // Each text fragment (one element or one string) is scanned alone, so bigrams never straddle unrelated elements.
  const fragments = [...html.split(/\s{2,}|\n/), ...flat(mods.modules), ...flat(scen.scenarios), ...scen.defaultSteps, ...mainStrings];
  let count = 0;
  const hits = [];
  for (const frag of fragments) {
    const w = frag.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    count += w.length;
    for (let i = 0; i < w.length - 1; i++) {
      const [a, b] = [w[i], w[i + 1]];
      if (a.length < 3 || b.length < 3 || STOP.has(a) || STOP.has(b)) continue;
      // The chain's own name is a proper noun the brief mandates; it cannot be reworded.
      if (a + ' ' + b === 'robinhood chain') continue;
      if (ref.has(createHash('sha1').update(a + ' ' + b).digest('hex').slice(0, 12))) hits.push(a + ' ' + b);
    }
  }
  assert(!hits.length, 'shared: ' + [...new Set(hits)].join(' | '));
  return `${count} words checked`;
});

/* ================= browser gates ================= */

if (!EDGE) { console.log('FAIL â€” no Edge/Chrome found'); process.exit(1); }

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const u = req.url.split('?')[0];
  const p = join(DIST, u === '/' ? 'index.html' : u);
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }).end(readFileSync(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const profile = mkdtempSync(join(tmpdir(), 'secuty-gate-'));
const port = 9300 + Math.floor(Math.random() * 500);
const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

async function cleanup() {
  try { server.close(); } catch {}
  try { edge.kill(); } catch {}
  await new Promise((r) => setTimeout(r, 300));
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

let ws, nextId = 1;
const pending = new Map();
const listeners = new Set();
let errors = [];
try {
  let info;
  for (let i = 0; i < 60 && !info; i++) {
    try { info = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json(); }
    catch { await new Promise((r) => setTimeout(r, 150)); }
  }
  assert(info, 'browser did not start');
  ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const { res, rej } = pending.get(d.id);
      pending.delete(d.id);
      d.error ? rej(new Error(d.error.message)) : res(d.result);
    } else if (d.method) listeners.forEach((l) => l(d));
  };
} catch (e) {
  console.log('FAIL â€” browser setup: ' + e.message);
  await cleanup();
  process.exit(1);
}
const send = (method, params = {}) => new Promise((res, rej) => { const id = nextId++; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
listeners.add((d) => {
  if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console.error: ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('log: ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
});
const waitEvent = (name, ms = 8000) => new Promise((res, rej) => {
  const t = setTimeout(() => { listeners.delete(l); rej(new Error('timeout waiting for ' + name)); }, ms);
  const l = (d) => { if (d.method === name) { clearTimeout(t); listeners.delete(l); res(d.params); } };
  listeners.add(l);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');

// Fake network + fast clock, injected before any page script runs.
const fixtureScript = (mode, fast = true) => `(() => {
  const MODE = ${JSON.stringify(mode)};
  history.scrollRestoration = 'manual';
  let block = 0x4b54cb9;
  const pairs = ${JSON.stringify([
    FAKE.pair('TOP', 9000, 'robinhood', 'https://dd.dexscreener.com/ds-data/tokens/robinhood/top.png'),
    FAKE.pair('MID', 500, 'robinhood', 'javascript:alert(1)'),
    FAKE.pair('LOW', 10, 'robinhood', 'https://evil.example/x.png'),
    FAKE.pair('ELSE', 99999, 'other'),
  ])};
  window.__external = [];
  window.__imgs = [];
  const srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    get() { return srcDesc.get.call(this); },
    set(v) { window.__imgs.push(String(v)); srcDesc.set.call(this, 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'); },
  });
  window.fetch = (url, init = {}) => {
    url = String(url);
    if (!url.startsWith(location.origin)) window.__external.push(url);
    if (MODE === 'hang') return new Promise(() => {});
    const j = (d) => Promise.resolve(new Response(JSON.stringify(d), { status: 200, headers: { 'content-type': 'application/json' } }));
    if (url.includes('rpc.mainnet')) {
      block += 7;
      return j(JSON.parse(init.body).map((r) => ({ jsonrpc: '2.0', id: r.id, result: r.method === 'eth_blockNumber' ? '0x' + block.toString(16) : '${FAKE.gas}' })));
    }
    if (url.includes('llama')) return j(${JSON.stringify(FAKE.llama)});
    if (url.includes('dexscreener')) return j({ pairs });
    return Promise.reject(new Error('unexpected fetch ' + url));
  };
  const si = window.setInterval;
  if (${fast}) window.setInterval = (f, ms, ...a) => si(f, ms >= 1000 ? ms / 20 : ms, ...a);
})();`;

let injected = null;
async function open({ w = 1440, h = 900, mode = 'ok', reduce = false, fast = true } = {}) {
  errors = [];
  if (injected) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected });
  injected = (await send('Page.addScriptToEvaluateOnNewDocument', { source: fixtureScript(mode, fast) })).identifier;
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 430 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] });
  // Poll readyState instead of waiting on Page.loadEventFired, which Edge occasionally never reports.
  const token = Math.random().toString(36).slice(2);
  await send('Page.navigate', { url: ORIGIN + '/?n=' + token });
  await waitFor(`location.search.includes(${JSON.stringify(token)}) && document.readyState === 'complete'`, 8000).catch(() => {});
  await waitFor(`document.readyState === 'complete' && !!document.querySelector('#ca-slot')`, 8000);
  await sleep(120);
}
const waitFor = async (expr, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await ev(expr)) return true; await sleep(40); }
  throw new Error('condition not met: ' + expr);
};

try {
  await gate('page boots with no console errors or exceptions; only fixtures hit the network', async () => {
    await open({ reduce: true });
    await waitFor(`document.querySelector('#cell-block').dataset.state === 'ready'`);
    assert(!errors.length, errors.join(' | '));
    const ext = await ev('window.__external.length');
    assert(ext > 0, 'app made no data requests');
    const real = await ev(`window.__external.every((u) => /rpc\\.mainnet|llama|dexscreener/.test(u))`);
    assert(real, 'unexpected external request');
  });

  await gate('skeletons show for every live block while data is pending', async () => {
    await open({ mode: 'hang', reduce: true });
    await sleep(300);
    const r = await ev(`(() => {
      const vis = (el) => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
      const cells = ['#cell-block', '#cell-gas', '#cell-tvl'].map((s) => vis(document.querySelector(s + ' .skel')) && !vis(document.querySelector(s + ' .num')));
      const rows = [...document.querySelectorAll('.skel-row .skel')].every(vis) && document.querySelectorAll('.skel-row').length >= 3;
      return { cells, rows, pill: document.querySelector('#pill').dataset.state };
    })()`);
    assert(r.cells.every(Boolean), 'cell skeleton missing ' + JSON.stringify(r.cells));
    assert(r.rows, 'pair skeleton rows missing');
    assert(r.pill === 'loading', 'pill should be loading, was ' + r.pill);
  });

  await gate('live data renders: block, gas, TVL, pairs, status pill', async () => {
    await open({ reduce: true });
    await waitFor(`document.querySelectorAll('.pair-row:not(.skel-row)').length === 3`);
    const r = await ev(`({
      block: document.querySelector('#v-block').textContent,
      gas: document.querySelector('#v-gas').textContent,
      tvl: document.querySelector('#v-tvl').textContent,
      pill: document.querySelector('#pill-text').textContent,
      state: document.querySelector('#pill').dataset.state,
      names: [...document.querySelectorAll('.pair-row .p-name')].map((e) => e.textContent),
      links: [...document.querySelectorAll('a.pair-row')].every((a) => a.rel.includes('noopener') && a.href.startsWith('https://dexscreener.com/')),
    })`);
    assert(/^78,\d{3},\d{3}$/.test(r.block), 'block ' + r.block);
    assert(r.gas === '0.0264', 'gas ' + r.gas);
    assert(r.tvl === '$1.05B', 'tvl ' + r.tvl);
    assert(r.state === 'live' && r.pill.startsWith('CHAIN LIVE'), 'pill ' + r.pill);
    assert(r.names.join() === 'TOP/WETH,MID/WETH,LOW/WETH', 'pairs ' + r.names);
    assert(r.links, 'pair links unsafe');
    await waitFor(`document.querySelectorAll('#marquee .mq-item:not(.mq-skel)').length === 6`);
    const m = await ev(`({
      state: document.querySelector('#marquee').dataset.state,
      names: [...document.querySelectorAll('#marquee .mq-item:not(.mq-dup) .mq-name')].map((e) => e.textContent),
      price: document.querySelector('#marquee .mq-price').textContent,
      chg: document.querySelector('#marquee .mq-chg').textContent,
      imgs: window.__imgs,
      logos: document.querySelectorAll('#marquee .mq-item:not(.mq-dup) .mq-logo img').length,
      mono: [...document.querySelectorAll('#marquee .mq-item:not(.mq-dup) .mq-logo')].filter((e) => !e.querySelector('img')).map((e) => e.textContent),
      dupHidden: [...document.querySelectorAll('#marquee .mq-dup')].every((e) => e.getAttribute('aria-hidden') === 'true' && e.tabIndex === -1),
    })`);
    assert(m.state === 'ready' && m.names.join() === 'TOP Token,MID Token,LOW Token', 'marquee ' + JSON.stringify(m));
    assert(m.price === '$0.0123' && /1\.50%/.test(m.chg), 'price/change ' + m.price + ' ' + m.chg);
    assert(new Set(m.imgs).size === 1 && m.imgs[0] === 'https://dd.dexscreener.com/ds-data/tokens/robinhood/top.png', 'unsafe logo requested: ' + m.imgs);
    assert(m.logos === 1 && m.mono.join() === 'MI,LO', 'logo fallback ' + JSON.stringify(m));
    assert(m.dupHidden, 'duplicate loop items must be hidden from assistive tech');
  });

  await gate('count-up animates from zero; value change flashes', async () => {
    await open({ reduce: false, fast: false }); // real 4s poll so the first animation is not restarted under us
    await waitFor(`/\\d/.test(document.querySelector('#v-block').textContent)`);
    const mid = await ev(`parseInt(document.querySelector('#v-block').textContent.replace(/,/g, ''), 10) / document.querySelector('#v-block')._v`);
    assert(mid < 0.97, 'count-up not mid-flight: ' + mid);
    await waitFor(`document.querySelector('#v-block').classList.contains('flash')`, 10000);
    await waitFor(`/^78,\\d{3},\\d{3}$/.test(document.querySelector('#v-block').textContent)`, 3000);
  });

  await gate('CA slot is first, always visible, full, inert and dateless when absent', async () => {
    await open({ reduce: true });
    const r0 = await ev(`(() => { const e = document.querySelector('#ca-slot'); const b = e.getBoundingClientRect(); return { top: b.top, tag: e.tagName, kind: e.dataset.kind, text: e.textContent, first: document.body.querySelector('.top').firstElementChild === e, hasTime: !!e.querySelector('time'), role: e.getAttribute('role') }; })()`);
    assert(r0.first, 'CA must be first in the top bar');
    const c = rec.records.contract;
    if (c.state === 'stated') {
      assert(r0.tag === 'BUTTON' && r0.kind === 'copy', 'stated CA must be a copy button');
      assert(r0.text.includes(c.value), 'stated CA must show the full address: ' + r0.text);
      const label = await ev(`document.querySelector('#ca-slot').getAttribute('aria-label')`);
      assert(label.includes(c.value) && /copy/i.test(label), 'copy button label: ' + label);
    } else {
      assert(r0.tag === 'DIV' && r0.kind === 'inert' && !r0.role, 'absent CA must be a plain inert element');
      assert(!r0.hasTime && !/\d{4}|\d{1,2}[:/]\d{2}/.test(r0.text), 'absent CA must not show a date: ' + r0.text);
    }
    await ev('window.scrollTo(0, 2400)'); await sleep(150);
    const r1 = await ev(`document.querySelector('#ca-slot').getBoundingClientRect().top`);
    assert(Math.abs(r1) < 1.5, 'CA not pinned, top=' + r1);
  });

  await gate('socials: two icons, inert, no href, no external social link anywhere', async () => {
    await open({ reduce: true });
    const r = await ev(`(() => { const s = [...document.querySelectorAll('#socials .icon-btn')]; return { n: s.length, anchors: s.filter((e) => e.tagName === 'A' || e.hasAttribute('href')).length, dis: s.every((e) => e.getAttribute('aria-disabled') === 'true'), any: document.querySelectorAll('a[href*="x.com"], a[href*="twitter.com"], a[href*="github.com"]').length, pos: s[0].getBoundingClientRect().right > innerWidth - 120 }; })()`);
    assert(r.n === 2 && r.anchors === 0 && r.dis && r.any === 0, JSON.stringify(r));
    assert(r.pos, 'icons should sit top-right');
  });

  await gate('scroll progress bar tracks position', async () => {
    await open({ reduce: true });
    const p0 = await ev(`parseFloat(getComputedStyle(document.querySelector('.progress')).getPropertyValue('--p')) || 0`);
    await ev('window.scrollTo(0, document.documentElement.scrollHeight)'); await sleep(500);
    const p1 = await ev(`parseFloat(getComputedStyle(document.querySelector('.progress')).getPropertyValue('--p')) || 0`);
    assert(p0 < 0.02 && p1 > 0.97, `p0=${p0} p1=${p1}`);
  });

  await gate('scroll reveal: hidden below the fold, staggered, then shown', async () => {
    await open({ reduce: false });
    const before = await ev(`(() => { const e = [...document.querySelectorAll('.stage')]; return e.map((x) => +getComputedStyle(x).opacity); })()`);
    assert(before.every((o) => o < 0.5), 'stage items should start hidden ' + before);
    const delays = await ev(`[...document.querySelectorAll('.step')].map((x) => getComputedStyle(x).transitionDelay)`);
    assert(new Set(delays).size > 1, 'steps are not staggered: ' + delays);
    await ev(`document.querySelector('#stages').scrollIntoView({ behavior: 'instant' })`);
    await waitFor(`[...document.querySelectorAll('.stage')].every((x) => x.classList.contains('visible'))`, 3000);
  });

  await gate('parallax: depth layers drift with scroll (motion on)', async () => {
    await open({ reduce: false });
    await sleep(900);
    await ev('window.scrollTo(0, 260)'); await sleep(250);
    const t = await ev(`getComputedStyle(document.querySelector('.hero-grid')).transform`);
    assert(t && t !== 'none' && /matrix/.test(t), 'no transform: ' + t);
    const ty = parseFloat(t.split(',')[5]);
    assert(Math.abs(ty) > 1, 'layer did not move: ' + ty);
    await waitFor(`document.querySelector('#marquee').dataset.state === 'ready'`);
    await ev(`document.querySelector('#marquee').scrollIntoView({ block: 'center', behavior: 'instant' })`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 3, y: 3 });
    await sleep(200);
    const run = await ev(`getComputedStyle(document.querySelector('#mq-track')).animationPlayState`);
    const c = await ev(`(() => { const b = document.querySelector('#marquee').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0], y: c[1] });
    await sleep(200);
    const paused = await ev(`getComputedStyle(document.querySelector('#mq-track')).animationPlayState`);
    assert(run === 'running' && paused === 'paused', `marquee play state ${run} -> ${paused}`);
  });

  await gate('reduced motion: everything visible at once, nothing animating', async () => {
    await open({ reduce: true });
    await sleep(200);
    const r = await ev(`({
      hidden: [...document.querySelectorAll('.reveal, .stagger')].filter((e) => +getComputedStyle(e).opacity < 1).length,
      running: document.getAnimations().filter((a) => a.playState === 'running').length,
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
    })`);
    assert(r.hidden === 0, r.hidden + ' elements still hidden');
    assert(r.running === 0, r.running + ' animations still running');
    assert(r.scroll === 'auto', 'scroll-behavior ' + r.scroll);
    await waitFor(`document.querySelector('#v-block').textContent.replace(/,/g,'') === String(document.querySelector('#v-block')._v)`, 2000);
  });

  await gate('hover states change visuals on every kind of interactive element', async () => {
    await open({ w: 1440, h: 900, reduce: false });
    await waitFor(`document.querySelectorAll('a.pair-row').length > 0`);
    const sels = ['.brand', '.nav-main a', '.pill', '.node', '.picker button[aria-pressed="false"]', '.run', '.row', '.stage:nth-child(2) summary', '.text-link', 'a.pair-row'];
    const sig = `(sel) => { const el = document.querySelector(sel); const all = [el, ...el.querySelectorAll('*')].slice(0, 12); return all.map((e) => { const c = getComputedStyle(e); return [c.color, c.backgroundColor, c.borderTopColor, c.transform, c.opacity, c.paddingLeft, c.boxShadow].join('|'); }).join('||'); }`;
    const bad = [];
    for (const sel of sels) {
      await ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center', behavior: 'instant' })`);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 3, y: 3 });
      await sleep(350);
      const before = await ev(`(${sig})(${JSON.stringify(sel)})`);
      const c = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0], y: c[1] });
      await sleep(450);
      const after = await ev(`(${sig})(${JSON.stringify(sel)})`);
      if (before === after) bad.push(sel);
    }
    assert(!bad.length, 'no hover change: ' + bad.join(', '));
  });

  await gate('dry-run lab: each scenario reaches its own verdict', async () => {
    await open({ reduce: true });
    const out = [];
    for (const s of ['everyday', 'agent', 'large']) {
      await ev(`document.querySelector('[data-scenario="${s}"]').click()`);
      await ev(`document.querySelector('#run').click()`);
      await waitFor(`document.querySelector('#trace-state').textContent === 'FINISHED'`, 2000);
      out.push(await ev(`({ t: document.querySelector('#verdict-title').textContent, done: document.querySelectorAll('#stages-list li.done').length, pressed: document.querySelector('[data-scenario="${s}"]').getAttribute('aria-pressed') })`));
    }
    assert(new Set(out.map((o) => o.t)).size === 3, 'verdicts not distinct: ' + out.map((o) => o.t));
    assert(out.every((o) => o.done === 4 && o.pressed === 'true'), JSON.stringify(out));
  });

  await gate('inspector dialog opens from nodes and rows, closes on Escape', async () => {
    await open({ reduce: true });
    await ev(`document.querySelector('.node[data-module="screening"]').click()`);
    await waitFor(`document.querySelector('#dlg').open`);
    const t = await ev(`document.querySelector('#dlg-title').textContent`);
    assert(t === 'Screening', 'title ' + t);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await waitFor(`!document.querySelector('#dlg').open`);
  });

  for (const w of [360, 390, 430, 1366, 1440]) {
    await gate(`${w}px: no overflow, 48px tap targets, CA fully shown`, async () => {
      await open({ w, h: w < 700 ? 800 : 900, reduce: true });
      await waitFor(`document.querySelectorAll('a.pair-row').length > 0`);
      const r = await ev(`(() => {
        const vw = document.documentElement.clientWidth;
        const out = { vw, sw: document.documentElement.scrollWidth, over: [], small: [], ca: null };
        for (const e of document.body.querySelectorAll('*')) {
          const b = e.getBoundingClientRect();
          if (!b.width || !b.height || getComputedStyle(e).visibility === 'hidden') continue;
          if (e.closest('.sr-only')) continue;
          if (e.closest('.marquee') && !e.classList.contains('marquee')) continue; // clipped by the strip's overflow
          if (b.right > vw + 1 || b.left < -1) out.over.push(e.tagName + '.' + e.className + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
        }
        const hit = 'a[href], button, summary, [role="button"], [aria-disabled="true"]';
        for (const e of document.querySelectorAll(hit)) {
          const b = e.getBoundingClientRect();
          if (!b.width || !b.height) continue;
          if (b.width < 47.5 || b.height < 47.5) out.small.push((e.className || e.tagName) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height));
        }
        const v = document.querySelector('#ca-value');
        out.ca = { clipped: v.scrollWidth > v.clientWidth + 1, text: v.textContent.length };
        return out;
      })()`);
      assert(r.sw <= r.vw, `horizontal scroll: scrollWidth ${r.sw} > ${r.vw}`);
      assert(!r.over.length, 'overflowing: ' + r.over.slice(0, 5).join('; '));
      assert(!r.small.length, 'tap targets under 48px: ' + [...new Set(r.small)].slice(0, 6).join('; '));
      assert(!r.ca.clipped, 'CA slot clipped');
    });
  }
} finally {
  await cleanup();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length} gates (max 30), ${failed.length} failed, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
assert(results.length <= 30, 'gate budget exceeded');
process.exit(failed.length ? 1 : 0);
