// TradingView Logger — Content Script (Ana Orchestrator)
// ========================================================
// Yükleme sırası (manifest'te belirtilmeli):
//   detector.js → timer.js → toast.js → content.js

let currentSymbol = '';
let debounceTimer = null;
let pendingSymbol = null;
let _observerRef  = null;
let _intervalRef  = null;

// ── Log gönder ──────────────────────────────────────────

function sendLog(action, details) {
  if (!chrome.runtime?.id) return;
  try {
    const log = {
      timestamp:      Date.now(),
      date:           new Date().toLocaleDateString('tr-TR'),
      time:           new Date().toLocaleTimeString('tr-TR'),
      action,
      details,
      symbol:         currentSymbol || 'Bilinmiyor',
      price:          extractCurrentPrice(),
      sessionMs:      Timer.currentSessionMs(), // anlık oturum süresi
    };
    chrome.runtime.sendMessage({ type: 'LOG_ACTIVITY', log });
  } catch (_) {}
}

// ── Sembol değişim akışı ────────────────────────────────

function checkSymbolChange() {
  const detected = detectSymbol();
  if (!detected || detected === 'TradingView' || detected === currentSymbol) {
    if (pendingSymbol && detected === currentSymbol) {
      clearTimeout(debounceTimer);
      pendingSymbol = null;
    }
    return;
  }
  if (detected !== pendingSymbol) {
    if (debounceTimer) clearTimeout(debounceTimer);
    pendingSymbol = detected;
    debounceTimer = setTimeout(() => confirmSymbolChange(detected), 1500);
  }
}

async function confirmSymbolChange(newSymbol) {
  const recheck = detectSymbol();

  if (recheck && recheck !== newSymbol && recheck !== currentSymbol) {
    pendingSymbol = recheck;
    debounceTimer = setTimeout(() => confirmSymbolChange(recheck), 800);
    return;
  }
  if (recheck === currentSymbol) {
    pendingSymbol = null;
    return;
  }

  const oldSymbol   = currentSymbol;
  currentSymbol     = newSymbol;
  pendingSymbol     = null;

  // Timer: eski sembolü kapat, yeni sembolü başlat
  await Timer.onSymbolChange(oldSymbol, newSymbol);

  const price = extractCurrentPrice();

  if (oldSymbol && oldSymbol !== 'Bilinmiyor') {
    sendLog(ACTIONS.CHANGED, { eski: oldSymbol, yeni: newSymbol, fiyat: price });
  } else {
    sendLog(ACTIONS.STARTED, { sembol: newSymbol, fiyat: price });
  }

  checkForExistingNote(newSymbol);
}

// ── Toast bildirimi ─────────────────────────────────────

