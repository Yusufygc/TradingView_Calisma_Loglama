// TradingView Logger - Popup Logic v3.0
// ======================================

const STORAGE_KEYS = {
  LOGS:       'activityLogs',
  NOTES:      'stockNotes',
  LAST_VIEWS: 'stockLastViews'
};

let currentSymbol = null;
let allLogs = [];          // Ham log cache — filtre/arama bu array üzerinde çalışır
let caseSensitive = false; // Büyük/küçük harf toggle

// ═══════════════════════════════════════════
// YARDIMCI
// ═══════════════════════════════════════════

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// Arama metnindeki eşleşmeleri <mark> ile vurgula
function highlightMatch(text, query, caseSens) {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = caseSens ? 'g' : 'gi';
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
    if (lastComma > lastDot) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
      return parseFloat(cleaned.replace(/,/g, ''));
    }
  } else if (hasComma) {
    const afterComma = cleaned.split(',')[1] || '';
    if (afterComma.length === 3 && !afterComma.includes('.')) {
      return parseFloat(cleaned.replace(/,/g, ''));
    }
    return parseFloat(cleaned.replace(',', '.'));
  } else {
    return parseFloat(cleaned);
  }
}

function formatPrice(price) {
  const p = normalizePrice(price);
  if (p === null || isNaN(p)) return '-';
  return p.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeSince(timestamp) {
  const diff = Date.now() - timestamp;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0)  return `${d}g önce`;
  if (h > 0)  return `${h}sa önce`;
  if (m > 0)  return `${m}dk önce`;
  return 'az önce';
}

// ═══════════════════════════════════════════
// HEADER — CANLI SEMBOL & FİYAT
// ═══════════════════════════════════════════

function updateLiveHeader(symbol, price) {
  const symEl   = document.getElementById('liveSymbol');
  const priceEl = document.getElementById('livePrice');
  if (symbol) {
    symEl.textContent   = symbol;
    priceEl.textContent = price ? `  ${formatPrice(price)}` : '';
  } else {
    symEl.textContent   = 'TradingView açık değil';
    priceEl.textContent = '';
  }
}

// ═══════════════════════════════════════════
// LOG YÖNETİMİ
// ═══════════════════════════════════════════

async function loadLogs() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.LOGS]);
  allLogs = result[STORAGE_KEYS.LOGS] || [];

  const today = new Date().toLocaleDateString('tr-TR');
  const todayCount = allLogs.filter(l => l.date === today).length;

  document.getElementById('totalLogs').textContent = allLogs.length;
  document.getElementById('todayLogs').textContent = todayCount;

  // En çok bakılan hisse
  const symCount = {};
  allLogs.forEach(l => { if (l.symbol && l.symbol !== 'Bilinmiyor') symCount[l.symbol] = (symCount[l.symbol] || 0) + 1; });
  const topSym = Object.entries(symCount).sort((a,b) => b[1]-a[1])[0];
  document.getElementById('topSymbol').textContent = topSym ? topSym[0] : '—';

  applyFilters();
}

function applyFilters() {
  const query      = document.getElementById('logSearch').value;
  const action     = document.getElementById('actionFilter').value;
  const sortOrder  = document.getElementById('sortOrder').value;
  const infoEl     = document.getElementById('searchResultInfo');

  let filtered = [...allLogs];

  // Aksiyon filtresi
  if (action) {
    filtered = filtered.filter(l => l.action && l.action.includes(action));
  }

  // Arama filtresi
  if (query) {
    const q = caseSensitive ? query : query.toUpperCase();
    filtered = filtered.filter(l => {
      const sym = caseSensitive ? (l.symbol || '') : (l.symbol || '').toUpperCase();
      const act = caseSensitive ? (l.action || '') : (l.action || '').toUpperCase();
      const sq  = caseSensitive ? q : q;
      return sym.includes(sq) || act.includes(sq);
    });

    const total = allLogs.filter(l => action ? l.action?.includes(action) : true).length;
    infoEl.style.display = 'block';
    infoEl.textContent = `${filtered.length} / ${total} kayıt eşleşti`;
  } else {
    infoEl.style.display = 'none';
  }

  // Sıralama
  if (sortOrder === 'asc') {
    filtered.sort((a,b) => a.timestamp - b.timestamp);
  } else {
    filtered.sort((a,b) => b.timestamp - a.timestamp);
  }

  displayLogs(filtered, query);
}

