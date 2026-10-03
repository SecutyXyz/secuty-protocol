// Register pattern (rule 1): every external fact is exactly one record.
// state is one of: stated | absent | unconfirmed.
// Only the record changes when a fact is announced; no other file holds it.

export const STATES = ['stated', 'absent', 'unconfirmed'];

export const records = {
  contract: { state: 'absent', value: null },
  x: { state: 'absent', url: null },
  github: { state: 'absent', url: null },
  site: { state: 'stated', url: 'https://secuty.xyz' },
  chainId: { state: 'stated', value: 4663 },
  rpc: { state: 'stated', url: 'https://rpc.mainnet.chain.robinhood.com' },
  llamaChain: { state: 'stated', value: 'Robinhood Chain' },
  dexChain: { state: 'stated', value: 'robinhood' },
};

// Accepts any well-formed 0x address: lower, upper or mixed-case hex (rule 3).
export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
export const isAddress = (v) => typeof v === 'string' && ADDRESS_RE.test(v);

export const isStated = (r) =>
  !!r && r.state === 'stated' && (r.value != null || !!r.url);

// Rule 2: store the URL, derive the handle. No href unless stated.
export function handleOf(url) {
  if (!url) return null;
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)[0];
    return seg || null;
  } catch {
    return null;
  }
}

export function linkView(record) {
  if (!isStated(record) || !record.url) return { href: null, handle: null };
  return { href: record.url, handle: handleOf(record.url) };
}

// View-model for the contract slot. Never carries a date when absent.
export function caView(record) {
  if (isStated(record) && isAddress(record.value)) {
    return { kind: 'copy', text: record.value, label: 'Contract address' };
  }
  if (record && record.state === 'unconfirmed' && isAddress(record.value)) {
    return { kind: 'inert', text: record.value, label: 'Contract address (unconfirmed)' };
  }
  return { kind: 'inert', text: 'Not announced yet', label: 'Contract address' };
}
