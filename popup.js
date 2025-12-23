// Popup JavaScript - Final Sürüm
//

let currentTab = 'logs';

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  
  // SEKME GEÇİŞ MANTIĞI (Eksik olan kısım buydu)
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // Buton Dinleyicileri
  document.getElementById('exportBtn').addEventListener('click', exportToCSV);
  document.getElementById('exportReportBtn').addEventListener('click', downloadStoryReport);
  document.getElementById('clearBtn').addEventListener('click', clearLogs);
});

// Sekme Değiştirme Fonksiyonu
function switchTab(tabName) {
  currentTab = tabName;
  
  // Aktif sınıflarını yönet
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-content`).classList.add('active');

  // Eğer Raporlar sekmesine geçildiyse, raporu ekrana çiz
  if (tabName === 'reports') {
    renderStoryPreview();
  }
}

async function loadData() {
  const result = await chrome.storage.local.get(['activityLogs']);
  const logs = result.activityLogs || [];
  
  document.getElementById('totalLogs').textContent = logs.length;
  
  const today = new Date().toLocaleDateString('tr-TR');
  const todayLogs = logs.filter(log => log.date === today);
  document.getElementById('todayLogs').textContent = todayLogs.length;

  displayLogs(logs.slice().reverse().slice(0, 50));
}

function displayLogs(logs) {
  const container = document.getElementById('logsContainer');
  if (logs.length === 0) {
     container.innerHTML = `
      <div class="empty-state">
        <p>Henüz kayıt yok</p>
        <p style="font-size: 11px; margin-top: 5px;">İşlem yapmaya başlayın...</p>
      </div>`;
     return;
  }
  
  container.innerHTML = logs.map(log => `
    <div class="log-entry">
      <div class="timestamp">${log.time} - ${log.symbol}</div>
      <div class="action">${log.action}</div>
      <div class="details">Fiyat: ${log.price || '-'} ${log.details?.mesaj ? '| ' + log.details.mesaj : ''}</div>
    </div>
  `).join('');
}

// --- HİKAYE MODU: EKRANA YAZDIRMA (PREVIEW) ---
async function renderStoryPreview() {
  const container = document.getElementById('reportsContainer');
  const result = await chrome.storage.local.get(['activityLogs']);
  const logs = result.activityLogs || [];

  if (logs.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Rapor oluşturulacak veri yok.</p></div>';
    return;
  }

  // Logları sembollere göre grupla
  const sessions = {};
  logs.forEach(log => {
    if (!sessions[log.symbol]) sessions[log.symbol] = [];
    sessions[log.symbol].push(log);
  });

  let htmlContent = '';

  for (const [symbol, symbolLogs] of Object.entries(sessions)) {
    if (symbol === 'Bilinmiyor') continue;

    const firstLog = symbolLogs[0];
    const lastLog = symbolLogs[symbolLogs.length - 1];
    const drawings = symbolLogs.filter(l => l.action === 'Çizim').length;
    const indicators = symbolLogs.filter(l => l.action === 'İndikatör').length;
    const priceStart = symbolLogs.find(l => l.price !== 'Fiyat Alınamadı')?.price || 'Belirsiz';
    
    // HTML Kartı Oluştur
    htmlContent += `
      <div class="report-entry">
        <div class="symbol" style="font-size:16px; color:#333;">📊 ${symbol} Analizi</div>
        <div class="report-summary">
          <div><span class="label">Başlangıç:</span> <span class="value">${firstLog.time}</span></div>
          <div><span class="label">Süre:</span> <span class="value">${calculateDuration(firstLog.timestamp, lastLog.timestamp)}</span></div>
          <div><span class="label">İlk Fiyat:</span> <span class="value">${priceStart}</span></div>
        </div>
        <div style="margin-top:10px; font-size:12px; color:#555; line-height:1.5;">
          <p>Bugün ${symbol} üzerinde <strong>${drawings} çizim</strong> ve <strong>${indicators} indikatör</strong> çalışması yaptım.</p>
        </div>
      </div>
    `;
  }

  container.innerHTML = htmlContent;
}

// --- HİKAYE MODU: İNDİRME (MARKDOWN) ---
async function downloadStoryReport() {
  const result = await chrome.storage.local.get(['activityLogs']);
  const logs = result.activityLogs || [];
  
  if (logs.length === 0) {
    alert("Veri yok!");
    return;
  }

  const sessions = {};
  logs.forEach(log => {
    if (!sessions[log.symbol]) sessions[log.symbol] = [];
    sessions[log.symbol].push(log);
  });

  let storyText = `# 📔 Yatırımcı Günlüğü - ${new Date().toLocaleDateString('tr-TR')}\n\n`;

  for (const [symbol, symbolLogs] of Object.entries(sessions)) {
    if (symbol === 'Bilinmiyor') continue;
    
    const firstLog = symbolLogs[0];
    const lastLog = symbolLogs[symbolLogs.length - 1];
    const drawings = symbolLogs.filter(l => l.action === 'Çizim').length;
    const uniqueInd = [...new Set(symbolLogs.filter(l => l.action === 'İndikatör').map(l => l.details.isim))];
    const priceStart = symbolLogs.find(l => l.price !== 'Fiyat Alınamadı')?.price || 'Belirsiz';
    
    storyText += `## 📊 ${symbol} Analiz Notlarım\n`;
    storyText += `**Saat:** ${firstLog.time} sularında ekranın başına geçtim.\n\n`;
    storyText += `Bugün ${symbol} grafiğini incelemeye başladığımda fiyatlar **${priceStart}** seviyesindeydi. `;
    storyText += `\n\n**Teknik Bakış:**\n`;
    
    if (drawings > 0) storyText += `- Grafik üzerinde ${drawings} farklı teknik çizim yaparak seviyeleri belirledim.\n`;
    else storyText += `- Grafiğe genel bir bakış attım, çizim yapmadan izledim.\n`;
    
    if (uniqueInd.length > 0) storyText += `- ${uniqueInd.join(', ')} indikatörlerini kontrol ettim.\n`;
    
    storyText += `\n_Genel Not: ${symbol} için bu seans ${calculateDuration(firstLog.timestamp, lastLog.timestamp)} sürdü._\n`;
    storyText += `\n---\n\n`;
  }

  downloadFile(storyText, `Yatirimci_Gunlugu_${getDateString()}.md`, 'text/markdown');
}

// Yardımcı Fonksiyonlar
function calculateDuration(start, end) {
  if (!start || !end) return "kısa süre";
  const diff = Math.abs(end - start);
  const minutes = Math.floor(diff / 60000);
  return minutes < 1 ? "1 dakikadan az" : `${minutes} dakika`;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

function getDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function exportToCSV() {
    const result = await chrome.storage.local.get(['activityLogs']);
    const logs = result.activityLogs || [];
    let csv = 'Tarih,Saat,Sembol,Islem,Fiyat\n';
    logs.forEach(log => {
        csv += `"${log.date}","${log.time}","${log.symbol}","${log.action}","${log.price}"\n`;
    });
    downloadFile(csv, `data_export.csv`, 'text/csv');
}

async function clearLogs() {
    if(confirm("Tüm kayıtlar silinecek. Emin misiniz?")) {
        await chrome.storage.local.clear();
        location.reload();
    }
}