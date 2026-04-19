// TradingView Logger — Shared Utilities
// =======================================

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function highlightMatch(text, query, caseSensitive = false) {
  if (!query) return escapeHtml(text);
  const escaped      = escapeHtml(text);
  const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags        = caseSensitive ? 'g' : 'gi';
  return escaped.replace(new RegExp(escapedQuery, flags), m => `<mark>${m}</mark>`);
}

function normalizePrice(price) {
  if (!price || price === '-' || price === '') return null;
  const cleaned = String(price).trim().replace(/\s/g, '');
  if (!cleaned) return null;

  const hasComma = cleaned.includes(',');
  const hasDot   = cleaned.includes('.');

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot   = cleaned.lastIndexOf('.');
    return lastComma > lastDot
      ? parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
      : parseFloat(cleaned.replace(/,/g, ''));
  } else if (hasComma) {
    const afterComma = cleaned.split(',')[1] || '';
    return (afterComma.length === 3 && !afterComma.includes('.'))
      ? parseFloat(cleaned.replace(/,/g, ''))
      : parseFloat(cleaned.replace(',', '.'));
  }
  return parseFloat(cleaned);
}

function formatPrice(price) {
  const p = normalizePrice(price);
  if (p === null || isNaN(p)) return '-';
  return p.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h   = Math.floor(totalSec / 3600);
  const m   = Math.floor((totalSec % 3600) / 60);
  const s   = totalSec % 60;
  if (h > 0)  return `${h}s ${m}dk`;
  if (m > 0)  return `${m}dk ${s}sn`;
  return `${s}sn`;
}

function timeSince(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const m    = Math.floor(diff / 60000);
  const h    = Math.floor(diff / 3600000);
  const d    = Math.floor(diff / 86400000);
  if (d > 0) return `${d}g önce`;
  if (h > 0) return `${h}sa önce`;
  if (m > 0) return `${m}dk önce`;
  return 'az önce';
}
