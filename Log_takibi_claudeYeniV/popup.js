// Popup JavaScript - Fixed & Enhanced Version

let currentTab = 'logs';

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  
  // Tab değiştirme
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  document.getElementById('exportBtn').addEventListener('click', exportToCSV);
  document.getElementById('exportReportBtn').addEventListener('click', exportDetailedReport);
  document.getElementById('downloadScreenshotsBtn').addEventListener('click', downloadAllScreenshots);
  document.getElementById('clearBtn').addEventListener('click', clearLogs);
  document.getElementById('forceReportBtn').addEventListener('click', forceCreateReport);
  
  // Debug butonu - geliştirme için
  const debugBtn = document.createElement('button');
  debugBtn.textContent = '🔍 Debug';
  debugBtn.className = 'btn-secondary';
  debugBtn.style.cssText = 'position:fixed;bottom:10px;right:10px;padding:8px 12px;font-size:11px;z-index:9999;';
  debugBtn.onclick = async () => {
    const data = await chrome.storage.local.get(null);
    console.log('📦 Storage içeriği:', data);
    alert(`Logs: ${data.activityLogs?.length || 0}\nReports: ${data.sessionReports?.length || 0}`);
  };
  document.body.appendChild(debugBtn);
});

function switchTab(tabName) {
  currentTab = tabName;
  
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-content`).classList.add('active');
}

async function loadData() {
  try {
    const result = await chrome.storage.local.get(null);
    const logs = result.activityLogs || [];
    const reports = result.sessionReports || [];
    
    // Screenshot sayısını hesapla
    const screenshotKeys = Object.keys(result).filter(key => key.startsWith('screenshots_'));
    let totalScreenshots = 0;
    screenshotKeys.forEach(key => {
      totalScreenshots += (result[key] || []).length;
    });
    
    // İstatistikler
    document.getElementById('totalLogs').textContent = logs.length;
    document.getElementById('totalReports').textContent = reports.length;
    
    const today = new Date().toLocaleDateString('tr-TR');
    const todayLogs = logs.filter(log => log.date === today);
    document.getElementById('todayLogs').textContent = todayLogs.length;
    
    // Screenshot sayısını göster (eğer varsa)
    const screenshotStat = document.getElementById('totalScreenshots');
    if (screenshotStat) {
      screenshotStat.textContent = totalScreenshots;
    }
    
    // Göster
    displayLogs(logs.slice().reverse().slice(0, 100));
    displayReports(reports.slice().reverse());
  } catch (error) {
    console.error('Veri yükleme hatası:', error);
  }
}

function displayLogs(logs) {
  const container = document.getElementById('logsContainer');
  
  if (logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p>Henüz kayıt yok</p>
        <p style="font-size: 11px; margin-top: 5px;">TradingView'da işlem yapmaya başlayın</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = logs.map(log => {
    const symbolBadge = log.symbol && log.symbol !== 'Bilinmiyor' 
      ? `<span style="background:#667eea;color:white;padding:2px 8px;border-radius:4px;font-size:10px;margin-left:8px;font-weight:600;">${log.symbol}</span>` 
      : '';
    
    const detailsText = formatDetails(log.details);
    const priceInfo = log.price && log.price !== '-' 
      ? `<div style="margin-top:4px;color:#10b981;font-weight:600;font-size:11px;">💰 Güncel Fiyat: ${log.price}</div>` 
      : '';
    
    // Eğer detayda seviye varsa öne çıkar
    const hasLevel = log.details && (log.details.seviye || log.details.fiyatSeviyesi);
    const levelInfo = hasLevel 
      ? `<div style="margin-top:4px;background:#fef3c7;color:#92400e;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;">
           🎯 ${log.details.seviye || log.details.fiyatSeviyesi}
         </div>`
      : '';
    
    return `
      <div class="log-entry">
        <div class="timestamp">${log.date} ${log.time}${symbolBadge}</div>
        <div class="action">${log.action}</div>
        <div class="details">${detailsText}</div>
        ${levelInfo}
        ${priceInfo}
      </div>
    `;
  }).join('');
}

function displayReports(reports) {
  const container = document.getElementById('reportsContainer');
  
  console.log('📊 Rapor sayısı:', reports.length);
  
  if (reports.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
        <p>Henüz oturum raporu yok</p>
        <p style="font-size: 11px; margin-top: 5px;">Bir hisse üzerinde çalışın ve birkaç çizim yapın</p>
        <p style="font-size: 10px; margin-top: 8px; color: rgba(255,255,255,0.6);">
          💡 İpucu: Hisse değiştirdiğinizde veya pencereyi kapattığınızda otomatik rapor oluşur
        </p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = reports.map(report => {
    const summary = report.summary || {};
    const detay = report.detay || {};
    
    return `
      <div class="report-entry">
        <div class="timestamp">${summary.başlangıç || 'N/A'}</div>
        <div class="symbol">📊 ${report.symbol}</div>
        
        <div class="report-summary">
          <div>
            <span class="label">⏱️ Çalışma Süresi:</span>
            <span class="value">${report.duration || 'N/A'}</span>
          </div>
          <div>
            <span class="label">✏️ Toplam Çizim:</span>
            <span class="value">${summary.toplamÇizim || 0}</span>
          </div>
          <div>
            <span class="label">📈 İndikatör:</span>
            <span class="value">${summary.toplamİndikatör || 0}</span>
          </div>
          
          ${summary.kullanılanAraçlar && summary.kullanılanAraçlar.length > 0 ? `
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.1);">
            <span class="label">🛠️ Kullandığınız Araçlar:</span>
            <div style="margin-top:5px;color:#10b981;font-size:11px;line-height:1.6;">
              ${summary.kullanılanAraçlar.map(tool => `• ${tool}`).join('<br>')}
            </div>
          </div>
          ` : ''}
          
          ${summary.zamanDilimleri && summary.zamanDilimleri.length > 0 ? `
          <div style="margin-top:8px;">
            <span class="label">⏰ İncelediğiniz Zaman Dilimleri:</span>
            <div style="margin-top:5px;color:#667eea;font-size:11px;">
              ${summary.zamanDilimleri.join(' → ')}
            </div>
          </div>
          ` : ''}
          
          ${detay.çizimler && detay.çizimler.length > 0 ? `
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.1);">
            <span class="label">📝 Çizim Detayları:</span>
            <div style="margin-top:5px;font-size:10px;color:#666;line-height:1.6;">
              ${detay.çizimler.slice(0, 5).map((d, i) => {
                const seviye = d.fiyatDetay || d.fiyatSeviyesi || d.fiyat || 'Seviye tespit edilemedi';
                return `${i+1}. ${d.araç}<br>&nbsp;&nbsp;&nbsp;💰 ${seviye}<br>&nbsp;&nbsp;&nbsp;⏰ ${d.zaman}`;
              }).join('<br>')}
              ${detay.çizimler.length > 5 ? `<br><br>... ve ${detay.çizimler.length - 5} çizim daha` : ''}
            </div>
          </div>
          ` : ''}
        </div>
        
        <div style="margin-top:8px;font-size:10px;color:#999;text-align:right;">
          ${summary.bitiş || ''}
        </div>
      </div>
    `;
  }).join('');
}

function formatDetails(details) {
  if (typeof details === 'string') return details;
  if (typeof details !== 'object') return String(details);
  
  return Object.entries(details)
    .map(([key, value]) => {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
      return `<strong>${key}:</strong> ${displayValue}`;
    })
    .join('<br>');
}

async function exportToCSV() {
  try {
    const result = await chrome.storage.local.get(['activityLogs']);
    const logs = result.activityLogs || [];
    
    if (logs.length === 0) {
      alert('Dışa aktarılacak log bulunamadı!');
      return;
    }
    
    let csv = 'Tarih,Saat,Sembol,Aksiyon,Fiyat,Detaylar\n';
    
    logs.forEach(log => {
      const detailsText = typeof log.details === 'object'
        ? JSON.stringify(log.details).replace(/"/g, '""')
        : String(log.details).replace(/"/g, '""');
      
      csv += `"${log.date}","${log.time}","${log.symbol || ''}","${log.action}","${log.price || ''}","${detailsText}"\n`;
    });
    
    downloadFile(csv, `tradingview_logs_${getDateString()}.csv`, 'text/csv');
    alert('CSV dosyası indirildi!');
  } catch (error) {
    console.error('CSV dışa aktarma hatası:', error);
    alert('Dışa aktarma sırasında hata oluştu!');
  }
}

async function exportDetailedReport() {
  try {
    const result = await chrome.storage.local.get(['sessionReports']);
    const reports = result.sessionReports || [];
    
    if (reports.length === 0) {
      alert('Dışa aktarılacak rapor bulunamadı!');
      return;
    }
    
    let markdown = '# 📊 TradingView Analiz Raporları\n\n';
    markdown += `**Oluşturulma Tarihi:** ${new Date().toLocaleString('tr-TR')}\n\n`;
    markdown += `**Toplam Oturum:** ${reports.length}\n\n`;
    markdown += '---\n\n';
    
    reports.forEach((report, index) => {
      const summary = report.summary || {};
      const detay = report.detay || {};
      
      markdown += `## ${index + 1}. 📈 ${report.symbol} Analizi\n\n`;
      markdown += `### ⏰ Oturum Bilgileri\n\n`;
      markdown += `- **Başlangıç:** ${summary.başlangıç}\n`;
      markdown += `- **Bitiş:** ${summary.bitiş}\n`;
      markdown += `- **Süre:** ${report.duration}\n`;
      markdown += `- **Screenshot Sayısı:** ${summary.toplamScreenshot || 0}\n\n`;
      
      markdown += '### 📊 Genel Özet\n\n';
      markdown += `Bu oturumda ${report.symbol} üzerinde toplam **${summary.toplamÇizim || 0} çizim** ve **${summary.toplamİndikatör || 0} indikatör** kullandım.\n\n`;
      
      if (summary.kullanılanAraçlar && summary.kullanılanAraçlar.length > 0) {
        markdown += '### 🛠️ Kullanılan Çizim Araçları\n\n';
        summary.kullanılanAraçlar.forEach(tool => {
          const count = detay.çizimler?.filter(d => d.araç === tool).length || 0;
          markdown += `- **${tool}** (${count}x)\n`;
        });
        markdown += '\n';
      }
      
      if (detay.çizimler && detay.çizimler.length > 0) {
        markdown += '### ✏️ Detaylı Çizim Listesi\n\n';
        markdown += '| Sıra | Araç | Fiyat | Screenshot | Zaman |\n';
        markdown += '|------|------|-------|------------|-------|\n';
        detay.çizimler.forEach((drawing, i) => {
          const fiyat = drawing.fiyat || '-';
          const screenshot = drawing.screenshotDosyası || 'Yok';
          markdown += `| ${i + 1} | ${drawing.araç} | ${fiyat} | ${screenshot} | ${drawing.zaman} |\n`;
        });
        markdown += '\n';
        markdown += '> 💡 **Not:** Screenshot dosyaları sembol klasörlerinde saklanır. "📸 Screenshot\'ları İndir" butonunu kullanarak tüm görselleri indirebilirsiniz.\n\n';
      }
      
      if (detay.indikatörler && detay.indikatörler.length > 0) {
        markdown += '### 📈 Kullanılan İndikatörler\n\n';
        detay.indikatörler.forEach((ind, i) => {
          markdown += `${i + 1}. **${ind.name}** - ${new Date(ind.time).toLocaleTimeString('tr-TR')}\n`;
        });
        markdown += '\n';
      }
      
      if (summary.zamanDilimleri && summary.zamanDilimleri.length > 0) {
        markdown += '### ⏰ İncelenen Zaman Dilimleri\n\n';
        markdown += summary.zamanDilimleri.map(tf => `- ${tf}`).join('\n');
        markdown += '\n\n';
      }
      
      markdown += '---\n\n';
    });
    
    markdown += '## 📝 Notlar\n\n';
    markdown += 'Bu rapor TradingView Logger Pro tarafından otomatik olarak oluşturulmuştur.\n';
    markdown += '\nCanvas çizimleri için screenshot\'lar alınmış ve her hisse için ayrı klasörlerde saklanmıştır.\n';
    
    downloadFile(markdown, `tradingview_detayli_rapor_${getDateString()}.md`, 'text/markdown');
    alert('Detaylı rapor indirildi!');
  } catch (error) {
    console.error('Rapor dışa aktarma hatası:', error);
    alert('Rapor dışa aktarma sırasında hata oluştu!');
  }
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function clearLogs() {
  if (confirm('Tüm loglar ve raporlar silinecek. Emin misiniz?')) {
    try {
      await chrome.storage.local.set({ 
        activityLogs: [],
        sessionReports: []
      });
      await loadData();
      alert('Tüm veriler temizlendi!');
    } catch (error) {
      console.error('Temizleme hatası:', error);
      alert('Temizleme sırasında hata oluştu!');
    }
  }
}

