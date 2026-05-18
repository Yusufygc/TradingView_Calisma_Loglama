// TradingView Logger — Popup Init v3.1
// ======================================

// Güvenli getElementById — null dönerse hata fırlatmaz
function $id(id) {
  return document.getElementById(id);
}

// Güvenli addEventListener — element null ise sessizce geçer
function $on(id, event, handler) {
  const el = $id(id);
  if (el) el.addEventListener(event, handler);
}

document.addEventListener('DOMContentLoaded', async () => {

  // ── Pinned window modu ─────────────────────────────
  const isPinned = new URLSearchParams(window.location.search).has('pinned');
  if (isPinned) {
    document.body.classList.add('pinned');
    $id('pinBtn')?.remove();
  }

  // ── Tab yönetimi ───────────────────────────────────
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const tabContent = $id(tab.dataset.tab + '-tab');
      if (tabContent) tabContent.classList.add('active');
      if (tab.dataset.tab === 'stats')   StatsModule.load();
      if (tab.dataset.tab === 'archive') ArchiveModule.load();
      if (tab.dataset.tab === 'telegram') TelegramModule.load();
    });
  });

  // ── Log tab eventleri ──────────────────────────────
  $on('logSearch', 'input', e => {
    const clear = $id('clearSearch');
    if (clear) clear.style.display = e.target.value ? 'block' : 'none';
    LogsModule.applyFilters();
  });

  $on('caseToggle', 'click', LogsModule.toggleCase);

  $on('clearSearch', 'click', () => {
    const input = $id('logSearch');
    const clear = $id('clearSearch');
    if (input) input.value = '';
    if (clear) clear.style.display = 'none';
    LogsModule.applyFilters();
    if (input) input.focus();
  });

  $on('logSearch', 'keydown', e => {
    if (e.key === 'Escape') $id('clearSearch')?.click();
  });

  $on('actionFilter', 'change', LogsModule.applyFilters);
  $on('sortOrder',    'change', LogsModule.applyFilters);
  $on('exportCSV',   'click',  LogsModule.exportCSV);
  $on('clearLogs',   'click',  LogsModule.clearAll);

  // ── Notes tab eventleri ────────────────────────────
  $on('noteSearch', 'input', e => {
    const clear = $id('clearNoteSearch');
    if (clear) clear.style.display = e.target.value ? 'block' : 'none';
    NotesModule.renderNotes(e.target.value);
  });

  $on('clearNoteSearch', 'click', () => {
    const input = $id('noteSearch');
    const clear = $id('clearNoteSearch');
    if (input) input.value = '';
    if (clear) clear.style.display = 'none';
    NotesModule.renderNotes('');
    if (input) input.focus();
  });

  $on('noteSearch', 'keydown', e => {
    if (e.key === 'Escape') $id('clearNoteSearch')?.click();
  });

  $on('noteInput', 'keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      NotesModule.save();
    }
  });

  $on('saveNote',   'click', NotesModule.save);
  $on('clearNote',  'click', NotesModule.clearNote);
  $on('exportNotesCSV',  'click', () => NotesModule.exportNotes('csv'));
  $on('exportNotesJSON', 'click', () => NotesModule.exportNotes('json'));

  // ── Archive tab eventleri ──────────────────────────
  $on('archiveSearch', 'input', e => {
    const v     = e.target.value;
    const clear = $id('clearArchiveSearch');
    if (clear) clear.style.display = v ? 'block' : 'none';
    ArchiveModule.renderDayList(v);
  });

  $on('clearArchiveSearch', 'click', () => {
    const input = $id('archiveSearch');
    const clear = $id('clearArchiveSearch');
    if (input) input.value = '';
    if (clear) clear.style.display = 'none';
    ArchiveModule.renderDayList('');
    if (input) input.focus();
  });

  $on('exportAllArchiveBtn', 'click', ArchiveModule.exportAllArchive);

  $on('archiveNowBtn', 'click', () => {
    const btn = $id('archiveNowBtn');
    if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

    chrome.runtime.sendMessage({ type: 'ARCHIVE_NOW' }, async () => {
      // Popup kapandıysa btn artık DOM'da olmayabilir — null guard şart
      const b = $id('archiveNowBtn');
      if (b) {
        b.textContent = '✓';
        b.disabled    = false;
        setTimeout(() => { const b2 = $id('archiveNowBtn'); if (b2) b2.textContent = '🗄️'; }, 1500);
      }
      await ArchiveModule.load();
    });
  });

  // ── Pinned window aç ───────────────────────────────
  $on('pinBtn', 'click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_PINNED' });
  });

  // ── Verileri yükle ─────────────────────────────────
  await LogsModule.load();
  await NotesModule.load();
  await TelegramModule.load();

  // ── Aktif TradingView sekmesini bul ────────────────
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('tradingview.com')) {
      try {
        const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
        if (resp?.state?.currentSymbol) {
          window._currentSymbol = resp.state.currentSymbol;
          updateLiveHeader(
            resp.state.currentSymbol,
            resp.state.currentPrice,
            resp.state.currentSessionMs
          );
          NotesModule.setActiveSymbol(resp.state.currentSymbol);
        }
      } catch {
        const m = tab.title?.match(/^([A-Z][A-Z0-9./]+)/);
        if (m && m[1] !== 'TradingView') {
          window._currentSymbol = m[1];
          updateLiveHeader(m[1], null, null);
          NotesModule.setActiveSymbol(m[1]);
        } else {
          updateLiveHeader(null, null, null);
        }
      }
    } else {
      updateLiveHeader(null, null, null);
    }
  } catch {
    updateLiveHeader(null, null, null);
  }
});

function updateLiveHeader(symbol, price, sessionMs) {
  const symEl   = $id('liveSymbol');
  const priceEl = $id('livePrice');
  const sesEl   = $id('liveSession');

  if (symEl)   symEl.textContent   = symbol || 'TradingView açık değil';
  if (priceEl) priceEl.textContent = price  ? `  ${formatPrice(price)}` : '';
  if (sesEl)   sesEl.textContent   = (sessionMs > 2000) ? `⏱ ${formatDuration(sessionMs)}` : '';
}
