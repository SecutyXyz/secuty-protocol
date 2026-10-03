import { records, caView, linkView } from './records.js';
import { readChain, readTvl, readPairs } from './live.js';
import { fmtInt, fmtUsdCompact, fmtGwei, fmtPct, fmtPrice } from './format.js';
import { modules } from './modules.js';
import { scenarios, defaultSteps } from './scenarios.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => reducedQuery.matches;
const POLL_MS = 4000;

document.documentElement.classList.add('js');

/* ---------- announcements ---------- */
const announce = (msg) => {
  const el = $('#announce');
  el.textContent = '';
  requestAnimationFrame(() => (el.textContent = msg));
};

/* ---------- contract slot (rule 1, 3) ---------- */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

function renderCa() {
  const view = caView(records.contract);
  const old = $('#ca-slot');
  const el = document.createElement(view.kind === 'copy' ? 'button' : 'div');
  el.id = 'ca-slot';
  el.className = 'ca';
  el.dataset.kind = view.kind;
  const label = document.createElement('span');
  label.className = 'ca-label';
  label.textContent = 'CA';
  const value = document.createElement('span');
  value.className = 'ca-value';
  value.id = 'ca-value';
  value.textContent = view.text;
  el.append(label, value);
  if (view.kind === 'copy') {
    el.type = 'button';
    el.setAttribute('aria-label', `${view.label}: ${view.text}. Click to copy.`);
    const hint = document.createElement('span');
    hint.className = 'ca-hint';
    hint.textContent = 'COPY';
    el.append(hint);
    el.addEventListener('click', async () => {
      const ok = await copyText(view.text);
      hint.textContent = ok ? 'COPIED' : 'PRESS CTRL+C';
      el.classList.toggle('done', ok);
      announce(ok ? 'Contract address copied' : 'Copy failed');
      setTimeout(() => { hint.textContent = 'COPY'; el.classList.remove('done'); }, reduced() ? 800 : 1800);
    });
  }
  old.replaceWith(el);
}

/* ---------- socials (rule 2) ---------- */
const ICONS = {
  x: 'M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.47l8.6-9.84L0 1.15h7.6l5.24 6.93 6.06-6.93Zm-1.29 19.49h2.04L6.49 3.24H4.3l13.31 17.4Z',
  github: 'M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z',
};
const NAMES = { x: 'X', github: 'GitHub' };

function renderSocials() {
  const host = $('#socials');
  host.replaceChildren();
  for (const key of ['x', 'github']) {
    const { href, handle } = linkView(records[key]);
    const el = document.createElement(href ? 'a' : 'span');
    el.className = 'icon-btn';
    if (href) {
      el.href = href;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
      el.setAttribute('aria-label', `Secuty on ${NAMES[key]}${handle ? ' (' + handle + ')' : ''}, opens in a new tab`);
    } else {
      el.setAttribute('role', 'img');
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('aria-label', `${NAMES[key]}: not published yet`);
    }
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${ICONS[key]}"/></svg>`;
    host.append(el);
  }
}

/* ---------- numbers: count-up + flash ---------- */
function setNumber(el, to, fmt) {
  const from = el._v;
  el._v = to;
  const cell = el.closest('.cell');
  if (cell) cell.dataset.state = 'ready';
  cancelAnimationFrame(el._raf);
  if (reduced()) {
    el.textContent = fmt(to);
    return;
  }
  const first = from == null;
  const start = first ? 0 : from;
  if (!first && from === to) return;
  if (!first) {
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }
  const dur = first ? 1100 : 500;
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(start + (to - start) * e);
    if (k < 1) el._raf = requestAnimationFrame(tick);
    else el.textContent = fmt(to);
  };
  el._raf = requestAnimationFrame(tick);
}

function setCellError(id, sid, msg) {
  const cell = $(id);
  if (cell.dataset.state !== 'ready') cell.dataset.state = 'error';
  $(sid).textContent = msg;
}

