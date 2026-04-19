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
  // 1. Önce DOM'dan al — en güvenilir kaynak
  const domSelectors = [
    '[class*="lastPrice"]',
    '[data-name="legend-source-item"] [class*="value"]',
    '[class*="priceWrapper"] [class*="price"]',
    '.tv-symbol-price-quote__value'
  ];
  for (const sel of domSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.textContent.trim();
      // Sadece geçerli fiyat formatı: en az bir rakam içermeli
      const priceNum = text.match(/^[\d.,\s]+$/);
      if (priceNum && text.length > 0 && text !== '0') return text.trim();
    }
  }

  // 2. Title fallback — sembolü güvenli şekilde atla
  // Format: "PGSUS 200,8 ▲ +1.83% Adsız"
  // Dikkat: sembol rakam içerebilir (US30, BTC.P, EUR/USD)
  // Bu nedenle sembolden sonra boşluk + rakam ile başlayan kısmı al
  const title = document.title;
  const symbol = currentSymbol || '';

  if (symbol && title.startsWith(symbol)) {
    // Bilinen sembolü atla, sonrasındaki ilk sayıyı al
    const afterSymbol = title.slice(symbol.length).trim();
    const priceMatch = afterSymbol.match(/^([\d.,]+)/);
    if (priceMatch && priceMatch[1]) return priceMatch[1];
  }

  // 3. Genel title regex — BÜYÜK HARF sembol bloğunu atla, sonrasındaki sayıyı al
  // "^[A-Z][A-Z0-9./]+" yerine boşlukla ayrılmış ilk token'ı sembol kabul et
  const titlePriceMatch = title.match(/^[^\s]+\s+([\d.,]+)/);
  if (titlePriceMatch && titlePriceMatch[1]) {
    // Çok kısa sayılar (1-2 hane) sembol kalıntısı olabilir, en az 3 karakter iste
    if (titlePriceMatch[1].replace(/[.,]/g, '').length >= 2) {
      return titlePriceMatch[1];
    }
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

let debounceTimer = null;
let pendingSymbol = null;

function checkSymbolChange() {
  const detected = detectSymbol();

  // Geçersiz veya aynı sembol ise işlem yapma
  if (!detected || detected === 'TradingView' || detected === currentSymbol) {
    // Eğer bekleyen bir işlem varsa ve sembol eski haline döndüyse (flicker), iptal et
    if (pendingSymbol && detected === currentSymbol) {
      clearTimeout(debounceTimer);
      pendingSymbol = null;
    }
    return;
  }

  // Yeni bir sembol algılandı
  if (detected !== pendingSymbol) {
    // Önceki sayacı iptal et (Hızlı değişimlerde sonuncusu geçerli olsun)
    if (debounceTimer) clearTimeout(debounceTimer);

    pendingSymbol = detected;
    console.log(`⏳ Sembol değişimi algılandı: ${currentSymbol} -> ${detected} (Bekleniyor...)`);

    debounceTimer = setTimeout(() => {
      confirmSymbolChange(detected);
    }, 1500); // 1.5 saniye boyunca kararlı kalmalı
  }
}

function confirmSymbolChange(newSymbol) {
  // Son bir kez daha kontrol et — ama TradingView hâlâ render ediyor olabilir.
  // Eğer sembol değişti gibi görünüyorsa tek retry ver (500ms), sonra kabul et.
  const currentDetected = detectSymbol();

  if (currentDetected && currentDetected !== newSymbol && currentDetected !== currentSymbol) {
    // Üçüncü bir sembol çıktı — yeni sembol ile debounce yeniden başlasın
    console.warn(`⚠️ Sembol değişti: ${newSymbol} → ${currentDetected}, yeniden bekleyeceğiz`);
    pendingSymbol = currentDetected;
    debounceTimer = setTimeout(() => confirmSymbolChange(currentDetected), 800);
    return;
  }

  if (currentDetected === currentSymbol) {
    // Sembol eski haline döndü (geçici flicker), iptal et
    console.warn(`⚠️ Sembol kararsız, işlem iptal: ${newSymbol} → geri döndü ${currentSymbol}`);
    pendingSymbol = null;
    return;
  }

  // currentDetected === newSymbol veya null (DOM henüz hazır değil ama title onayladı)
  // Her iki durumda da devam et — null durumunda newSymbol'e güven
  const oldSymbol = currentSymbol;
  currentSymbol = newSymbol;
  pendingSymbol = null;

  console.log('🔄 Sembol Değişimi Onaylandı:', oldSymbol, '→', newSymbol);

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

  checkForExistingNote(newSymbol);
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
      <button class="toast-close-btn" style="
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

  // Event listener ile kapatma (CSP uyumlu)
  toast.querySelector('.toast-close-btn').addEventListener('click', () => {
    toast.remove();
  });

  // 6 saniye sonra otomatik kapat
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.transition = 'opacity 0.3s';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }
  }, 6000);
}

