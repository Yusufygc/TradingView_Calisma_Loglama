// TradingView Activity Logger - Toolbar & UI Canlı Takip (v5.0)
//

let currentSymbol = "";
let lastLogTime = 0;
let drawingMode = false;
let checkInterval = null;

// --- GÜVENLİ LOG GÖNDERME ---
function sendLog(action, details) {
  if (!chrome.runtime?.id) return; // Bağlantı kontrolü

  const now = Date.now();
  if (now - lastLogTime < 500) return; // Spam koruması
  lastLogTime = now;

  const price = extractPrice();
  
  // Eğer sembol boşsa, bulmaya çalış
  if (!currentSymbol) {
      currentSymbol = findActiveSymbol();
  }

  const log = {
    timestamp: now,
    date: new Date().toLocaleDateString('tr-TR'),
    time: new Date().toLocaleTimeString('tr-TR'),
    action: action,
    details: details,
    symbol: currentSymbol || "Bilinmiyor",
    price: price
  };

  try {
    chrome.runtime.sendMessage({ type: 'LOG_ACTIVITY', log: log });
  } catch (e) { /* Sessiz hata */ }
}

// --- EN ÖNEMLİ KISIM: SEMBOLÜ BULMA ---
function findActiveSymbol() {
  // 1. Yöntem: Sol üstteki Arama Butonunun içindeki yazı (En Garanti)
  const toolbarBtn = document.getElementById('header-toolbar-symbol-search');
  if (toolbarBtn && toolbarBtn.innerText.trim().length > 0) {
      return toolbarBtn.innerText.trim();
  }

  // 2. Yöntem: URL Parametresi
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const symbolParam = urlParams.get('symbol');
    if (symbolParam) {
      return symbolParam.includes(':') ? symbolParam.split(':')[1] : symbolParam;
    }
  } catch(e) {}

  // 3. Yöntem: Sayfa Başlığı (Fallback)
  return document.title.split(' ')[0];
}

function extractPrice() {
  const match = document.title.match(/[\d.,]+/);
  return match ? match[0] : "-";
}

// --- DEĞİŞİKLİKLERİ YAKALA (CORE LOGIC) ---
function checkChanges() {
  const detectedSymbol = findActiveSymbol();

  // Sembol geçerli mi ve değişti mi?
  if (detectedSymbol && 
      detectedSymbol !== "TradingView" && 
      detectedSymbol !== "Yükleniyor..." &&
      detectedSymbol !== currentSymbol) {
      
      // Eski sembol varsa değişim logu at
      if (currentSymbol !== "") {
          sendLog('Sembol Değişti', { eski: currentSymbol, yeni: detectedSymbol });
      }
      
      currentSymbol = detectedSymbol;
      
      // Yeni oturumu 1 saniye sonra başlat (Grafik verileri otursun)
      setTimeout(() => {
          sendLog('Oturum Başladı', { mesaj: `${currentSymbol} grafiği yüklendi.` });
      }, 1000);
  }
}

// --- OBSERVER (GÖZLEMCİ) KURULUMU ---
function startObservers() {
  // 1. ZAMANLAYICI: Her 1 saniyede bir kontrol et (En temiz çözüm)
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(checkChanges, 1000);

  // 2. TOOLBAR İZLEYİCİSİ: Sembol kutusundaki metin değişimini anında yakala
  const toolbarBtn = document.getElementById('header-toolbar-symbol-search');
  if (toolbarBtn) {
      const toolbarObserver = new MutationObserver(checkChanges);
      toolbarObserver.observe(toolbarBtn, { childList: true, subtree: true, characterData: true });
  }

  // 3. DOM İZLEYİCİSİ: Çizim ve İndikatörler için
  const domObserver = new MutationObserver((mutations) => {
    if (!chrome.runtime?.id) return;

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;

        // İndikatör Yakalama
        // TradingView'da indikatör isimleri genellikle bu data-id ile gelir
        if (node.querySelector && node.querySelector('[data-qa-id="legend-source-title"]')) {
            const text = node.innerText.split('\n')[0];
            // Ana hisse senedi ismini indikatör sanmasın diye kontrol
            if (text && text !== currentSymbol && !text.includes(currentSymbol)) {
                sendLog('İndikatör', { isim: text });
            }
        }

        // Çizim Paneli Yakalama (Floating Toolbar)
        if (node.classList && (node.classList.contains('tv-floating-toolbar') || node.getAttribute('data-name') === 'floating-toolbar')) {
             sendLog('Çizim', { tur: 'Grafik Düzenleme' });
        }
      });
    });
  });

  domObserver.observe(document.body, { childList: true, subtree: true });

  // 4. MOUSE İMLECİ İLE ÇİZİM TEYİDİ
  document.addEventListener('mousedown', () => {
      const cursor = window.getComputedStyle(document.body).cursor;
      if (cursor === 'crosshair') drawingMode = true;
  });

  document.addEventListener('mouseup', () => {
      if (drawingMode) {
          setTimeout(() => {
              const cursor = window.getComputedStyle(document.body).cursor;
              if (cursor !== 'crosshair') { // İmleç normale döndüyse çizim bitmiştir
                  sendLog('Çizim', { tur: 'Teknik Çizim' });
                  drawingMode = false;
              }
          }, 200);
      }
  });
}

