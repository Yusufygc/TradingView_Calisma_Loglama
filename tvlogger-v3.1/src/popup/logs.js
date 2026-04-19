// TradingView Logger — Logs Module v3.1
// =======================================

const LogsModule = (() => {
  let allLogs       = [];
  let caseSensitive = false;

  async function load() {
    const res    = await chrome.storage.local.get([STORAGE_KEYS.TODAY]);
    const today  = res[STORAGE_KEYS.TODAY] || [];

    let archived = [];
    try {
      archived = await StorageManager.readRecentDays(30);
    } catch (e) {
      console.warn('[LogsModule] OPFS okuma hatası:', e);
    }

    allLogs = _dedupe([...today, ...archived]);
    allLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    _updateStatCards();
    applyFilters();
  }

  function _dedupe(logs) {
    const seen = new Set();
    return logs.filter(l => {
      const key = `${l.timestamp}-${l.symbol}-${l.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function _updateStatCards() {
    const todayStr   = new Date().toLocaleDateString('tr-TR');
    const todayCount = allLogs.filter(l => l.date === todayStr).length;

    const totalEl = document.getElementById('totalLogs');
    const todayEl = document.getElementById('todayLogs');
    const topEl   = document.getElementById('topSymbol');
    if (!totalEl || !todayEl || !topEl) return; // DOM henüz hazır değil

    totalEl.textContent = allLogs.length;
    todayEl.textContent = todayCount;

    const counts = {};
    allLogs.forEach(l => {
      if (l.symbol && l.symbol !== 'Bilinmiyor')
        counts[l.symbol] = (counts[l.symbol] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    topEl.textContent = top ? top[0] : '—';
  }

  function applyFilters() {
    const query     = document.getElementById('logSearch').value;
    const action    = document.getElementById('actionFilter').value;
    const sortOrder = document.getElementById('sortOrder').value;
    const infoEl    = document.getElementById('searchResultInfo');
    const container = document.getElementById('logsContainer');
    if (!container) return; // DOM hazır değil

    let filtered = [...allLogs];
    if (action) filtered = filtered.filter(l => l.action?.includes(action));

    if (query) {
      const q = caseSensitive ? query : query.toUpperCase();
      filtered = filtered.filter(l => {
        const sym = (caseSensitive ? l.symbol : l.symbol?.toUpperCase()) || '';
        const act = (caseSensitive ? l.action : l.action?.toUpperCase()) || '';
        return sym.includes(q) || act.includes(q);
      });
      const base = action ? allLogs.filter(l => l.action?.includes(action)).length : allLogs.length;
      infoEl.style.display = 'block';
      infoEl.textContent   = `${filtered.length} / ${base} kayıt`;
    } else {
      infoEl.style.display = 'none';
    }

    filtered.sort((a, b) =>
      sortOrder === 'asc' ? (a.timestamp||0) - (b.timestamp||0) : (b.timestamp||0) - (a.timestamp||0)
    );
    render(filtered, query);
  }

  function render(logs, searchQuery) {
    const container = document.getElementById('logsContainer');
    if (!container) return;
    if (!logs.length) {
      container.innerHTML = `<p class="empty-state">${
        searchQuery ? `"${escapeHtml(searchQuery)}" için sonuç bulunamadı.` : 'Henüz log yok.'
      }</p>`;
      return;
    }

    container.innerHTML = logs.slice(0, 150).map(log => {
      let cls = '';
      if (log.action?.includes('Başladı'))      cls = 'log-start';
      else if (log.action?.includes('Değişti')) cls = 'log-change';
      else if (log.action?.includes('Kapandı')) cls = 'log-end';

      const details    = log.details || {};
      const detailText = Object.entries(details)
        .filter(([k]) => k !== 'fiyat')
        .map(([k, v]) => `<b>${k}:</b> ${escapeHtml(String(v))}`)
        .join(' | ');

      const symHtml = highlightMatch(log.symbol || '?', searchQuery, caseSensitive);
      const ago     = log.timestamp ? `· ${timeSince(log.timestamp)}` : '';
      const durHtml = log.sessionMs > 2000
        ? `<span class="log-duration">⏱ ${formatDuration(log.sessionMs)}</span>` : '';

      return `
        <div class="log-item ${cls}">
          <div class="log-header">
            <span class="log-date">${escapeHtml(log.date)} ${escapeHtml(log.time)}
              <span style="opacity:.4">${ago}</span></span>
            <span class="log-symbol">${symHtml}</span>
          </div>
          <div class="log-action">${escapeHtml(log.action)}</div>
          <div class="log-details">
            ${detailText}
            ${log.price ? `<span class="log-price">💰 ${formatPrice(log.price)}</span>` : ''}
            ${durHtml}
          </div>
        </div>`;
    }).join('');

    if (logs.length > 150) {
      container.innerHTML += `<p class="empty-state" style="padding:10px">
        +${logs.length - 150} kayıt daha — Arşiv sekmesinden tümünü görün.</p>`;
    }
  }

  async function clearAll() {
    if (!confirm('Bugünkü loglar silinsin mi?\n(Arşivlenmiş günler korunur.)')) return;
    await chrome.storage.local.set({ [STORAGE_KEYS.TODAY]: [] });
    await load();
  }

  // ── CSV Export — CSVExporter modülüne delege ──────────
  async function exportCSV() {
    const query     = document.getElementById('logSearch').value;
    const action    = document.getElementById('actionFilter').value;
    const sortOrder = document.getElementById('sortOrder').value;

    let filtered = [...allLogs];
    if (action) filtered = filtered.filter(l => l.action?.includes(action));
    if (query) {
      const q = caseSensitive ? query : query.toUpperCase();
      filtered = filtered.filter(l =>
        ((caseSensitive ? l.symbol : l.symbol?.toUpperCase()) || '').includes(q)
      );
    }
    filtered.sort((a, b) =>
      sortOrder === 'asc' ? (a.timestamp||0) - (b.timestamp||0) : (b.timestamp||0) - (a.timestamp||0)
    );

    const first = filtered[0];
    const last  = filtered[filtered.length - 1];
    const range = (first && last && first.date !== last.date)
      ? `${first.date} – ${last.date}`
      : (first?.date || '');

    CSVExporter.fromLogsModule(filtered, range);
  }

  function toggleCase() {
    caseSensitive = !caseSensitive;
    document.getElementById('caseToggle').classList.toggle('active', caseSensitive);
    applyFilters();
  }

  function getAll() { return allLogs; }

  return { load, applyFilters, clearAll, exportCSV, toggleCase, getAll };
})();