/* ---------- live data ---------- */
const pill = $('#pill');
async function pollChain() {
  try {
    const { block, gasGwei } = await readChain();
    setNumber($('#v-block'), block, fmtInt);
    setNumber($('#v-gas'), gasGwei, fmtGwei);
    $('#s-block').textContent = 'Node answers every 4 seconds';
    $('#s-gas').textContent = 'Current per-unit price';
    pill.dataset.state = 'live';
    $('#pill-text').textContent = `CHAIN LIVE · BLOCK ${fmtInt(block)}`;
  } catch {
    setCellError('#cell-block', '#s-block', 'Node unreachable, retrying');
    setCellError('#cell-gas', '#s-gas', 'Node unreachable, retrying');
    pill.dataset.state = 'down';
    $('#pill-text').textContent = 'NODE UNREACHABLE · RETRYING';
  }
}

async function pollTvl() {
  try {
    const { tvl } = await readTvl();
    setNumber($('#v-tvl'), tvl, fmtUsdCompact);
    $('#s-tvl').textContent = 'Source: DefiLlama';
  } catch {
    setCellError('#cell-tvl', '#s-tvl', 'Tracker unreachable, retrying');
  }
}

function pairRow(r) {
  const el = document.createElement(r.url ? 'a' : 'div');
  el.className = 'pair-row';
  if (r.url) {
    el.href = r.url;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
  }
  const cols = [
    ['p-name', r.pair],
    ['p-dex', r.dex],
    ['p-liq', fmtUsdCompact(r.liquidity) + ' liq'],
    ['p-vol', fmtUsdCompact(r.volume) + ' 24h'],
    ['p-chg', r.change == null ? '—' : fmtPct(r.change)],
  ];
  for (const [cls, text] of cols) {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    el.append(s);
  }
  return el;
}

function marqueeItem(t, dup) {
  const el = document.createElement(t.url ? 'a' : 'div');
  el.className = 'mq-item' + (dup ? ' mq-dup' : '');
  if (t.url) {
    el.href = t.url;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
  }
  if (dup) {
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
  }
  const logo = document.createElement('span');
  logo.className = 'mq-logo';
  const mono = () => { logo.replaceChildren(document.createTextNode(t.symbol.slice(0, 2).toUpperCase())); };
  if (t.logo) {
    const img = document.createElement('img');
    img.alt = '';
    img.width = 28;
    img.height = 28;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', mono, { once: true });
    img.src = t.logo;
    logo.append(img);
  } else {
    mono();
  }
  const name = document.createElement('span');
  name.className = 'mq-name';
  name.textContent = t.name;
  const sym = document.createElement('span');
  sym.className = 'mq-sym';
  sym.textContent = t.symbol;
  const price = document.createElement('span');
  price.className = 'mq-price';
  price.textContent = t.price == null ? '—' : fmtPrice(t.price);
  const chg = document.createElement('span');
  chg.className = 'mq-chg';
  chg.textContent = t.change == null ? '—' : (t.change > 0 ? '▲ ' : t.change < 0 ? '▼ ' : '') + fmtPct(t.change);
  el.append(logo, name, sym, price, chg);
  return el;
}

function renderMarquee(tokens) {
  const mq = $('#marquee');
  const track = $('#mq-track');
  if (!tokens.length) return;
  track.replaceChildren(...tokens.map((t) => marqueeItem(t, false)), ...tokens.map((t) => marqueeItem(t, true)));
  track.style.setProperty('--mq-dur', tokens.length * 5 + 's');
  mq.dataset.state = 'ready';
}

async function pollPairs() {
  const body = $('#pairs-body');
  try {
    const { scoped, rows, tokens } = await readPairs();
    renderMarquee(tokens);
    $('#pairs').dataset.state = 'ready';
    $('#pairs-scope').textContent = scoped ? 'TOKEN PAIRS' : 'CHAIN-WIDE';
    body.replaceChildren();
    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'pairs-empty';
      p.textContent = 'No pairs with liquidity were found just now.';
      body.append(p);
    } else {
      rows.forEach((r) => body.append(pairRow(r)));
    }
  } catch {
    if ($('#marquee').dataset.state !== 'ready') {
      $('#mq-track').replaceChildren();
      $('#marquee').dataset.state = 'error';
    }
    if ($('#pairs').dataset.state !== 'ready') {
      $('#pairs').dataset.state = 'error';
      body.replaceChildren();
      const p = document.createElement('p');
      p.className = 'pairs-empty';
      p.textContent = 'The DEX index did not answer. Retrying shortly.';
      body.append(p);
    }
  }
}

