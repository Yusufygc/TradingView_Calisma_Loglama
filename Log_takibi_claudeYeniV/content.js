// TradingView Enhanced Logger - Screenshot Edition
// =================================================

let currentSymbol = '';
let sessionData = {
  symbol: '',
  startTime: Date.now(),
  drawings: [],
  indicators: [],
  timeframes: [],
  screenshots: []
};

let lastDrawingLog = 0;

// ==================== EKRAN GÖRÜNTÜSÜ ALMA ====================

async function captureChartScreenshot() {
  try {
    // Chart container'ı bul
    const chartContainer = document.querySelector('[data-name="chart-container"]') || 
                          document.querySelector('.chart-container') ||
                          document.querySelector('[class*="chart"]');
    
    if (!chartContainer) {
      console.log('Chart container bulunamadı');
      return null;
    }
    
    // Canvas elementini bul
    const canvas = chartContainer.querySelector('canvas');
    if (!canvas) {
      console.log('Canvas bulunamadı');
      return null;
    }
    
    // Canvas'ı blob'a çevir
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result); // Base64 string
          };
          reader.readAsDataURL(blob);
        } else {
          resolve(null);
        }
      }, 'image/png');
    });
    
  } catch (error) {
    console.error('Screenshot hatası:', error);
    return null;
  }
}

// Alternatif: HTML2Canvas kullanarak (daha güvenilir)
async function captureChartArea() {
  try {
    const chartArea = document.querySelector('[data-name="chart-container"]') || 
                     document.querySelector('.chart-page');
    
    if (!chartArea) return null;
    
    // Basit DOM screenshot (canvas içeriği dahil olmayabilir)
    const rect = chartArea.getBoundingClientRect();
    
    // Chrome Extension API ile tab screenshot
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT',
        rect: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        }
      }, (response) => {
        resolve(response?.screenshot || null);
      });
    });
    
  } catch (error) {
    console.error('Capture hatası:', error);
    return null;
  }
}

// ==================== LOG GÖNDERME ====================

function sendLog(action, details) {
  if (!chrome.runtime?.id) return;
  
  const log = {
    timestamp: Date.now(),
    date: new Date().toLocaleDateString('tr-TR'),
    time: new Date().toLocaleTimeString('tr-TR'),
    action: action,
    details: details,
    symbol: currentSymbol || 'Bilinmiyor',
    price: extractCurrentPrice()
  };
  
  try {
    chrome.runtime.sendMessage({ type: 'LOG_ACTIVITY', log: log });
    console.log('📊', action, '→', details);
  } catch (e) {
    console.error('Log hatası:', e);
  }
}

async function sendDrawingWithScreenshot(tool, details) {
  const screenshot = await captureChartScreenshot();
  
  const timestamp = Date.now();
  const filename = `${currentSymbol}_${new Date(timestamp).toISOString().replace(/[:.]/g, '-')}.png`;
  
  const drawingData = {
    araç: tool,
    fiyat: extractCurrentPrice(),
    zaman: new Date().toLocaleTimeString('tr-TR'),
    timestamp: timestamp,
    screenshot: screenshot,
    screenshotFilename: filename,
    detay: details
  };
  
  sessionData.drawings.push(drawingData);
  sessionData.screenshots.push({
    filename: filename,
    data: screenshot,
    timestamp: timestamp
  });
  
  // Log gönder
  sendLog('Çizim Yapıldı (Screenshot)', {
    araç: tool,
    fiyat: extractCurrentPrice(),
    screenshotDosyası: filename,
    ...details
  });
  
  // Screenshot'ı storage'a gönder
  if (screenshot) {
    chrome.runtime.sendMessage({
      type: 'SAVE_SCREENSHOT',
      symbol: currentSymbol,
      filename: filename,
      data: screenshot,
      drawingInfo: drawingData
    });
  }
  
  console.log('📸 Screenshot alındı:', filename);
}

