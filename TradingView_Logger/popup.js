// TradingView Simple Logger - Popup Logic
// =======================================

const STORAGE_KEYS = {
  LOGS: 'activityLogs',
  NOTES: 'stockNotes',
  LAST_VIEWS: 'stockLastViews'
};

let currentSymbol = null;

// ==================== YARDIMCI FONKSİYONLAR ====================

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function normalizePrice(price) {
  if (!price || price === '-' || price === '') return null;
  const cleaned = String(price).trim().replace(/\s/g, '');
  if (!cleaned) return null;

  // TR vs EN format
  if (cleaned.includes(',')) {
    // 1.234,56 -> 1234.56
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  } else {
    // 1,234.56 -> 1234.56
    return parseFloat(cleaned.replace(/,/g, ''));
  }
}

function formatPrice(price) {
  const p = normalizePrice(price);
  if (p === null) return '-';
  return p.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ==================== LOG YÖNETİMİ ====================

async function loadLogs() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.LOGS]);
  const logs = result[STORAGE_KEYS.LOGS] || [];

  // İstatistikler
  const today = new Date().toLocaleDateString('tr-TR');
  const todayLogs = logs.filter(l => l.date === today);

  document.getElementById('totalLogs').textContent = logs.length;
  document.getElementById('todayLogs').textContent = todayLogs.length;

  displayLogs(logs);
}

function displayLogs(logs) {
  const container = document.getElementById('logsContainer');

  if (logs.length === 0) {
    container.innerHTML = '<p class="empty-state">Henüz log yok.</p>';
    return;
  }

  // Ters sırala (en yeni en üstte)
  const sortedLogs = [...logs].reverse().slice(0, 100);

  container.innerHTML = sortedLogs.map(log => {
    let cssClass = '';
    if (log.action.includes('Başladı')) cssClass = 'log-start';
    else if (log.action.includes('Değişti')) cssClass = 'log-change';
    else if (log.action.includes('Kapandı')) cssClass = 'log-end';

    // Detayları formatla
    const details = log.details || {};
    const detailText = Object.entries(details)
      .filter(([k]) => k !== 'fiyat')
      .map(([k, v]) => `<b>${k}:</b> ${v}`)
      .join(' | ');

    return `
      <div class="log-item ${cssClass}">
        <div class="log-header">
          <span class="log-date">${log.date} ${log.time}</span>
          <span class="log-symbol">${escapeHtml(log.symbol)}</span>
        </div>
        <div class="log-action">${escapeHtml(log.action)}</div>
        <div class="log-details">
          ${detailText}
          ${log.price ? `<div class="log-price">💰 ${formatPrice(log.price)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function clearLogs() {
  if (confirm('Tüm kayıtlar silinsin mi?')) {
    await chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: [] });
    loadLogs();
  }
}

// ==================== CSV EXPORT ====================

async function exportCSV() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.LOGS]);
  const logs = result[STORAGE_KEYS.LOGS] || [];

  if (logs.length === 0) {
    alert('İndirilecek veri yok.');
    return;
  }

  // CSV Oluştur
  const headers = ['Tarih', 'Saat', 'Sembol', 'Aksiyon', 'Fiyat', 'Detay'];
  const rows = logs.map(l => {
    const d = l.details || {};
    const detailStr = Object.entries(d).map(([k, v]) => `${k}:${v}`).join(' ');

    return [
      l.date,
      l.time,
      l.symbol,
      l.action,
      formatPrice(l.price),
      `"${detailStr.replace(/"/g, '""')}"`
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `tradingview_logs_${Date.now()}.csv`;
  a.click();
}

// ==================== NOT YÖNETİMİ ====================

async function loadNotes() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.NOTES]);
  const notes = result[STORAGE_KEYS.NOTES] || {};

  const container = document.getElementById('allNotesContainer');
  const entries = Object.entries(notes);

  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-state">Henüz not yok.</p>';
    return;
  }

  container.innerHTML = entries.map(([sym, data]) => `
    <div class="note-card">
      <div class="note-card-header">
        <span class="note-card-symbol">${escapeHtml(sym)}</span>
        <div class="note-actions">
          <button class="btn-icon edit-note-btn" data-symbol="${escapeHtml(sym)}" title="Düzenle">✏️</button>
          <button class="btn-icon btn-icon-danger delete-note-btn" data-symbol="${escapeHtml(sym)}" title="Sil">🗑️</button>
        </div>
      </div>
      <div class="note-card-text">${escapeHtml(data.note)}</div>
    </div>
  `).join('');

  // Silme butonları
  document.querySelectorAll('.delete-note-btn').forEach(btn => {
    btn.onclick = async (e) => {
      const s = e.target.closest('.delete-note-btn').dataset.symbol;
      if (confirm(`${s} notunu sil?`)) {
        delete notes[s];
        await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: notes });
        loadNotes();
        if (currentSymbol === s) checkCurrentSymbolNote();
      }
    };
  });

  // Düzenleme butonları
  document.querySelectorAll('.edit-note-btn').forEach(btn => {
    btn.onclick = (e) => {
      const s = e.target.closest('.edit-note-btn').dataset.symbol;
      const noteData = notes[s];
      if (noteData) {
        // Düzenleme moduna geç
        currentSymbol = s;
        document.getElementById('currentSymbol').textContent = s;
        document.getElementById('noteInput').value = noteData.note;
        document.getElementById('noteInput').focus();
        // UI güncelle
        document.getElementById('noteBadge').textContent = '✏️ Düzenleniyor';
        document.getElementById('noteBadge').classList.add('has-note');
        // Notlar tabını aktif yap (gerekirse)
        document.querySelector('[data-tab="notes"]').click();
      }
    };
  });
}