async function checkForExistingNote(symbol) {
  try {
    const res       = await chrome.storage.local.get([STORAGE_KEYS.NOTES, STORAGE_KEYS.LAST_VIEWS, STORAGE_KEYS.TIME_LOG, STORAGE_KEYS.TAGS]);
    const notes     = res[STORAGE_KEYS.NOTES]      || {};
    const lastViews = res[STORAGE_KEYS.LAST_VIEWS]  || {};
    const timeLog   = res[STORAGE_KEYS.TIME_LOG]    || {};
    const tags      = res[STORAGE_KEYS.TAGS]        || {};

    const currentPrice = extractCurrentPrice();
    const parts        = [];

    // Etiketler
    const symTags = (tags[symbol] || []);
    if (symTags.length > 0) {
      const tagLabels = symTags.map(id => {
        const def = PREDEFINED_TAGS.find(t => t.id === id);
        return def ? `<span style="color:${def.color};font-weight:600">${def.label}</span>` : id;
      }).join(' &nbsp;');
      parts.push(`<div style="margin-bottom:6px">${tagLabels}</div>`);
    }

    // Son görüntüleme & fiyat değişimi
    if (lastViews[symbol]) {
      const lv       = lastViews[symbol];
      const lastDate = new Date(lv.date).toLocaleDateString('tr-TR');
      const lastTime = new Date(lv.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const oldP     = parseFloat(String(lv.price).replace(',', '.'));
      const newP     = parseFloat(String(currentPrice).replace(',', '.'));
      let   changeHtml = '';
      if (!isNaN(oldP) && !isNaN(newP) && oldP > 0) {
        const diff = newP - oldP;
        const pct  = (diff / oldP * 100).toFixed(2);
        changeHtml = Math.abs(diff) < 0.01
          ? '<span style="color:#888">➡ Değişmedi</span>'
          : diff > 0
            ? `<span style="color:#4caf50">▲ +%${pct}</span>`
            : `<span style="color:#f44336">▼ %${pct}</span>`;
      }
      parts.push(`
        <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <div style="color:#666;font-size:11px">📅 ${lastDate} ${lastTime}</div>
          <div style="margin-top:4px;font-size:12px">
            Önceki: <strong style="color:#ff9800">${lv.price}</strong>
            → Şimdi: <strong style="color:#4fc3f7">${currentPrice}</strong>
            &nbsp;${changeHtml}
          </div>
        </div>`);
    } else {
      parts.push(`
        <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.08)">
          <div style="color:#4caf50;font-size:11px">✨ İlk görüntüleme!</div>
          <div style="margin-top:4px;font-size:12px">Fiyat: <strong style="color:#4fc3f7">${currentPrice}</strong></div>
        </div>`);
    }

    // Toplam inceleme süresi
    if (timeLog[symbol]) {
      const tl  = timeLog[symbol];
      const dur = formatDuration(tl.totalMs);
      parts.push(`<div style="font-size:11px;color:#aaa;margin-bottom:6px">⏱ Toplam: <strong style="color:#fff">${dur}</strong> &nbsp;·&nbsp; ${tl.sessions} seans</div>`);
    }

    // Not özeti
    const symbolNotes = Array.isArray(notes[symbol]) ? notes[symbol] : (notes[symbol] ? [notes[symbol]] : []);
    const latestNote = symbolNotes
      .filter(n => n?.note)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    if (latestNote) {
      const noteText = latestNote.note;
      const preview  = noteText.length > 90 ? noteText.substring(0, 90) + '…' : noteText;
      const escapedNote = preview.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const countText = symbolNotes.length > 1 ? ` (${symbolNotes.length} not)` : '';
      parts.push(`<div style="font-size:11px;color:#ffc107;margin-top:2px">📝${countText} ${escapedNote}</div>`);
    }

    showToast(`🔍 ${symbol}`, parts.join(''));

    // Son görüntülemeyi güncelle
    const lvRes   = await chrome.storage.local.get([STORAGE_KEYS.LAST_VIEWS]);
    const updated = lvRes[STORAGE_KEYS.LAST_VIEWS] || {};
    updated[symbol] = { date: Date.now(), price: currentPrice };
    await chrome.storage.local.set({ [STORAGE_KEYS.LAST_VIEWS]: updated });

  } catch (e) {
    console.error('checkForExistingNote hatası:', e);
  }
}

// ── Mesaj dinleyici (popup için) ────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    sendResponse({
      state: {
        currentSymbol,
        currentPrice:    extractCurrentPrice(),
        currentSessionMs: Timer.currentSessionMs(),
      },
    });
  }
  return true;
});

// ── Context temizleme ───────────────────────────────────

function cleanupOnContextInvalidation() {
  try {
    if (_observerRef) { _observerRef.disconnect(); _observerRef = null; }
    if (_intervalRef) { clearInterval(_intervalRef); _intervalRef = null; }
  } catch (_) {}
}

// ── Başlatma ────────────────────────────────────────────

function initialize() {
  if (window.self !== window.top) return; // iframe'leri atla

  setTimeout(checkSymbolChange, 2000);

  _observerRef = new MutationObserver(() => {
    try {
      if (!chrome.runtime?.id) { cleanupOnContextInvalidation(); return; }
      checkSymbolChange();
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) cleanupOnContextInvalidation();
    }
  });

  const titleEl = document.querySelector('title');
  _observerRef.observe(titleEl || document.head || document.documentElement, {
    childList: true, subtree: true, characterData: true,
  });

  _intervalRef = setInterval(() => {
    try {
      if (!chrome.runtime?.id) { cleanupOnContextInvalidation(); return; }
      checkSymbolChange();
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) cleanupOnContextInvalidation();
    }
  }, 3000);
}

// ── Sayfa kapanma ───────────────────────────────────────

window.addEventListener('beforeunload', async () => {
  if (!currentSymbol || !chrome.runtime?.id) return;
  try {
    await Timer.onPageClose();
    const log = {
      timestamp: Date.now(),
      date:      new Date().toLocaleDateString('tr-TR'),
      time:      new Date().toLocaleTimeString('tr-TR'),
      action:    ACTIONS.CLOSED,
      details:   { sembol: currentSymbol },
      symbol:    currentSymbol,
      price:     extractCurrentPrice(),
      sessionMs: 0,
    };
    chrome.storage.local.get(['activityLogs'], (res) => {
      const logs = res.activityLogs || [];
      logs.push(log);
      if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
      chrome.storage.local.set({ activityLogs: logs });
    });
  } catch (_) {}
});

// ── Boot ────────────────────────────────────────────────

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initialize)
  : initialize();