function sendSessionReport() {
  if (!chrome.runtime?.id) {
    console.log('Extension context invalidated, rapor gönderilemedi.');
    return;
  }
  if (!currentSymbol || currentSymbol === 'Bilinmiyor') return;
  if (sessionData.drawings.length === 0 && sessionData.indicators.length === 0) return;
  
  const duration = Math.floor((Date.now() - sessionData.startTime) / 60000);
  
  const report = {
    type: 'SESSION_REPORT',
    symbol: currentSymbol,
    duration: `${duration} dakika`,
    summary: {
      toplamÇizim: sessionData.drawings.length,
      toplamİndikatör: sessionData.indicators.length,
      toplamScreenshot: sessionData.screenshots.length,
      kullanılanAraçlar: [...new Set(sessionData.drawings.map(d => d.araç))],
      zamanDilimleri: [...new Set(sessionData.timeframes.map(t => t.timeframe))],
      başlangıç: new Date(sessionData.startTime).toLocaleString('tr-TR'),
      bitiş: new Date().toLocaleString('tr-TR')
    },
    detay: {
      çizimler: sessionData.drawings.map(d => ({
        araç: d.araç,
        fiyat: d.fiyat,
        zaman: d.zaman,
        screenshotDosyası: d.screenshotFilename,
        detay: d.detay
      })),
      indikatörler: sessionData.indicators,
      zamanDilimleri: sessionData.timeframes
    }
  };
  if (!chrome.runtime?.id) {
      // Eğer extension yenilendiyse veya bağlantı koptuysa sessizce çık
      return;
    }
  try {
    chrome.runtime.sendMessage({ type: 'SESSION_REPORT', report: report });
    console.log('✅ RAPOR:', currentSymbol, 'Çizim:', sessionData.drawings.length, 'Screenshot:', sessionData.screenshots.length);
  } catch (e) {
    console.error('Rapor hatası:', e);
  }
}

// ==================== SEMBOL TESPİTİ ====================

function detectSymbol() {
  const headerBtn = document.getElementById('header-toolbar-symbol-search');
  if (headerBtn) {
    const text = headerBtn.textContent.trim();
    if (text && text.length > 0 && text !== 'Symbol Search') return text;
  }
  
  const legendItems = document.querySelectorAll('[data-name="legend-source-item"]');
  if (legendItems.length > 0) {
    const titleElem = legendItems[0].querySelector('[data-name="legend-series-item"]');
    if (titleElem) {
      const text = titleElem.textContent.split(',')[0].trim();
      if (text && text.length > 0) return text;
    }
  }
  
  const titleMatch = document.title.match(/^([A-Z0-9:]+)/);
  if (titleMatch && titleMatch[1] !== 'TradingView') return titleMatch[1];
  
  const urlMatch = window.location.href.match(/symbol=([A-Z0-9:%]+)/);
  if (urlMatch) return decodeURIComponent(urlMatch[1]);
  
  return null;
}

function extractCurrentPrice() {
  const titleMatch = document.title.match(/[\d,]+\.?\d+/);
  if (titleMatch) return titleMatch[0];
  
  const priceElems = document.querySelectorAll('[class*="valueValue"]');
  for (let elem of priceElems) {
    const match = elem.textContent.match(/[\d,]+\.?\d+/);
    if (match) return match[0];
  }
  
  return '-';
}

function checkSymbolChange() {
  const newSymbol = detectSymbol();
  if (!newSymbol || newSymbol === 'TradingView' || newSymbol === currentSymbol) return;
  
  if (currentSymbol && currentSymbol !== 'Bilinmiyor') {
    console.log('🔄 Sembol:', currentSymbol, '→', newSymbol);
    sendSessionReport();
    sendLog('Sembol Değişti', { eski: currentSymbol, yeni: newSymbol });
  } else {
    sendLog('Oturum Başladı', { sembol: newSymbol });
  }
  
  currentSymbol = newSymbol;
  sessionData = {
    symbol: currentSymbol,
    startTime: Date.now(),
    drawings: [],
    indicators: [],
    timeframes: [],
    screenshots: []
  };
  
  console.log('✅ Yeni sembol:', currentSymbol);
}

// ==================== ÇİZİM ARAÇLARI ====================

function detectDrawingTool(element) {
  const classStr = String(element.className || '');
  const dataName = element.getAttribute('data-name') || '';
  const fullText = classStr + ' ' + dataName;
  
  const tools = {
    'HorzLine': '📏 Yatay Çizgi',
    'TrendLine': '📈 Trend Çizgisi',
    'VertLine': '📊 Dikey Çizgi',
    'Ray': '☀️ Işın',
    'ExtendedLine': '↔️ Uzatılmış Çizgi',
    'Arrow': '➡️ Ok',
    'FibRetracement': '📐 Fibonacci Retracement',
    'FibExtension': '📐 Fibonacci Extension',
    'Rectangle': '◻️ Dikdörtgen',
    'Ellipse': '⭕ Elips',
    'ParallelChannel': '📊 Paralel Kanal',
    'Text': '📝 Metin',
    'Note': '📌 Not'
  };
  
  for (const [key, name] of Object.entries(tools)) {
    if (fullText.includes(key)) return name;
  }
  
  if (fullText.includes('horizontal')) return '📏 Yatay Çizgi';
  if (fullText.includes('trend')) return '📈 Trend Çizgisi';
  if (fullText.includes('fib')) return '📐 Fibonacci';
  
  return '✏️ Çizim';
}

