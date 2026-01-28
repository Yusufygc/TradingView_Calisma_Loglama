// TradingView Simple Logger - Popup Script
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadLogs();
  setupEventListeners();
});

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

  // En son loglar üstte
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
    .filter(([key]) => key !== 'fiyat') // Fiyat ayrı gösteriliyor
    .map(([key, value]) => `<span class="detail-item"><strong>${key}:</strong> ${value}</span>`)
    .join(' ');
}

function setupEventListeners() {
  document.getElementById('exportCSV').addEventListener('click', exportToCSV);
  document.getElementById('clearLogs').addEventListener('click', clearLogs);
}

async function exportToCSV() {
  try {
    const result = await chrome.storage.local.get(['activityLogs']);
    const logs = result.activityLogs || [];

    if (logs.length === 0) {
      alert('Dışa aktarılacak log yok.');
      return;
    }

    // Daha okunabilir CSV formatı
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

    // CSV oluştur - Excel uyumlu
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => {
        // Hücreyi temizle ve tırnak içine al
        const cleaned = String(cell).replace(/"/g, '""');
        return `"${cleaned}"`;
      }).join(';')) // Noktalı virgül kullan (Excel TR uyumu)
      .join('\r\n');

    // BOM ekle (Excel'de Türkçe karakter desteği)
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