// TradingView Simple Logger
// =========================
// Sadece hisse değişimi, tarih ve fiyat loglanır.

let currentSymbol = '';

// ==================== YARDIMCI FONKSİYONLAR ====================

function getElement(selector, parent = document) {
  return parent.querySelector(selector);
}

// ==================== SEMBOL TESPİTİ ====================

function detectSymbol() {
  // 1. Chart Legend (En güncel)
  const legendTitle = getElement('[data-name="legend-source-title"]') ||
    getElement('.legend-source-title');
  if (legendTitle) {
    const text = legendTitle.textContent.trim();
    if (text && text.length > 0) return text;
  }

  // 2. Header Toolbar
  const symbolBtn = getElement('#header-toolbar-symbol-search') ||
    getElement('[data-name="header-toolbar-symbol-search"]');
  if (symbolBtn) {
    const text = symbolBtn.textContent.trim();
    if (text && text.length > 0 && text !== 'Symbol Search') return text;
  }

  // 3. Title (Örn: "PGSUS 200.8 ...")
  const titleMatch = document.title.match(/^([A-Z0-9]+)/);
  if (titleMatch && titleMatch[1] !== 'TradingView') {
    return titleMatch[1];
  }

  // 4. URL Fallback
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('symbol')) {
      return urlParams.get('symbol');
    }
  } catch (e) { }

  return null;
}

function extractCurrentPrice() {
  // TradingView title formatı: "PGSUS 200,8 ▲ +1.83% Adsız"
  // Sembolden sonraki ilk sayıyı yakala (virgül veya nokta içerebilir)
  const title = document.title;

  // Sembolü atla ve fiyatı bul
  // Format: "SEMBOL FIYAT ▲/▼ ..." veya "SEMBOL FIYAT ..."
  const priceMatch = title.match(/^[A-Z0-9]+\s+([\d.,]+)/);
  if (priceMatch && priceMatch[1]) {
    return priceMatch[1];
  }

  // Alternatif: Herhangi bir sayı ara (ilk match)
  const anyNumber = title.match(/(\d+[.,]?\d*)/);
  if (anyNumber && anyNumber[1]) {
    return anyNumber[1];
  }

  // DOM'dan fiyat al - Last price elementi
  const lastPriceElem = document.querySelector('[class*="lastPrice"]') ||
    document.querySelector('[data-name="legend-source-item"] [class*="value"]');
  if (lastPriceElem) {
    const text = lastPriceElem.textContent.trim();
    const priceNum = text.match(/[\d.,]+/);
    if (priceNum) return priceNum[0];
  }

  return '-';
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
    console.log('📊 Log:', action, details);
  } catch (e) {
    // Extension context invalidated
  }
}

// ==================== SEMBOL DEĞİŞİM KONTROLÜ ====================

function checkSymbolChange() {
  const newSymbol = detectSymbol();

  if (!newSymbol || newSymbol === 'TradingView' || newSymbol === currentSymbol) return;

  const oldSymbol = currentSymbol;
  currentSymbol = newSymbol;

  console.log('🔄 Sembol Değişimi:', oldSymbol, '→', newSymbol);

  // Title'ın güncellenmesi için kısa bir gecikme ver, sonra fiyatı al
  setTimeout(() => {
    const price = extractCurrentPrice();

    if (oldSymbol && oldSymbol !== 'Bilinmiyor') {
      sendLog('Sembol Değişti', {
        eski: oldSymbol,
        yeni: newSymbol,
        fiyat: price
      });
    } else {
      sendLog('Oturum Başladı', {
        sembol: newSymbol,
        fiyat: price
      });
    }

    console.log('✅ Aktif Sembol:', currentSymbol, '| Fiyat:', price);
  }, 1500); // 1.5 saniye bekle (title güncellensin)
}

// ==================== BAŞLATMA ====================

function initialize() {
  console.log('🚀 TradingView Simple Logger: Başlatılıyor...');

  // İlk sembol kontrolü (sayfa yüklendikten sonra)
  setTimeout(checkSymbolChange, 2000);

  // Title değişimlerini izle (sembol değişimi için en az maliyetli yöntem)
  const titleObserver = new MutationObserver(checkSymbolChange);
  const titleElem = document.querySelector('title');
  if (titleElem) {
    titleObserver.observe(titleElem, { childList: true });
  }

  // Periyodik kontrol (yedek)
  setInterval(checkSymbolChange, 5000);

  console.log('✅ Simple Logger aktif!');
}

// Sayfa kapanırken son durumu logla
window.addEventListener('beforeunload', () => {
  if (currentSymbol && currentSymbol !== 'Bilinmiyor') {
    sendLog('Oturum Kapandı', {
      sembol: currentSymbol,
      fiyat: extractCurrentPrice()
    });
  }
});

// Başlat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