// Manuel rapor oluşturma
async function forceCreateReport() {
  try {
    // Aktif tab'ı bul
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url.includes('tradingview.com')) {
      alert('Lütfen TradingView sayfasında olduğunuzdan emin olun!');
      return;
    }
    
    // Content script'e mesaj gönder
    chrome.tabs.sendMessage(tab.id, { type: 'FORCE_REPORT' }, (response) => {
      if (chrome.runtime.lastError) {
        alert('Hata: ' + chrome.runtime.lastError.message);
      } else {
        setTimeout(async () => {
          await loadData();
          alert('Rapor oluşturuldu! Oturum Raporları sekmesini kontrol edin.');
        }, 500);
      }
    });
  } catch (error) {
    console.error('Manuel rapor hatası:', error);
    alert('Rapor oluşturulamadı: ' + error.message);
  }
}

// popup.js dosyasının en altına bu fonksiyonu ekle:

async function downloadAllScreenshots() {
  try {
    const result = await chrome.storage.local.get(null);
    // Storage'dan sadece screenshot ile başlayan keyleri al
    const screenshotKeys = Object.keys(result).filter(key => key.startsWith('screenshots_'));
    
    if (screenshotKeys.length === 0) {
      alert('İndirilecek screenshot bulunamadı!');
      return;
    }
    
    // Kullanıcıya bilgi ver
    let totalImages = 0;
    screenshotKeys.forEach(key => totalImages += (result[key] || []).length);
    
    if (!confirm(`${totalImages} adet screenshot bulundu. Hepsini indirmek istiyor musunuz? (Tarayıcınız çoklu indirme izni isteyebilir)`)) {
      return;
    }

    let downloadCount = 0;

    for (const key of screenshotKeys) {
      const screenshots = result[key] || [];
      
      for (const shot of screenshots) {
        if (shot.data) {
          // Resim indirme işlemi (Mevcut downloadFile fonksiyonunu kullanmıyoruz çünkü o text için)
          const link = document.createElement('a');
          link.href = shot.data; // Base64 veri
          link.download = shot.filename || `screenshot_${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          downloadCount++;
          // Tarayıcıyı kilitlememek için minik bir bekleme
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
    
    // İndirme bitince bilgi ver (Eğer sayı çoksa console'a yaz)
    console.log(`${downloadCount} screenshot indirme kuyruğuna alındı.`);
    
  } catch (error) {
    console.error('Screenshot indirme hatası:', error);
    alert('Screenshotlar indirilirken bir hata oluştu: ' + error.message);
  }
}