// ==================== MESAJ DİNLEYİCİ (POPUP İÇİN) ====================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    sendResponse({
      state: {
        currentSymbol: currentSymbol,
        currentPrice: extractCurrentPrice()
      }
    });
  }
});

// ==================== BAŞLATMA ====================

// Extension context geçersizleştiğinde temizlik yap
let _observerRef = null;
let _intervalRef = null;

function cleanupOnContextInvalidation() {
  try {
    if (_observerRef) { _observerRef.disconnect(); _observerRef = null; }
    if (_intervalRef) { clearInterval(_intervalRef); _intervalRef = null; }
  } catch (e) { /* zaten temizlendi */ }
}

function initialize() {
  console.log('🚀 TradingView Simple Logger: Başlatılıyor...');

  // Sadece ana chart sayfasında çalış (iframe'leri filtrele)
  if (window.self !== window.top) {
    console.log('ℹ️ iframe context, logger başlatılmadı.');
    return;
  }

  // İlk sembol kontrolü (sayfa yüklendikten sonra)
  setTimeout(checkSymbolChange, 2000);

  // Title değişimlerini izle — childList + subtree + characterData gerekli
  // TradingView text node'u replace edebilir (characterData) veya yeni node ekleyebilir (childList)
  _observerRef = new MutationObserver(() => {
    try {
      if (!chrome.runtime?.id) { cleanupOnContextInvalidation(); return; }
      checkSymbolChange();
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) {
        cleanupOnContextInvalidation();
      }
    }
  });

  const titleElem = document.querySelector('title');
  if (titleElem) {
    _observerRef.observe(titleElem, {
      childList: true,
      subtree: true,
      characterData: true
    });
  } else {
    // title elementi yoksa document.head'i izle (dinamik ekleme için)
    _observerRef.observe(document.head || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Periyodik kontrol — observer'ın kaçırdığı değişimleri yakalar
  _intervalRef = setInterval(() => {
    try {
      if (!chrome.runtime?.id) { cleanupOnContextInvalidation(); return; }
      checkSymbolChange();
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) {
        cleanupOnContextInvalidation();
      }
    }
  }, 3000);

  console.log('✅ Simple Logger aktif!');
}

// Sayfa kapanırken son durumu logla
// NOT: beforeunload'da chrome.runtime.sendMessage güvenilmez (async kesilir).
// Doğrudan chrome.storage.local.set kullanıyoruz — daha güvenilir.
window.addEventListener('beforeunload', () => {
  if (!currentSymbol || currentSymbol === 'Bilinmiyor') return;
  if (!chrome.runtime?.id) return;

  try {
    const log = {
      timestamp: Date.now(),
      date: new Date().toLocaleDateString('tr-TR'),
      time: new Date().toLocaleTimeString('tr-TR'),
      action: 'Oturum Kapandı',
      details: { sembol: currentSymbol, fiyat: extractCurrentPrice() },
      symbol: currentSymbol,
      price: extractCurrentPrice()
    };

    // Storage'a doğrudan yaz — sendMessage yerine
    // Chrome bu işlemi beforeunload'da tamamlamaya çalışır
    chrome.storage.local.get(['activityLogs'], (result) => {
      const logs = result.activityLogs || [];
      logs.push(log);
      if (logs.length > 1000) logs.splice(0, logs.length - 1000);
      chrome.storage.local.set({ activityLogs: logs });
    });
  } catch (e) {
    // Context invalidated veya başka hata — sessizce geç
  }
});

// Başlat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}