function displayLogs(logs, searchQuery) {
  const container = document.getElementById('logsContainer');

  if (logs.length === 0) {
    const msg = searchQuery
      ? `"${escapeHtml(searchQuery)}" için sonuç bulunamadı.`
      : 'Henüz log yok. TradingView\'de bir hisse açın.';
    container.innerHTML = `<p class="empty-state">${msg}</p>`;
    return;
  }

  const shown = logs.slice(0, 150);

  container.innerHTML = shown.map(log => {
    let cssClass = '';
    if (log.action?.includes('Başladı'))  cssClass = 'log-start';
    else if (log.action?.includes('Değişti')) cssClass = 'log-change';
    else if (log.action?.includes('Kapandı')) cssClass = 'log-end';

    const details = log.details || {};
    const detailText = Object.entries(details)
      .filter(([k]) => k !== 'fiyat')
      .map(([k, v]) => `<b>${k}:</b> ${escapeHtml(String(v))}`)
      .join(' | ');

    const symbolHtml = highlightMatch(log.symbol || '?', searchQuery, caseSensitive);
    const ago = log.timestamp ? `· ${timeSince(log.timestamp)}` : '';

    return `
      <div class="log-item ${cssClass}">
        <div class="log-header">
          <span class="log-date">${escapeHtml(log.date)} ${escapeHtml(log.time)} <span style="opacity:.5">${ago}</span></span>
          <span class="log-symbol">${symbolHtml}</span>
        </div>
        <div class="log-action">${escapeHtml(log.action)}</div>
        <div class="log-details">
          ${detailText}
          ${log.price ? `<div class="log-price">💰 ${formatPrice(log.price)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (logs.length > 150) {
    container.innerHTML += `<p class="empty-state" style="padding:10px">... ve ${logs.length - 150} kayıt daha. CSV indirerek tamamını görün.</p>`;
  }
}

async function clearLogs() {
  if (confirm('Tüm kayıtlar silinsin mi?')) {
    await chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: [] });
    allLogs = [];
    loadLogs();
  }
}

// ═══════════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════════

async function exportCSV() {
  // Mevcut filtre uygulanmış logu export et
  const query     = document.getElementById('logSearch').value;
  const action    = document.getElementById('actionFilter').value;
  const sortOrder = document.getElementById('sortOrder').value;

  let filtered = [...allLogs];
  if (action) filtered = filtered.filter(l => l.action?.includes(action));
  if (query) {
    const q = caseSensitive ? query : query.toUpperCase();
    filtered = filtered.filter(l => {
      const sym = caseSensitive ? (l.symbol||'') : (l.symbol||'').toUpperCase();
      return sym.includes(q) || (l.action||'').toUpperCase().includes(q);
    });
  }
  if (sortOrder === 'asc') filtered.sort((a,b) => a.timestamp - b.timestamp);
  else filtered.sort((a,b) => b.timestamp - a.timestamp);

  if (filtered.length === 0) { alert('İndirilecek veri yok.'); return; }

  const headers = ['Tarih','Saat','Sembol','Aksiyon','Fiyat','Detay'];
  const rows = filtered.map(l => {
    const d = l.details || {};
    const detailStr = Object.entries(d).map(([k,v]) => `${k}:${v}`).join(' ');
    return [
      l.date, l.time, l.symbol, l.action,
      formatPrice(l.price),
      `"${detailStr.replace(/"/g, '""')}"`
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `tvlogger_${Date.now()}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ═══════════════════════════════════════════
// NOT YÖNETİMİ
// ═══════════════════════════════════════════

let allNotes = {};

async function loadNotes(searchQuery) {
  const result = await chrome.storage.local.get([STORAGE_KEYS.NOTES]);
  allNotes = result[STORAGE_KEYS.NOTES] || {};
  renderNotes(searchQuery || document.getElementById('noteSearch').value);
}

function renderNotes(query) {
  const container = document.getElementById('allNotesContainer');
  let entries = Object.entries(allNotes);

  if (query) {
    const q = query.toLowerCase();
    entries = entries.filter(([sym, data]) =>
      sym.toLowerCase().includes(q) || data.note.toLowerCase().includes(q)
    );
  }

  // En son güncellenen önce
  entries.sort((a,b) => (b[1].updatedAt||0) - (a[1].updatedAt||0));

  if (entries.length === 0) {
    container.innerHTML = query
      ? `<p class="empty-state">"${escapeHtml(query)}" için not bulunamadı.</p>`
      : '<p class="empty-state">Henüz not yok.</p>';
    return;
  }

  container.innerHTML = entries.map(([sym, data]) => {
    const dateStr = data.updatedAt
      ? new Date(data.updatedAt).toLocaleDateString('tr-TR')
      : '';
    const symHtml  = highlightMatch(sym, query, false);
    const noteHtml = highlightMatch(data.note, query, false);
    return `
      <div class="note-card">
        <div class="note-card-header">
          <span class="note-card-symbol">${symHtml}</span>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="note-card-date">${dateStr}</span>
            <div class="note-actions">
              <button class="btn-icon edit-note-btn" data-symbol="${escapeHtml(sym)}" title="Düzenle">✏️</button>
              <button class="btn-icon btn-icon-danger delete-note-btn" data-symbol="${escapeHtml(sym)}" title="Sil">🗑️</button>
            </div>
          </div>
        </div>
        <div class="note-card-text">${noteHtml}</div>
      </div>
    `;
  }).join('');

  // Silme
  container.querySelectorAll('.delete-note-btn').forEach(btn => {
    btn.onclick = async (e) => {
      const s = e.currentTarget.dataset.symbol;
      if (confirm(`"${s}" notunu sil?`)) {
        delete allNotes[s];
        await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: allNotes });
        renderNotes(document.getElementById('noteSearch').value);
        if (currentSymbol === s) checkCurrentSymbolNote();
      }
    };
  });

  // Düzenleme
  container.querySelectorAll('.edit-note-btn').forEach(btn => {
    btn.onclick = (e) => {
      const s = e.currentTarget.dataset.symbol;
      const currentInput  = document.getElementById('noteInput').value.trim();
      const currentBadge  = document.getElementById('noteBadge').textContent;
      const isEditing     = currentBadge.includes('Düzenleniyor');
      if (isEditing && currentInput && currentSymbol !== s) {
        if (!confirm(`"${currentSymbol}" için kaydedilmemiş değişiklik var. Devam edilsin mi?`)) return;
      }
      const noteData = allNotes[s];
      if (noteData) {
        currentSymbol = s;
        document.getElementById('currentSymbol').textContent = s;
        document.getElementById('noteInput').value = noteData.note;
        document.getElementById('noteInput').focus();
        document.getElementById('noteBadge').textContent = '✏️ Düzenleniyor';
        document.getElementById('noteBadge').classList.add('has-note');
        document.querySelector('[data-tab="notes"]').click();
      }
    };
  });
}

async function saveCurrentNote() {
  const text = document.getElementById('noteInput').value.trim();
  if (!currentSymbol) return;

  if (text) {
    allNotes[currentSymbol] = { note: text, updatedAt: Date.now() };
  } else {
    delete allNotes[currentSymbol];
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: allNotes });

  renderNotes(document.getElementById('noteSearch').value);
  checkCurrentSymbolNote();

  const btn = document.getElementById('saveNote');
  const orig = btn.textContent;
  btn.textContent = '✓ Kaydedildi';
  setTimeout(() => btn.textContent = orig, 1500);
}

async function clearCurrentNote() {
  if (!currentSymbol) return;
  if (document.getElementById('noteInput').value && !confirm(`"${currentSymbol}" notunu temizle?`)) return;
  document.getElementById('noteInput').value = '';
  delete allNotes[currentSymbol];
  await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: allNotes });
  renderNotes(document.getElementById('noteSearch').value);
  checkCurrentSymbolNote();
}

async function checkCurrentSymbolNote() {
  if (!currentSymbol) return;
  const badge = document.getElementById('noteBadge');
  const input = document.getElementById('noteInput');
  if (allNotes[currentSymbol]) {
    badge.textContent = '✓ Not Var';
    badge.classList.add('has-note');
    input.value = allNotes[currentSymbol].note;
  } else {
    badge.textContent = '';
    badge.classList.remove('has-note');
    input.value = '';
  }
}

// ═══════════════════════════════════════════
// İSTATİSTİK TABLOSU
// ═══════════════════════════════════════════

async function loadStats() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.LOGS, STORAGE_KEYS.LAST_VIEWS]);
  const logs      = result[STORAGE_KEYS.LOGS]      || [];
  const lastViews = result[STORAGE_KEYS.LAST_VIEWS] || {};
  const container = document.getElementById('statsSummary');

  if (logs.length === 0) {
    container.innerHTML = '<p class="empty-state">Henüz yeterli veri yok.</p>';
    return;
  }

  // Sembol bazında görüntülenme sayısı
  const symCount = {};
  logs.forEach(l => {
    if (l.symbol && l.symbol !== 'Bilinmiyor') {
      symCount[l.symbol] = (symCount[l.symbol] || 0) + 1;
    }
  });
  const ranked = Object.entries(symCount).sort((a,b) => b[1]-a[1]);
  const maxCount = ranked[0]?.[1] || 1;

  const rankColors = ['gold','silver','bronze'];

  const rankHtml = ranked.slice(0,10).map(([sym, count], i) => {
    const pct = Math.round((count / maxCount) * 100);
    const posClass = rankColors[i] || '';
    return `
      <div class="symbol-rank-item">
        <span class="rank-pos ${posClass}">${i+1}</span>
        <span class="rank-sym">${escapeHtml(sym)}</span>
        <div class="rank-bar-wrap"><div class="rank-bar" style="width:${pct}%"></div></div>
        <span class="rank-count">${count} log</span>
      </div>
    `;
  }).join('');

  // Fiyat geçmişi — lastViews'dan çek
  const priceEntries = Object.entries(lastViews)
    .map(([sym, data]) => ({ sym, ...data }))
    .sort((a,b) => (b.date||0) - (a.date||0));

  let priceHtml = '';
  if (priceEntries.length > 0) {
    // Önceki fiyatı bulmak için logları tara
    priceHtml = priceEntries.slice(0,8).map(entry => {
      const { sym, price, date } = entry;
      const dateStr = date ? new Date(date).toLocaleDateString('tr-TR') : '—';

      // Bu sembol için en eski log fiyatını bul
      const symLogs = logs.filter(l => l.symbol === sym && l.price && l.price !== '-');
      let changeHtml = '';
      if (symLogs.length >= 2) {
        const firstPrice = normalizePrice(symLogs[0].price);
        const lastPrice  = normalizePrice(price);
        if (firstPrice && lastPrice && firstPrice > 0) {
          const diff = lastPrice - firstPrice;
          const pct  = ((diff / firstPrice) * 100).toFixed(2);
          if (Math.abs(diff) < 0.01) {
            changeHtml = '<span class="price-change flat">➡ Değişmedi</span>';
          } else if (diff > 0) {
            changeHtml = `<span class="price-change up">▲ +%${pct}</span>`;
          } else {
            changeHtml = `<span class="price-change down">▼ %${pct}</span>`;
          }
        }
      }

      return `
        <div class="price-history-item">
          <div class="price-history-header">
            <span class="price-history-sym">${escapeHtml(sym)}</span>
            <span class="price-history-date">Son: ${dateStr}</span>
          </div>
          <div class="price-detail">
            Son fiyat: <strong style="color:var(--warning)">${formatPrice(price)}</strong>
            ${changeHtml ? `&nbsp;${changeHtml}` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = `
    <div class="stats-scroll">
      <div class="stats-section-title">En Çok Görüntülenen</div>
      <div class="symbol-rank-list">${rankHtml || '<p class="empty-state">Veri yok.</p>'}</div>

      ${priceHtml ? `
        <div class="stats-section-title">Fiyat Geçmişi</div>
        ${priceHtml}
      ` : ''}
    </div>
  `;
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {

  // ── Tab yönetimi
  document.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const tabId = t.dataset.tab + '-tab';
      document.getElementById(tabId).classList.add('active');
      if (t.dataset.tab === 'stats') loadStats();
    };
  });

  // ── Log arama
  const logSearchEl    = document.getElementById('logSearch');
  const caseToggleEl   = document.getElementById('caseToggle');
  const clearSearchEl  = document.getElementById('clearSearch');
  const actionFilterEl = document.getElementById('actionFilter');
  const sortOrderEl    = document.getElementById('sortOrder');

  logSearchEl.addEventListener('input', () => {
    clearSearchEl.style.display = logSearchEl.value ? 'block' : 'none';
    applyFilters();
  });

  caseToggleEl.addEventListener('click', () => {
    caseSensitive = !caseSensitive;
    caseToggleEl.classList.toggle('active', caseSensitive);
    caseToggleEl.title = caseSensitive ? 'Büyük/küçük harf DUYARLI' : 'Büyük/küçük harf duyarsız';
    applyFilters();
  });

  clearSearchEl.addEventListener('click', () => {
    logSearchEl.value = '';
    clearSearchEl.style.display = 'none';
    applyFilters();
    logSearchEl.focus();
  });

  actionFilterEl.addEventListener('change', applyFilters);
  sortOrderEl.addEventListener('change', applyFilters);

  // Escape ile arama temizle
  logSearchEl.addEventListener('keydown', e => {
    if (e.key === 'Escape') { logSearchEl.value = ''; clearSearchEl.style.display='none'; applyFilters(); }
  });

  // ── Not arama
  const noteSearchEl      = document.getElementById('noteSearch');
  const clearNoteSearchEl = document.getElementById('clearNoteSearch');

  noteSearchEl.addEventListener('input', () => {
    clearNoteSearchEl.style.display = noteSearchEl.value ? 'block' : 'none';
    renderNotes(noteSearchEl.value);
  });
  clearNoteSearchEl.addEventListener('click', () => {
    noteSearchEl.value = '';
    clearNoteSearchEl.style.display = 'none';
    renderNotes('');
    noteSearchEl.focus();
  });
  noteSearchEl.addEventListener('keydown', e => {
    if (e.key === 'Escape') { noteSearchEl.value=''; clearNoteSearchEl.style.display='none'; renderNotes(''); }
  });

  // ── Ctrl+Enter ile not kaydet
  document.getElementById('noteInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveCurrentNote(); }
  });

  // ── Butonlar
  document.getElementById('exportCSV').onclick = exportCSV;
  document.getElementById('clearLogs').onclick  = clearLogs;
  document.getElementById('saveNote').onclick   = saveCurrentNote;
  document.getElementById('clearNote').onclick  = clearCurrentNote;

  // ── Verileri yükle
  await loadLogs();
  await loadNotes();

  // ── Aktif TradingView sekmesini bul
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('tradingview.com')) {
      try {
        const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
        if (resp?.state?.currentSymbol) {
          currentSymbol = resp.state.currentSymbol;
          updateLiveHeader(currentSymbol, resp.state.currentPrice);
          document.getElementById('currentSymbol').textContent = currentSymbol;
          checkCurrentSymbolNote();
        }
      } catch (e) {
        // Content script henüz inject olmamış — title'dan parse et
        const m = tab.title?.match(/^([A-Z][A-Z0-9./]+)/);
        if (m && m[1] !== 'TradingView') {
          currentSymbol = m[1];
          updateLiveHeader(currentSymbol, null);
          document.getElementById('currentSymbol').textContent = currentSymbol;
          checkCurrentSymbolNote();
        } else {
          updateLiveHeader(null, null);
        }
      }
    } else {
      updateLiveHeader(null, null);
    }
  } catch(e) {
    updateLiveHeader(null, null);
  }
});