// ==================== ANA GÖZLEMCĠ ====================

const mainObserver = new MutationObserver((mutations) => {
  if (!chrome.runtime?.id) return;
  
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType !== 1) return;
      
      const element = node;
      const classStr = String(element.className || '');
      const dataName = element.getAttribute('data-name') || '';
      
      // ========== ÇİZİM TESPİTİ + SCREENSHOT ==========
      
      if (classStr.includes('floating-toolbar') || dataName === 'floating-toolbar') {
        const now = Date.now();
        if (now - lastDrawingLog < 1000) return;
        
        setTimeout(async () => {
          const parent = element.closest('[class*="pane"]') || element.parentElement;
          const tool = detectDrawingTool(parent || element);
          
          // Screenshot al ve kaydet
          await sendDrawingWithScreenshot(tool, {
            tip: 'Canvas çizimi - Screenshot ile kaydedildi'
          });
          
          lastDrawingLog = now;
          console.log('✏️', tool, '+ 📸 Screenshot');
        }, 300);
      }
      
      // ========== İNDİKATÖR TESPİTİ ==========
      
      if (classStr.includes('study-legend') || classStr.includes('pane-legend')) {
        setTimeout(() => {
          const titleElem = element.querySelector('[data-qa-id="legend-source-title"]');
          if (titleElem) {
            const name = titleElem.textContent.trim();
            
            if (name && 
                name.length > 2 && 
                name.length < 100 &&
                !name.includes(currentSymbol) &&
                !sessionData.indicators.find(i => i.name === name)) {
              
              sessionData.indicators.push({
                name: name,
                time: new Date().toISOString()
              });
              
              sendLog('İndikatör Eklendi', { indikatör: name });
              console.log('📈 İndikatör:', name);
            }
          }
        }, 100);
      }
      
      // ========== ZAMAN DİLİMİ ==========
      
      if (element.getAttribute('data-value') && 
          element.closest('[class*="interval"]')) {
        const interval = element.getAttribute('data-value');
        
        if (!sessionData.timeframes.find(t => t.timeframe === interval)) {
          sessionData.timeframes.push({
            timeframe: interval,
            time: new Date().toISOString()
          });
          
          sendLog('Zaman Dilimi', { periyot: interval });
        }
      }
    });
    
    mutation.removedNodes.forEach((node) => {
      if (node.nodeType === 1) {
        const classStr = String(node.className || '');
        if (classStr.includes('drawing') || classStr.includes('line-tool')) {
          sendLog('Çizim Silindi', { durum: 'Bir çizim kaldırıldı' });
        }
      }
    });
  });
});

// ==================== BAŞLATMA ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FORCE_REPORT') {
    console.log('⚡ Manuel rapor');
    sendSessionReport();
    sendResponse({ success: true });
  }
});

function initialize() {
  console.log('🚀 TradingView Logger (Screenshot Edition) başlatılıyor...');
  
  setTimeout(() => {
    currentSymbol = detectSymbol();
    if (currentSymbol) {
      sessionData.symbol = currentSymbol;
      sendLog('Logger Başlatıldı', { sembol: currentSymbol });
      console.log('✅ İlk sembol:', currentSymbol);
    }
  }, 3000);
  
  setInterval(checkSymbolChange, 3000);
  
  mainObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-name', 'data-value']
  });
  
  const titleObserver = new MutationObserver(checkSymbolChange);
  const titleElem = document.querySelector('title');
  if (titleElem) {
    titleObserver.observe(titleElem, { childList: true });
  }
  
  console.log('✅ Logger aktif! (Screenshot özelliği etkin)');
}

window.addEventListener('beforeunload', () => {
  if (currentSymbol && sessionData.drawings.length > 0) {
    sendSessionReport();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && currentSymbol && sessionData.drawings.length > 0) {
    sendSessionReport();
  }
});

setTimeout(initialize, 4000);