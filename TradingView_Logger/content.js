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

    // Not kontrolü yap
    checkForExistingNote(newSymbol);
  }, 1500);
}

// ==================== SON GÖRÜNTÜLEME & NOT BİLDİRİMİ ====================

async function checkForExistingNote(symbol) {
  try {
    const result = await chrome.storage.local.get(['stockNotes', 'stockLastViews']);
    const notes = result.stockNotes || {};
    const lastViews = result.stockLastViews || {};

    const currentPrice = extractCurrentPrice();
    const messages = [];

    // Son görüntüleme kontrolü
    if (lastViews[symbol]) {
      const lastView = lastViews[symbol];
      const lastDate = new Date(lastView.date).toLocaleDateString('tr-TR');
      const lastTime = new Date(lastView.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const lastPrice = lastView.price;

      // Fiyat değişimi hesapla
      let priceChange = '';
      if (lastPrice && lastPrice !== '-' && currentPrice && currentPrice !== '-') {
        const oldPrice = parseFloat(String(lastPrice).replace(',', '.'));
        const newPrice = parseFloat(String(currentPrice).replace(',', '.'));

        if (!isNaN(oldPrice) && !isNaN(newPrice) && oldPrice > 0) {
          const diff = newPrice - oldPrice;
          const changePercent = (diff / oldPrice * 100).toFixed(2);

          if (Math.abs(diff) < 0.01) {
            // Fiyat aynı kaldı
            priceChange = '<span style="color: #888;">➡️ Değişmedi</span>';
          } else if (diff > 0) {
            // Fiyat yükseldi
            priceChange = `<span style="color: #4caf50;">▲ +%${changePercent}</span>`;
          } else {
            // Fiyat düştü
            priceChange = `<span style="color: #f44336;">▼ %${changePercent}</span>`;
          }
        }
      }

      messages.push(`
        <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div style="color: #888; font-size: 11px;">📅 Son görüntüleme: ${lastDate} ${lastTime}</div>
          <div style="margin-top: 6px; font-size: 12px;">
            Önceki: <strong style="color: #ff9800;">${lastPrice}</strong> 
            → Şimdi: <strong style="color: #4fc3f7;">${currentPrice}</strong>
          </div>
          <div style="margin-top: 4px; font-size: 13px;">${priceChange}</div>
        </div>
      `);
    } else {
      // İlk kez görüntüleme
      messages.push(`
        <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div style="color: #4caf50; font-size: 11px;">✨ İlk görüntüleme!</div>
          <div style="margin-top: 4px; font-size: 12px;">
            Fiyat: <strong style="color: #4fc3f7;">${currentPrice}</strong>
          </div>
          <div style="color: #888; font-size: 10px; margin-top: 4px;">
            Bir sonraki gelişinizde karşılaştırma göreceksiniz.
          </div>
        </div>
      `);
    }

    // Not kontrolü
    if (notes[symbol]) {
      messages.push(`
        <div>
          <div style="color: #ffc107; font-size: 11px; margin-bottom: 4px;">📝 Notunuz:</div>
          <div style="font-size: 12px;">${escapeHtml(notes[symbol].note).substring(0, 100)}${notes[symbol].note.length > 100 ? '...' : ''}</div>
        </div>
      `);
    }

    // Bildirim göster (her zaman göster)
    showToast(`🔍 ${symbol}`, messages.join(''));

    // Son görüntülemeyi güncelle
    await saveLastView(symbol, currentPrice);

  } catch (e) {
    console.error('Not/LastView kontrol hatası:', e);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function saveLastView(symbol, price) {
  try {
    const result = await chrome.storage.local.get(['stockLastViews']);
    const lastViews = result.stockLastViews || {};

    lastViews[symbol] = {
      date: Date.now(),
      price: price
    };

    await chrome.storage.local.set({ stockLastViews: lastViews });
  } catch (e) {
    // Storage error
  }
}

function showToast(title, message) {
  // Mevcut toast varsa kaldır
  const existing = document.getElementById('tv-logger-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'tv-logger-toast';
  toast.innerHTML = `
    <div style="
      position: fixed;
      top: 70px;
      right: 20px;
      max-width: 320px;
      min-width: 280px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid rgba(79, 195, 247, 0.3);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideIn 0.3s ease;
    ">
      <div style="color: #4fc3f7; font-weight: 600; font-size: 14px; margin-bottom: 12px;">
        ${title}
      </div>
      <div style="color: #ddd; font-size: 12px; line-height: 1.6;">
        ${message}
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="
        position: absolute;
        top: 8px;
        right: 8px;
        background: transparent;
        border: none;
        color: #888;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 4px;
      ">×</button>
    </div>
    <style>
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    </style>
  `;

  document.body.appendChild(toast);

  // 6 saniye sonra otomatik kapat
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.transition = 'opacity 0.3s';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }
  }, 6000);
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
