// TradingView Simple Logger - Popup Script
// =========================================

let currentSymbol = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadLogs();
  await loadCurrentSymbol();
  await loadNotes();
  setupEventListeners();
  setupTabs();
});

// ==================== TABS ====================

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      // Add active to clicked
      tab.classList.add('active');
      const tabId = tab.dataset.tab + '-tab';
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// ==================== LOGS ====================

async function loadLogs() {
  try {
    const result = await chrome.storage.local.get(['activityLogs']);
    const logs = result.activityLogs || [];

    updateStats(logs);
    displayLogs(logs);
  } catch (error) {
    console.error('Log yükleme hatası:', error);
  }
}

function updateStats(logs) {
  const today = new Date().toLocaleDateString('tr-TR');
  const todayLogs = logs.filter(log => log.date === today);

  document.getElementById('totalLogs').textContent = logs.length;
  document.getElementById('todayLogs').textContent = todayLogs.length;
}

function displayLogs(logs) {
  const container = document.getElementById('logsContainer');

  if (logs.length === 0) {
    container.innerHTML = '<p class="empty-state">Henüz log yok. TradingView\'de bir hisse açın.</p>';
    return;
  }

  const sortedLogs = [...logs].reverse();

  container.innerHTML = sortedLogs.map(log => `
    <div class="log-item ${getLogClass(log.action)}">
      <div class="log-header">
        <span class="log-date">${log.date} ${log.time}</span>
        <span class="log-symbol">${log.symbol}</span>
      </div>
      <div class="log-action">${log.action}</div>
      <div class="log-details">
        ${formatDetails(log.details)}
        ${log.price && log.price !== '-' ? `<div class="log-price">💰 Fiyat: ${log.price}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function getLogClass(action) {
  if (action.includes('Başladı')) return 'log-start';
  if (action.includes('Değişti')) return 'log-change';
  if (action.includes('Kapandı')) return 'log-end';
  return '';
}

function formatDetails(details) {
  if (!details) return '';

  return Object.entries(details)
    .filter(([key]) => key !== 'fiyat')
    .map(([key, value]) => `<span class="detail-item"><strong>${key}:</strong> ${value}</span>`)
    .join(' ');
}

// ==================== NOTES ====================

async function loadCurrentSymbol() {
  try {
    // Aktif TradingView sekmesinden sembol al
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url && tab.url.includes('tradingview.com')) {
      // Title'dan sembol çıkar
      const titleMatch = tab.title.match(/^([A-Z0-9]+)/);
      if (titleMatch && titleMatch[1] !== 'TradingView') {
        currentSymbol = titleMatch[1];
      }
    }

    document.getElementById('currentSymbol').textContent = currentSymbol || '--';

    // Mevcut not varsa yükle
    if (currentSymbol) {
      const result = await chrome.storage.local.get(['stockNotes']);
      const notes = result.stockNotes || {};

      if (notes[currentSymbol]) {
        document.getElementById('noteInput').value = notes[currentSymbol].note;
        document.getElementById('noteBadge').textContent = '✓ Not var';
        document.getElementById('noteBadge').classList.add('has-note');
      } else {
        document.getElementById('noteBadge').textContent = '';
        document.getElementById('noteBadge').classList.remove('has-note');
      }
    }
  } catch (error) {
    console.error('Sembol yükleme hatası:', error);
  }
}

async function loadNotes() {
  try {
    const result = await chrome.storage.local.get(['stockNotes']);
    const notes = result.stockNotes || {};

    displayAllNotes(notes);
  } catch (error) {
    console.error('Not yükleme hatası:', error);
  }
}

function displayAllNotes(notes) {
  const container = document.getElementById('allNotesContainer');
  const entries = Object.entries(notes);

  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-state">Henüz not yok.</p>';
    return;
  }

  // Son güncellemeye göre sırala
  entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));

  container.innerHTML = entries.map(([symbol, data]) => {
    const date = data.updatedAt
      ? new Date(data.updatedAt).toLocaleDateString('tr-TR')
      : '';

    return `
      <div class="note-card">
        <div class="note-card-header">
          <span class="note-card-symbol">${symbol}</span>
          <span class="note-card-date">${date}</span>
        </div>
        <div class="note-card-text">${escapeHtml(data.note)}</div>
        <div class="note-card-actions">
          <button class="btn-icon" onclick="editNote('${symbol}')">✏️</button>
          <button class="btn-icon btn-icon-danger" onclick="deleteNote('${symbol}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function saveNote() {
  const noteText = document.getElementById('noteInput').value.trim();
  const symbol = currentSymbol;

  if (!symbol || symbol === '--') {
    alert('TradingView\'de bir hisse açın.');
    return;
  }

  try {
    const result = await chrome.storage.local.get(['stockNotes']);
    const notes = result.stockNotes || {};

    if (noteText) {
      notes[symbol] = {
        note: noteText,
        updatedAt: Date.now()
      };
      document.getElementById('noteBadge').textContent = '✓ Kaydedildi';
      document.getElementById('noteBadge').classList.add('has-note');
    } else {
      delete notes[symbol];
      document.getElementById('noteBadge').textContent = '';
      document.getElementById('noteBadge').classList.remove('has-note');
    }

    await chrome.storage.local.set({ stockNotes: notes });
    await loadNotes();

    // Kısa bildirim
    setTimeout(() => {
      if (notes[symbol]) {
        document.getElementById('noteBadge').textContent = '✓ Not var';
      }
    }, 2000);

  } catch (error) {
    console.error('Not kaydetme hatası:', error);
    alert('Not kaydedilemedi.');
  }
}

window.editNote = async function (symbol) {
  try {
    const result = await chrome.storage.local.get(['stockNotes']);
    const notes = result.stockNotes || {};

    if (notes[symbol]) {
      document.getElementById('noteInput').value = notes[symbol].note;
      document.getElementById('currentSymbol').textContent = symbol;
      currentSymbol = symbol;
      document.getElementById('noteBadge').textContent = '✓ Not var';
      document.getElementById('noteBadge').classList.add('has-note');

      // Notes tab'ına geç
      document.querySelector('[data-tab="notes"]').click();
      document.getElementById('noteInput').focus();
    }
  } catch (error) {
    console.error('Not düzenleme hatası:', error);
  }
};

window.deleteNote = async function (symbol) {
  if (!confirm(`"${symbol}" için notu silmek istiyor musunuz?`)) return;

  try {
    const result = await chrome.storage.local.get(['stockNotes']);
    const notes = result.stockNotes || {};

    delete notes[symbol];
    await chrome.storage.local.set({ stockNotes: notes });

    // UI güncelle
    if (currentSymbol === symbol) {
      document.getElementById('noteInput').value = '';
      document.getElementById('noteBadge').textContent = '';
      document.getElementById('noteBadge').classList.remove('has-note');
    }

    await loadNotes();
  } catch (error) {
    console.error('Not silme hatası:', error);
  }
};

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
  document.getElementById('exportCSV').addEventListener('click', exportToCSV);
  document.getElementById('clearLogs').addEventListener('click', clearLogs);
  document.getElementById('saveNote').addEventListener('click', saveNote);
}

async function exportToCSV() {
  try {
    const result = await chrome.storage.local.get(['activityLogs']);
    const logs = result.activityLogs || [];

    if (logs.length === 0) {
      alert('Dışa aktarılacak log yok.');
      return;
    }

    const headers = ['Tarih', 'Saat', 'Sembol', 'Aksiyon', 'Fiyat', 'Eski Sembol', 'Yeni Sembol'];
    const rows = logs.map(log => {
      const details = log.details || {};
      return [
        log.date || '',
        log.time || '',
        log.symbol || '',
        log.action || '',
        log.price || details.fiyat || '-',
        details.eski || '',
        details.yeni || details.sembol || ''
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => {
        const cleaned = String(cell).replace(/"/g, '""');
        return `"${cleaned}"`;
      }).join(';'))
      .join('\r\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const filename = `hisse_takip_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('CSV export hatası:', error);
    alert('Dışa aktarma başarısız.');
  }
}

async function clearLogs() {
  if (!confirm('Tüm loglar silinecek. Emin misiniz?')) return;

  try {
    await chrome.storage.local.remove(['activityLogs']);
    await loadLogs();
  } catch (error) {
    console.error('Silme hatası:', error);
  }
}