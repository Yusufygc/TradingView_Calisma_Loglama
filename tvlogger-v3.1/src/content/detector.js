// TradingView Logger — Detector
// ==============================
// Sembol ve fiyat tespiti. currentSymbol global'e bağımlı (content.js'den gelir).

function detectSymbol() {
  // 1. Chart Legend — en güncel kaynak
  const legend =
    document.querySelector('[data-name="legend-source-title"]') ||
    document.querySelector('.legend-source-title');
  if (legend) {
    const t = legend.textContent.trim();
    if (t) return t;
  }

  // 2. Header toolbar symbol search
  const btn =
    document.querySelector('#header-toolbar-symbol-search') ||
    document.querySelector('[data-name="header-toolbar-symbol-search"]');
  if (btn) {
    const t = btn.textContent.trim();
    if (t && t !== 'Symbol Search') return t;
  }

  // 3. Page title  — "PGSUS 200,8 ▲ ..."
  const titleMatch = document.title.match(/^([A-Z][A-Z0-9./]+)/);
  if (titleMatch && titleMatch[1] !== 'TradingView') return titleMatch[1];

  // 4. URL fallback
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.has('symbol')) return p.get('symbol');
  } catch (_) {}

  return null;
}

function extractCurrentPrice() {
  // 1. DOM önce — daha güvenilir
  const selectors = [
    '[class*="lastPrice"]',
    '[data-name="legend-source-item"] [class*="value"]',
    '[class*="priceWrapper"] [class*="price"]',
    '.tv-symbol-price-quote__value',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const t = el.textContent.trim();
      if (/^[\d.,\s]+$/.test(t) && t && t !== '0') return t.trim();
    }
  }

  // 2. Title fallback — bilinen sembolü atla
  const title  = document.title;
  const symbol = (typeof currentSymbol !== 'undefined' ? currentSymbol : '') || '';
  if (symbol && title.startsWith(symbol)) {
    const after = title.slice(symbol.length).trim();
    const m     = after.match(/^([\d.,]+)/);
    if (m) return m[1];
  }

  // 3. Genel title regex
  const m2 = title.match(/^[^\s]+\s+([\d.,]+)/);
  if (m2 && m2[1].replace(/[.,]/g, '').length >= 2) return m2[1];

  return '-';
}
