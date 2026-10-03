const intFmt = new Intl.NumberFormat('en-US');

export const fmtInt = (n) => intFmt.format(Math.round(n));

export function fmtUsdCompact(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

export function fmtGwei(n) {
  if (n === 0) return '0';
  if (n >= 100) return n.toFixed(0);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export function fmtPrice(n) {
  if (n >= 1000) return '$' + fmtInt(n);
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(4);
  return '$' + n.toPrecision(3);
}

export const fmtPct = (n) => (n > 0 ? '+' : '') + n.toFixed(2) + '%';
