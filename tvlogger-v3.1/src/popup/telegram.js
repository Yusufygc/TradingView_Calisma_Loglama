// TradingView Logger - Telegram settings and actions

const TelegramModule = (() => {
  function el(id) {
    return document.getElementById(id);
  }

  async function load() {
    const res = await chrome.storage.local.get([
      STORAGE_KEYS.TELEGRAM_ENABLED,
      STORAGE_KEYS.TELEGRAM_ENDPOINT_URL,
      STORAGE_KEYS.TELEGRAM_CLIENT_SECRET,
      STORAGE_KEYS.TELEGRAM_CHAT_ID,
    ]);

    if (el('telegramEnabled')) {
      el('telegramEnabled').checked = Boolean(res[STORAGE_KEYS.TELEGRAM_ENABLED]);
    }
    if (el('telegramEndpointUrl')) {
      el('telegramEndpointUrl').value = res[STORAGE_KEYS.TELEGRAM_ENDPOINT_URL] || '';
    }
    if (el('telegramClientSecret')) {
      el('telegramClientSecret').value = '';
    }
    updateSecretState(Boolean(res[STORAGE_KEYS.TELEGRAM_CLIENT_SECRET]));
    if (el('telegramChatId')) {
      el('telegramChatId').value = res[STORAGE_KEYS.TELEGRAM_CHAT_ID] || '';
    }

    bindEvents();
    setStatus(res[STORAGE_KEYS.TELEGRAM_ENABLED] ? 'Telegram hazir.' : 'Telegram kapali.');
  }

  function bindEvents() {
    bindOnce('saveTelegramSettings', 'click', saveSettings);
    bindOnce('testTelegram', 'click', test);
    bindOnce('sendTelegramToday', 'click', sendTodaySummary);
    bindOnce('telegramEnabled', 'change', saveSettings);
  }

  function bindOnce(id, event, handler) {
    const node = el(id);
    if (!node || node.dataset.bound) return;
    node.dataset.bound = '1';
    node.addEventListener(event, handler);
  }

  async function saveSettings() {
    const endpointUrl = el('telegramEndpointUrl')?.value.trim() || '';
    const clientSecret = el('telegramClientSecret')?.value.trim() || '';
    const chatId = el('telegramChatId')?.value.trim() || '';
    const enabled = Boolean(el('telegramEnabled')?.checked);
    const existing = await chrome.storage.local.get([STORAGE_KEYS.TELEGRAM_CLIENT_SECRET]);
    const nextClientSecret = clientSecret || existing[STORAGE_KEYS.TELEGRAM_CLIENT_SECRET] || '';

    await chrome.storage.local.set({
      [STORAGE_KEYS.TELEGRAM_ENABLED]: enabled,
      [STORAGE_KEYS.TELEGRAM_ENDPOINT_URL]: endpointUrl,
      [STORAGE_KEYS.TELEGRAM_CLIENT_SECRET]: nextClientSecret,
      [STORAGE_KEYS.TELEGRAM_CHAT_ID]: chatId,
    });

    if (el('telegramClientSecret')) el('telegramClientSecret').value = '';
    updateSecretState(Boolean(nextClientSecret));
    setStatus('Telegram ayarlari kaydedildi.', 'ok');
    return { enabled, endpointUrl, clientSecret: nextClientSecret, chatId };
  }

  async function test() {
    const btn = el('testTelegram');
    await withBusy(btn, 'Gonderiliyor...', async () => {
      await saveSettings();
      const resp = await sendMessage({ type: 'TELEGRAM_TEST' });
      showResponse(resp, 'Test mesaji gonderildi.');
    });
  }

  async function sendTodaySummary() {
    const btn = el('sendTelegramToday');
    await withBusy(btn, 'Gonderiliyor...', async () => {
      await saveSettings();
      const resp = await sendMessage({ type: 'TELEGRAM_SEND_TODAY_SUMMARY' });
      showResponse(resp, 'Bugunun ozeti gonderildi.');
    });
  }

  function sendMessage(message) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(message, resp => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(resp || { success: false, error: 'Bos yanit.' });
      });
    });
  }

  async function withBusy(button, text, fn) {
    if (!button) {
      await fn();
      return;
    }
    const original = button.textContent;
    button.disabled = true;
    button.textContent = text;
    try {
      await fn();
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function showResponse(resp, okMessage) {
    if (resp?.success) {
      setStatus(okMessage, 'ok');
    } else {
      setStatus(resp?.error || 'Telegram islemi basarisiz.', 'err');
    }
  }

  function setStatus(message, type = '') {
    const status = el('telegramStatus');
    if (!status) return;
    status.className = `telegram-status ${type}`.trim();
    status.textContent = message || '';
  }

  function updateSecretState(hasSecret) {
    const state = el('telegramSecretState');
    if (!state) return;
    state.className = hasSecret ? 'secret-state has-secret' : 'secret-state';
    state.textContent = hasSecret
      ? 'Client secret kayitli. Degistirmek icin yeni deger girin.'
      : 'Client secret kayitli degil.';
  }

  return { load };
})();
