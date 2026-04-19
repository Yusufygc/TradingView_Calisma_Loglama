// TradingView Logger — Stats Module v3.1
// ========================================
// Hibrit kaynaklardan veri çeker: today buffer + OPFS son 30 gün

const StatsModule = (() => {

  async function load() {
    const container = document.getElementById('statsSummary');
    if (!container) return; // sekme henüz DOM'da değil
    container.innerHTML = '<p class="empty-state">Yükleniyor...</p>';

    // Hibrit: LogsModule cache varsa kullan, yoksa yeniden çek
    let logs = LogsModule.getAll();
    if (!logs.length) {
      const res    = await chrome.storage.local.get([STORAGE_KEYS.TODAY]);
      const today  = res[STORAGE_KEYS.TODAY] || [];
      const recent = await StorageManager.readRecentDays(30).catch(() => []);
      logs = [...today, ...recent];
    }

    const timeRes   = await chrome.storage.local.get([STORAGE_KEYS.TIME_LOG, STORAGE_KEYS.LAST_VIEWS]);
    const timeLog   = timeRes[STORAGE_KEYS.TIME_LOG]   || {};
    const lastViews = timeRes[STORAGE_KEYS.LAST_VIEWS] || {};

    if (!logs.length) {
      container.innerHTML = '<p class="empty-state">Henüz yeterli veri yok.</p>';
      return;
    }

    // ── Görüntülenme sıralaması ─────────────────────────
    const viewCounts = {};
    logs.forEach(l => {
      if (l.symbol && l.symbol !== 'Bilinmiyor')
        viewCounts[l.symbol] = (viewCounts[l.symbol] || 0) + 1;
    });
    const ranked   = Object.entries(viewCounts).sort((a, b) => b[1] - a[1]);
    const maxViews = ranked[0]?.[1] || 1;
    const rankColors = ['gold','silver','bronze'];

    const rankHtml = ranked.slice(0, 10).map(([sym, count], i) => {
      const pct      = Math.round((count / maxViews) * 100);
      const tl       = timeLog[sym];
      const totalTime = tl ? formatDuration(tl.totalMs) : '—';
      const sessions  = tl?.sessions ?? '—';
      return `
        <div class="symbol-rank-item">
          <span class="rank-pos ${rankColors[i] || ''}">${i+1}</span>
          <div class="rank-info">
            <span class="rank-sym">${escapeHtml(sym)}</span>
            <span class="rank-meta">⏱ ${totalTime} · ${sessions} seans</span>
          </div>
          <div class="rank-bar-wrap"><div class="rank-bar" style="width:${pct}%"></div></div>
          <span class="rank-count">${count}×</span>
        </div>`;
    }).join('');

    // ── Toplam süre sıralaması ──────────────────────────
    const timeSorted = Object.entries(timeLog)
      .filter(([, v]) => v.totalMs > 0)
      .sort((a, b) => b[1].totalMs - a[1].totalMs);
    const maxMs = timeSorted[0]?.[1].totalMs || 1;

    const timeHtml = timeSorted.slice(0, 8).map(([sym, data]) => {
      const pct    = Math.round((data.totalMs / maxMs) * 100);
      const lv     = lastViews[sym];
      const lvDate = lv ? new Date(lv.date).toLocaleDateString('tr-TR') : '—';

      const symLogs = logs.filter(l => l.symbol === sym && l.price && l.price !== '-');
      let changeHtml = '';
      if (symLogs.length >= 2 && lv?.price) {
        const first = normalizePrice(symLogs[symLogs.length-1].price);
        const last  = normalizePrice(lv.price);
        if (first && last && first > 0) {
          const diff = last - first;
          const pct2 = ((diff/first)*100).toFixed(2);
          changeHtml = Math.abs(diff) < 0.01
            ? '<span class="price-change flat">➡ Değişmedi</span>'
            : diff > 0
              ? `<span class="price-change up">▲ +%${pct2}</span>`
              : `<span class="price-change down">▼ %${pct2}</span>`;
        }
      }

      return `
        <div class="time-rank-item">
          <div class="time-rank-header">
            <span class="price-history-sym">${escapeHtml(sym)}</span>
            ${changeHtml}
            <span class="price-history-date">Son: ${lvDate}</span>
          </div>
          <div class="time-rank-bar-row">
            <div class="rank-bar-wrap" style="flex:1">
              <div class="rank-bar time-bar" style="width:${pct}%"></div>
            </div>
            <span class="time-label">${formatDuration(data.totalMs)}</span>
          </div>
          <div class="price-detail">
            ${data.sessions} seans · Son: <strong style="color:var(--warning)">${formatPrice(lv?.price)}</strong>
          </div>
        </div>`;
    }).join('');

    // ── Bugün özeti ─────────────────────────────────────
    const todayStr    = new Date().toLocaleDateString('tr-TR');
    const todayLogs   = logs.filter(l => l.date === todayStr);
    const uniqueToday = new Set(todayLogs.map(l => l.symbol)).size;
    const todayMs     = todayLogs.reduce((s, l) => s + (l.sessionMs||0), 0);

    container.innerHTML = `
      <div class="stats-scroll">
        <div class="today-summary">
          <div class="today-item">
            <span class="today-num">${todayLogs.length}</span>
            <span class="today-label">Bugün log</span>
          </div>
          <div class="today-item">
            <span class="today-num">${uniqueToday}</span>
            <span class="today-label">Hisse</span>
          </div>
          <div class="today-item">
            <span class="today-num">${formatDuration(todayMs)}</span>
            <span class="today-label">Toplam süre</span>
          </div>
        </div>

        <div class="stats-section-title">En Çok Görüntülenen</div>
        <div class="symbol-rank-list">${rankHtml || '<p class="empty-state">Veri yok.</p>'}</div>

        ${timeHtml ? `
          <div class="stats-section-title">En Uzun İncelenen</div>
          ${timeHtml}
        ` : ''}
      </div>`;
  }

  return { load };
})();