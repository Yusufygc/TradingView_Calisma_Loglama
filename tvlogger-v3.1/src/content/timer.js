// TradingView Logger — Session Timer
// ====================================
// Her sembol için "o sembolde kaç ms geçirildi" bilgisini tutar.
// Veriler chrome.storage.local['stockTimeLog'] içinde saklanır.
//
// Veri yapısı:
// stockTimeLog: {
//   "PGSUS": { totalMs: 142000, sessions: 5, lastStart: null },
//   "THYAO": { totalMs: 87000,  sessions: 3, lastStart: null },
// }

const Timer = (() => {
  let activeSymbol  = null;
  let sessionStart  = null; // Date.now() — sembol açıldığında

  // Sembol değişince: eski sembolün süresini kaydet, yeni sembolü başlat
  async function onSymbolChange(oldSymbol, newSymbol) {
    if (oldSymbol) await _commitSession(oldSymbol);
    if (newSymbol) _startSession(newSymbol);
  }

  // Sayfa kapanınca mevcut oturumu kaydet
  async function onPageClose() {
    if (activeSymbol) await _commitSession(activeSymbol);
  }

  function _startSession(symbol) {
    activeSymbol = symbol;
    sessionStart = Date.now();
  }

  async function _commitSession(symbol) {
    if (!symbol || !sessionStart) return;
    const elapsed = Date.now() - sessionStart;
    sessionStart  = null;
    activeSymbol  = null;
    if (elapsed < 2000) return; // 2 sn altı görmezden gel (hızlı geçiş)

    try {
      const res  = await chrome.storage.local.get(['stockTimeLog']);
      const tlog = res.stockTimeLog || {};
      if (!tlog[symbol]) tlog[symbol] = { totalMs: 0, sessions: 0 };
      tlog[symbol].totalMs  += elapsed;
      tlog[symbol].sessions += 1;
      await chrome.storage.local.set({ stockTimeLog: tlog });
    } catch (e) {
      // storage hatası — sessiz geç
    }
  }

  // Anlık oturum süresini döndür (kaydetmeden)
  function currentSessionMs() {
    if (!sessionStart) return 0;
    return Date.now() - sessionStart;
  }

  return { onSymbolChange, onPageClose, currentSessionMs };
})();