// --- BAŞLATMA ---
setTimeout(() => {
  currentSymbol = findActiveSymbol();
  if (currentSymbol && currentSymbol !== "TradingView") {
      sendLog('Oturum Başladı', { mesaj: `${currentSymbol} ile başlandı.` });
  }
  startObservers();
}, 2500); // TradingView ağır yüklendiği için biraz daha bekle
// TradingView Activity Logger - Geliştirilmiş Content Script (Robust Version)
//
/*
let currentSymbol = '';
let observer = null;
let symbolCheckInterval = null;

// Log gönderme fonksiyonu (Hata Korumalı)
function sendLog(action, details) {
  if (!chrome.runtime?.id) {
    // Uzantı güncellendiyse sessizce dur
    disconnectAll();
    return;
  }

  const price = extractPriceInfo();
  const log = {
    timestamp: Date.now(),
    date: new Date().toLocaleDateString('tr-TR'),
    time: new Date().toLocaleTimeString('tr-TR'),
    action: action,
    details: details,
    symbol: currentSymbol || getSymbolFromPage() || 'Bilinmiyor',
    price: price
  };

  try {
    chrome.runtime.sendMessage({ type: 'LOG_ACTIVITY', log: log }, () => {
      if (chrome.runtime.lastError) 
    });
  } catch (e) 
}

// Sayfadan Sembolü Çekme (Daha agresif yöntem)
function getSymbolFromPage() {
  // 1. Yöntem: Title'dan
  const titleMatch = document.title.match(/^([A-Z0-9]+)/);
  if (titleMatch) return titleMatch[1];
  
  // 2. Yöntem: URL'den
  const urlMatch = window.location.href.match(/symbol=([A-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];

  // 3. Yöntem: Chart Info
  const symbolElement = document.querySelector('[data-name="legend-series-item"]');
  if (symbolElement) return symbolElement.innerText.split(' ')[0];

  return null;
}

// Fiyat Alma
function extractPriceInfo() {
  const title = document.title;
  const priceMatch = title.match(/[\d.,]+/);
  if (priceMatch) return priceMatch[0];
  
  // Yedekler
  const metaPrice = document.querySelector('title').innerText;
  if(metaPrice.match(/[\d.,]+/)) return metaPrice.match(/[\d.,]+/)[0];

  return "Fiyat Alınamadı";
}

// Sembol Değişikliğini Kontrol Et
function checkSymbolChange() {
  const newSymbol = getSymbolFromPage();
  
  // Eğer sembol bulunduysa ve eskisinden farklıysa
  if (newSymbol && newSymbol !== currentSymbol && newSymbol !== 'TradingView') {
    // Eğer önceki sembol varsa (yani ilk açılış değilse) değişim logu at
    if (currentSymbol) {
        sendLog('Sembol Değişti', { eski: currentSymbol, yeni: newSymbol });
    } else {
        // İlk açılış
        sendLog('Oturum Başladı', { mesaj: `${newSymbol} grafiği açıldı.` });
    }
    
    currentSymbol = newSymbol;
    console.log(`Sembol güncellendi: ${currentSymbol}`);
  }
}

// Ana Gözlemci (Çizimler ve İndikatörler için)
function startObserver() {
  const targetNode = document.body;
  if (!targetNode) return;

  observer = new MutationObserver((mutations) => {
    if (!chrome.runtime?.id) { disconnectAll(); return; }

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element ise
          const classStr = node.className && typeof node.className === 'string' ? node.className : '';
          
          // Çizim Tespiti
          if (node.tagName === 'line' || node.tagName === 'path' || classStr.includes('drawing')) {
            const parent = node.closest('[class*="drawing"]');
            if (parent) {
               // Spam engellemek için basit bir debounce mantığı
               // (Aynı saniye içinde 50 tane log atmaması için)
               if (!window.lastDrawingTime || Date.now() - window.lastDrawingTime > 1000) {
                 sendLog('Çizim', { tur: 'Teknik Analiz' });
                 window.lastDrawingTime = Date.now();
               }
            }
          }
          
          // İndikatör Tespiti
          if (classStr.includes('study') || classStr.includes('pane-legend-line')) {
             const text = node.textContent.trim();
             if(text.length > 2 && text.length < 50) {
               sendLog('İndikatör', { isim: text });
             }
          }
        }
      });
    });
  });

  observer.observe(targetNode, { childList: true, subtree: true });
}

function disconnectAll() {
  if (observer) observer.disconnect();
  if (symbolCheckInterval) clearInterval(symbolCheckInterval);
}

// --- BAŞLATMA MANTIĞI ---

// 1. Hemen çalıştır
setTimeout(() => {
    currentSymbol = getSymbolFromPage();
    if(currentSymbol) {
        sendLog('Oturum Başladı', { mesaj: `${currentSymbol} yüklendi.` });
    }
    startObserver();
}, 2000);

// 2. Periyodik Kontrol (Polling) - İşte sorunu çözen kısım burası
// Her 2 saniyede bir "Hisse değişti mi?" diye bakar.
symbolCheckInterval = setInterval(checkSymbolChange, 2000);

// 3. Title Observer (Destek kuvvet)
const titleObserver = new MutationObserver(checkSymbolChange);
titleObserver.observe(document.querySelector('title'), { childList: true });

/**/