// TradingView Logger — Archive Module v3.1
// ==========================================

const ArchiveModule = (() => {
  let archiveIndex = [];
  let selectedDay  = null;
  let selectedLogs = [];

  // ── Güvenli getElementById yardımcısı ────────────────
  function _el(id) {
    return document.getElementById(id);
  }

  async function load() {
    // archiveDayList her zaman HTML'de mevcut — archiveContainer yok, doğrusu bu
    const dayList = _el('archiveDayList');
    if (dayList) dayList.innerHTML = '<p class="empty-state">Yükleniyor...</p>';

    try {
      archiveIndex = await StorageManager.readIndex();
    } catch (e) {
      if (dayList) dayList.innerHTML =
        `<p class="empty-state">OPFS erisim hatasi: ${escapeHtml(e.message)}</p>`;
      return;
    }

    await _renderStorageInfo();
    renderDayList();
  }

  async function _renderStorageInfo() {
    const el = _el('storageInfoBar');
    if (!el) return;

    const info = await new Promise(resolve =>
      chrome.runtime.sendMessage({ type: 'GET_STORAGE_INFO' }, r => resolve(r?.info || {}))
    );

    const fmt = b => b < 1024 ? `${b} B` : b < 1048576
      ? `${(b/1024).toFixed(1)} KB`
      : `${(b/1048576).toFixed(2)} MB`;
    const pct = info.quotaBytes
      ? Math.round((info.usedBytes / info.quotaBytes) * 100) : 0;

    el.innerHTML = `
      <div class="storage-bar-wrap">
        <div class="storage-bar" style="width:${Math.min(pct,100)}%"></div>
      </div>
      <div class="storage-text">
        <span>OPFS: ${fmt(info.usedBytes||0)} / ${fmt(info.quotaBytes||0)} (${pct}%)</span>
        <span>Local: ${fmt(info.localBytes||0)}</span>
        <span>${archiveIndex.length} gun arsivlendi</span>
      </div>`;
  }

  function renderDayList(filterText = '') {
    const container = _el('archiveDayList');
    if (!container) return;

    let days = [...archiveIndex];
    if (filterText) days = days.filter(d => d.includes(filterText));

    if (!days.length) {
      container.innerHTML = filterText
        ? `<p class="empty-state">"${escapeHtml(filterText)}" ile eslesen gun yok.</p>`
        : '<p class="empty-state">Henuz arsivlenmis gun yok.<br>Ilk gun gecisinde otomatik olusturulur.</p>';
      return;
    }

    // Ay başlıklarıyla grupla
    const byMonth = {};
    for (const d of days) {
      const key = d.slice(0, 7);
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(d);
    }

    container.innerHTML = Object.entries(byMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([mk, mDays]) => {
        const [y, m] = mk.split('-');
        const monthName = new Date(Number(y), Number(m)-1, 1)
          .toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

        return `
          <div class="archive-month-group">
            <div class="archive-month-title">${monthName}</div>
            ${mDays.map(d => `
              <div class="archive-day-item ${d === selectedDay ? 'active' : ''}"
                   data-day="${d}" role="button" tabindex="0">
                <span class="archive-day-label">${_fmtDayLabel(d)}</span>
                <div class="archive-day-actions">
                  <button class="btn-icon archive-export-btn"
                          data-day="${d}" title="CSV indir">📥</button>
                </div>
              </div>`).join('')}
          </div>`;
      }).join('');

    // Gün tıklama event'leri
    container.querySelectorAll('.archive-day-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('.archive-export-btn')) return;
        selectDay(el.dataset.day);
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') selectDay(el.dataset.day);
      });
    });

    // Tekli CSV export butonları
    container.querySelectorAll('.archive-export-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const day  = btn.dataset.day;
        const logs = await StorageManager.readDay(day);
        if (!logs.length) { alert('Bu gunde log yok.'); return; }
        CSVExporter.fromDay(day, logs);
      });
    });
  }

  async function selectDay(day) {
    selectedDay  = day;
    selectedLogs = await StorageManager.readDay(day);

    // Aktif stili güncelle
    document.querySelectorAll('.archive-day-item').forEach(el =>
      el.classList.toggle('active', el.dataset.day === day)
    );

    renderDayDetail();
  }

  function renderDayDetail() {
    const panel = _el('archiveDayDetail');
    if (!panel) return;

    if (!selectedDay || !selectedLogs.length) {
      panel.innerHTML = `<p class="empty-state">${
        selectedDay
          ? `${_fmtDayLabel(selectedDay)}<br>Log bulunamadi.`
          : 'Soldan bir gun secin.'
      }</p>`;
      return;
    }

    const uniqSyms = [...new Set(selectedLogs.map(l => l.symbol).filter(Boolean))];
    const totalMs  = selectedLogs.reduce((s, l) => s + (l.sessionMs||0), 0);

    const logHtml = selectedLogs.map(log => {
      let cls = '';
      if (log.action?.includes('Başladı'))      cls = 'log-start';
      else if (log.action?.includes('Değişti')) cls = 'log-change';
      else if (log.action?.includes('Kapandı')) cls = 'log-end';

      const durHtml = log.sessionMs > 2000
        ? `<span class="log-duration">⏱ ${formatDuration(log.sessionMs)}</span>` : '';

      return `
        <div class="log-item ${cls}" style="margin-bottom:5px">
          <div class="log-header">
            <span class="log-date">${escapeHtml(log.time || '-')}</span>
            <span class="log-symbol">${escapeHtml(log.symbol || '?')}</span>
          </div>
          <div class="log-action">${escapeHtml(log.action || '-')}</div>
          <div class="log-details">
            ${log.price ? `<span class="log-price">💰 ${formatPrice(log.price)}</span>` : ''}
            ${durHtml}
          </div>
        </div>`;
    }).join('');

    // exportDayBtn'i innerHTML içine koyup sonra addEventListener ile bağla
    // getElementById KULLANMA — innerHTML'den hemen sonra querySelector kullan
    panel.innerHTML = `
      <div class="archive-detail-header">
        <div>
          <div class="archive-detail-date">${_fmtDayLabel(selectedDay)}</div>
          <div class="archive-detail-meta">
            ${selectedLogs.length} kayit · ${uniqSyms.length} hisse · ⏱ ${formatDuration(totalMs)}
          </div>
          <div class="archive-detail-symbols">
            ${uniqSyms.slice(0,8).map(s =>
              `<span class="archive-sym-chip">${escapeHtml(s)}</span>`
            ).join('')}
            ${uniqSyms.length > 8
              ? `<span class="archive-sym-chip muted">+${uniqSyms.length-8}</span>`
              : ''}
          </div>
        </div>
        <button class="btn btn-secondary export-day-btn-inner"
                style="flex-shrink:0;width:auto;padding:6px 12px">📥 CSV</button>
      </div>
      <div class="archive-log-list">${logHtml}</div>`;

    // querySelector ile bul — getElementById('exportDayBtn') NULL dönerdi
    panel.querySelector('.export-day-btn-inner')
      ?.addEventListener('click', () => CSVExporter.fromDay(selectedDay, selectedLogs));
  }

  async function exportAllArchive() {
    const btn = _el('exportAllArchiveBtn');
    if (btn) { btn.textContent = '⏳ Hazirlaniyor...'; btn.disabled = true; }

    chrome.runtime.sendMessage({ type: 'EXPORT_ARCHIVE' }, resp => {
      if (btn) { btn.textContent = '📦 Tumunu Indir'; btn.disabled = false; }
      if (!resp?.csv) { alert('Arsiv bos veya bir hata olustu.'); return; }
      CSVExporter.fromArchiveString(resp.csv);
    });
  }

  function _fmtDayLabel(dateStr) {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m-1, d).toLocaleDateString('tr-TR', {
        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch { return dateStr; }
  }

  return { load, renderDayList, exportAllArchive };
})();