async function saveCurrentNote() {
  const text = document.getElementById('noteInput').value.trim();
  if (!currentSymbol) return;

  const result = await chrome.storage.local.get([STORAGE_KEYS.NOTES]);
  const notes = result[STORAGE_KEYS.NOTES] || {};

  if (text) {
    notes[currentSymbol] = { note: text, updatedAt: Date.now() };
  } else {
    delete notes[currentSymbol];
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: notes });

  loadNotes();
  checkCurrentSymbolNote();

  const btn = document.getElementById('saveNote');
  const originalText = btn.textContent;
  btn.textContent = '✓ Kaydedildi';
  setTimeout(() => btn.textContent = originalText, 1500);
}

async function checkCurrentSymbolNote() {
  if (!currentSymbol) return;

  const result = await chrome.storage.local.get([STORAGE_KEYS.NOTES]);
  const notes = result[STORAGE_KEYS.NOTES] || {};

  const badge = document.getElementById('noteBadge');
  const input = document.getElementById('noteInput');

  if (notes[currentSymbol]) {
    badge.textContent = '✓ Not Var';
    badge.classList.add('has-note');
    input.value = notes[currentSymbol].note;
  } else {
    badge.textContent = '';
    badge.classList.remove('has-note');
    input.value = '';
  }
}

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', async () => {
  // Tablar
  document.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById(t.dataset.tab + '-tab').classList.add('active');
    };
  });

  // Butonlar
  document.getElementById('exportCSV').onclick = exportCSV;
  document.getElementById('clearLogs').onclick = clearLogs;
  document.getElementById('saveNote').onclick = saveCurrentNote;

  // Verileri Yükle
  loadLogs();
  loadNotes();

  // Mevcut hisseyi al
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && tab.url.includes('tradingview.com')) {
    try {
      // Content script'ten iste
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
      if (resp && resp.state && resp.state.currentSymbol) {
        currentSymbol = resp.state.currentSymbol;
        document.getElementById('currentSymbol').textContent = currentSymbol;
        checkCurrentSymbolNote();
      }
    } catch (e) {
      // Fallback title parsing
      const m = tab.title.match(/^([A-Z0-9]+)/);
      if (m && m[1] !== 'TradingView') {
        currentSymbol = m[1];
        document.getElementById('currentSymbol').textContent = currentSymbol;
        checkCurrentSymbolNote();
      }
    }
  }
});