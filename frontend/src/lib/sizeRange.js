/**
 * Expand clothing/shoe size ranges used by wholesale imports into selectable
 * values, e.g. "S-2XL" -> ["S","M","L","XL","2XL"], "39-45" -> ["39",..."45"].
 */

const ALPHA_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

function normAlpha(token) {
  const t = String(token || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!t) return '';
  // XXL / XXXL → 2XL / 3XL
  const x = t.match(/^X{2,6}L$/);
  if (x) return `${t.length - 1}XL`;
  if (/^\dXL$/.test(t)) return t;
  if (['XXS', 'XS', 'S', 'M', 'L', 'XL'].includes(t)) return t;
  return '';
}

/**
 * Expand a single size token or range. Returns [] when not expandable.
 */
export function expandSizeToken(raw) {
  if (!raw || typeof raw !== 'string') return [];
  let text = raw.trim().replace(/\.$/, '');
  if (!text) return [];

  // Wholesale shoe/pants style: "sz38-45" / "sz 35-40"
  const sz = text.match(/^sz\s*(\d{2}\s*[-–—]\s*\d{2})$/i);
  if (sz) text = sz[1];

  // Already a list: "S, M, L" or "S/M/L"
  if (/[,/|、，]/.test(text)) {
    const parts = text
      .split(/\s*[,/|、，]\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) return [...new Set(parts)];
  }

  // Alpha range: S-2XL, XS-XL, M-3XL
  const alpha = text.match(/^(XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|\dXL)\s*[-–—]\s*(XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|\dXL)$/i);
  if (alpha) {
    const a = normAlpha(alpha[1]);
    const b = normAlpha(alpha[2]);
    const i = ALPHA_ORDER.indexOf(a);
    const j = ALPHA_ORDER.indexOf(b);
    if (i >= 0 && j >= i) return ALPHA_ORDER.slice(i, j + 1);
  }

  // Numeric range: 39-45, 35-44 (shoe / pants)
  const num = text.match(/^(\d{2})\s*[-–—]\s*(\d{2})$/);
  if (num) {
    const lo = Number(num[1]);
    const hi = Number(num[2]);
    if (lo >= 20 && hi <= 60 && hi - lo <= 20 && hi >= lo) {
      const out = [];
      for (let n = lo; n <= hi; n += 1) out.push(String(n));
      return out;
    }
  }

  return [];
}

/**
 * If a Size group has a single range-like value, expand it in place.
 */
export function expandSizeGroup(group) {
  if (!group || !Array.isArray(group.values)) return group;
  if (!/^sizes?$/i.test(group.name || '')) return group;
  if (group.values.length !== 1) return group;
  const expanded = expandSizeToken(group.values[0]);
  if (expanded.length < 2) return group;
  return { ...group, values: expanded };
}