function every(fn, ms) {
  fn();
  setInterval(() => { if (!document.hidden) fn(); }, ms);
}

/* ---------- reveal, parallax, progress ---------- */
function setupMotion() {
  const items = $$('.reveal');
  if (reduced() || !('IntersectionObserver' in window)) {
    items.forEach((e) => e.classList.add('visible'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    items.forEach((e) => io.observe(e));
  }

  const layers = $$('[data-depth]');
  const bar = $('.progress');
  let queued = false;
  const frame = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? String(scrollY / max) : '0');
    if (!reduced()) {
      for (const l of layers) {
        const r = l.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) continue;
        l.style.transform = `translate3d(0,${(-r.top * Number(l.dataset.depth)).toFixed(1)}px,0)`;
      }
    }
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(frame); } }, { passive: true });
  addEventListener('resize', frame);
  frame();
}

/* ---------- inspector dialog ---------- */
function setupDialog() {
  const dlg = $('#dlg');
  const body = $('#dlg-body');
  $$('[data-module]').forEach((b) => b.addEventListener('click', () => {
    const m = modules[b.dataset.module];
    body.replaceChildren();
    const eye = document.createElement('div');
    eye.className = 'eyebrow';
    eye.textContent = m.stage;
    const h = document.createElement('h2');
    h.id = 'dlg-title';
    h.textContent = m.title;
    const p = document.createElement('p');
    p.textContent = m.text;
    const ul = document.createElement('ul');
    m.items.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.append(li); });
    body.append(eye, h, p, ul);
    dlg.showModal();
  }));
  $('.dlg-close', dlg).addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}

/* ---------- dry-run lab ---------- */
function setupLab() {
  const lab = $('#lab');
  const items = $$('#stages-list li', lab);
  const run = $('#run', lab);
  let selected = 'everyday';
  let runId = 0;
  const set = (id, t) => { $('#' + id).textContent = t; };

  function reset() {
    runId++;
    run.disabled = false;
    set('run-label', 'Start dry run');
    set('trace-state', 'IDLE');
    set('verdict-title', 'Nothing run yet');
    set('verdict-detail', 'Pick a request, then start the dry run.');
    items.forEach((li, i) => {
      li.className = '';
      $('p', li).textContent = defaultSteps[i];
      $('.st', li).textContent = '—';
    });
  }

  $$('[data-scenario]', lab).forEach((b) => b.addEventListener('click', () => {
    selected = b.dataset.scenario;
    reset();
    $$('[data-scenario]', lab).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const s = scenarios[selected];
    const amt = $('#req-amount');
    amt.replaceChildren(document.createTextNode(s.amount));
    const u = document.createElement('span');
    u.textContent = s.unit;
    amt.append(u);
    set('req-desc', s.desc);
    set('req-dest', s.dest);
    set('req-rule', s.rule);
    set('req-proof', s.proof);
  }));

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  run.addEventListener('click', async () => {
    reset();
    const me = runId;
    const s = scenarios[selected];
    run.disabled = true;
    set('run-label', 'Checking…');
    set('trace-state', 'RUNNING');
    set('verdict-title', 'Review underway');
    set('verdict-detail', 'Working through the owner’s rules.');
    for (let i = 0; i < items.length; i++) {
      if (me !== runId) return;
      items[i].classList.add('on');
      $('p', items[i]).textContent = s.steps[i];
      $('.st', items[i]).textContent = 'CHECKING';
      await wait(reduced() ? 0 : 650);
      if (me !== runId) return;
      items[i].classList.replace('on', 'done');
      $('.st', items[i]).textContent = s.marks[i];
    }
    set('trace-state', 'FINISHED');
    set('verdict-title', s.title);
    set('verdict-detail', s.detail);
    set('run-label', 'Run again');
    run.disabled = false;
  });
}

/* ---------- boot ---------- */
renderCa();
renderSocials();
setupMotion();
setupDialog();
setupLab();
every(pollChain, POLL_MS);
every(pollTvl, 120000);
every(pollPairs, 60000);
