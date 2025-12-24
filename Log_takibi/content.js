// TradingView Activity Logger - Tam Odaklanma Modu (v7.0)
//

let currentSymbol = "";
let lastLogTime = 0;
let drawingMode = false;
let checkInterval = null;

// --- KESİN ODAK KONTROLÜ ---
// Sayfa gerçekten kullanıcının odağında mı? (Tıklanmış ve aktif mi?)
function isUserActive() {
    return document.hasFocus(); 
}

// --- GÜVENLİ LOG GÖNDERME ---
function sendLog(action, details) {
  // 1. KURAL: Uzantı canlı mı?
  if (!chrome.runtime?.id) return;
  
  // 2. KURAL (EN ÖNEMLİSİ): Kullanıcı bu sayfaya odaklanmış mı?
  // Eğer kullanıcı başka sekmedeyse veya tarayıcı simge durumundaysa ASLA log atma.
  if (!isUserActive()) {
      // İstisna: Eğer çizim yapılıyorsa (mouse basılıysa) loga izin ver
      if (!drawingMode) return;
  }

  const now = Date.now();
  if (now - lastLogTime < 1000) return; // 1 saniye spam koruması
  lastLogTime = now;

  const price = extractPrice();
  
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

// --- SEMBOLÜ BULMA (TOOLBAR ÖNCELİKLİ) ---
function findActiveSymbol() {
  const toolbarBtn = document.getElementById('header-toolbar-symbol-search');
  if (toolbarBtn && toolbarBtn.innerText.trim().length > 0) {
      return toolbarBtn.innerText.trim();
  }
  return document.title.split(' ')[0];
}

function extractPrice() {
  const match = document.title.match(/[\d.,]+/);
  return match ? match[0] : "-";
}

// --- DEĞİŞİKLİK KONTROLÜ ---
function checkChanges() {
  // Kullanıcı sayfada değilse işlemciyi yorma, çık.
  if (!isUserActive()) return;

  const detectedSymbol = findActiveSymbol();

  if (detectedSymbol && 
      detectedSymbol !== "TradingView" && 
      detectedSymbol !== "Yükleniyor..." && 
      detectedSymbol !== currentSymbol) {
      
      if (currentSymbol !== "") {
          sendLog('Sembol Değişti', { eski: currentSymbol, yeni: detectedSymbol });
      } else {
          sendLog('Oturum Başladı', { mesaj: `${detectedSymbol} aktif.` });
      }
      currentSymbol = detectedSymbol;
  }
}

// --- GÖZLEMCİLERİ YÖNET ---
function manageObservers() {
    // Odaklanma durumuna göre zamanlayıcıyı başlat/durdur
    if (isUserActive()) {
        if (!checkInterval) {
            checkInterval = setInterval(checkChanges, 1000);
            console.log("Takip Başladı (Odaklandı)");
            // Odaklanınca hemen bir kontrol et
            checkChanges();
        }
    } else {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
            console.log("Takip Durdu (Odak Kayboldu)");
        }
    }
}

// --- BAŞLATMA VE OLAY DİNLEYİCİLERİ ---
function startSystem() {
    // 1. Pencere Odaklanma Olayları (Focus/Blur)
    window.addEventListener('focus', manageObservers);
    window.addEventListener('blur', manageObservers);
    
    // İlk açılış kontrolü
    manageObservers();

    // 2. Toolbar Değişimini İzle (Sadece odaklıyken çalışır)
    const toolbarBtn = document.getElementById('header-toolbar-symbol-search');
    if (toolbarBtn) {
        const toolbarObserver = new MutationObserver(() => {
            if (isUserActive()) checkChanges();
        });
        toolbarObserver.observe(toolbarBtn, { childList: true, subtree: true, characterData: true });
    }

    // 3. DOM (Çizim/İndikatör) İzleyici
    const domObserver = new MutationObserver((mutations) => {
        if (!chrome.runtime?.id || !isUserActive()) return;

        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) return;

                // İndikatör
                if (node.querySelector && node.querySelector('[data-qa-id="legend-source-title"]')) {
                    const text = node.innerText.split('\n')[0];
                    if (text && !text.includes(currentSymbol)) {
                        sendLog('İndikatör', { isim: text });
                    }
                }
                // Çizim Paneli
                if (node.classList && (node.classList.contains('tv-floating-toolbar') || node.getAttribute('data-name') === 'floating-toolbar')) {
                    sendLog('Çizim', { tur: 'Grafik İşlemi' });
                }
            });
        });
    });
    domObserver.observe(document.body, { childList: true, subtree: true });

    // 4. Mouse Takibi
    document.addEventListener('mousedown', () => {
        if (window.getComputedStyle(document.body).cursor === 'crosshair') {
            drawingMode = true;
        }
    });

    document.addEventListener('mouseup', () => {
        if (drawingMode) {
            // Çizim biterken odak gitse bile kaydetmesi için kısa gecikme
            setTimeout(() => {
                if (window.getComputedStyle(document.body).cursor !== 'crosshair') {
                    sendLog('Çizim', { tur: 'Teknik Çizim' });
                    drawingMode = false;
                }
            }, 200);
        }
    });
}

// 2 saniye bekle ve başlat
setTimeout(startSystem, 2000);
// TradingView ağır yüklendiği için biraz daha bekle
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