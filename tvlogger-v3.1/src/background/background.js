// TradingView Logger - Background Service Worker v3.1
// Responsibilities:
// 1. Persist incoming logs to today's chrome.storage.local buffer
// 2. Archive older days to OPFS
// 3. Handle popup archive/storage/pinned-window requests
// 4. Migrate legacy activityLogs data
// 5. Forward selected events to a Telegram backend/proxy

importScripts('../shared/constants.js', '../shared/storage.js');

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case 'LOG_ACTIVITY':
          await handleIncomingLog(msg.log);
          sendResponse({ success: true });
          break;

        case 'ARCHIVE_NOW':
          await archiveYesterday();
          sendResponse({ success: true });
          break;

        case 'EXPORT_ARCHIVE': {
          const csv = await StorageManager.exportAllAsCSV();
          sendResponse({ success: true, csv });
          break;
        }

        case 'GET_STORAGE_INFO': {
          const info  = await StorageManager.getStorageInfo();
          const local = await chrome.storage.local.getBytesInUse();
          sendResponse({ success: true, info: { ...info, localBytes: local } });
          break;
        }

        case 'TELEGRAM_TEST':
          sendResponse(await sendTelegramMessage('TradingView Logger baglanti testi basarili.', {
            type: 'test',
            sentAt: Date.now(),
          }));
          break;

        case 'TELEGRAM_SEND_TODAY_SUMMARY':
          sendResponse(await sendTodayTelegramSummary());
          break;

        case 'TELEGRAM_NOTE_UPDATED':
          sendResponse(await sendTelegramNoteUpdate(msg.note));
          break;

        case 'OPEN_PINNED':
          await openPinnedWindow();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (e) {
      console.error('[Background]', e);
      sendResponse({ success: false, error: e.message });
    }
  })();
  return true;
});

async function handleIncomingLog(log) {
  const logDay = log.timestamp ? dateKey(new Date(log.timestamp)) : dateKey();
  const today  = dateKey();

  if (logDay !== today) {
    await archiveDayIfNeeded(logDay);
  }

  const res    = await chrome.storage.local.get([STORAGE_KEYS.TODAY]);
  const buffer = res[STORAGE_KEYS.TODAY] || [];
  buffer.push(log);
  if (buffer.length > MAX_TODAY_LOGS) buffer.splice(0, buffer.length - MAX_TODAY_LOGS);
  await chrome.storage.local.set({ [STORAGE_KEYS.TODAY]: buffer });

  await archiveYesterdayIfNeeded();
}

async function archiveYesterdayIfNeeded() {
  const res         = await chrome.storage.local.get([STORAGE_KEYS.LAST_ARCHIVE_DATE]);
  const lastArchive = res[STORAGE_KEYS.LAST_ARCHIVE_DATE] || '';
  const yesterday   = dateKey(new Date(Date.now() - 86400000));
  if (lastArchive === yesterday) return;
  await archiveYesterday();
}

async function archiveYesterday() {
  const yesterday = dateKey(new Date(Date.now() - 86400000));
  await archiveDayIfNeeded(yesterday);
}

async function archiveDayIfNeeded(targetDay) {
  const today = dateKey();
  if (targetDay === today) return;

  const index = await StorageManager.readIndex();
  if (index.includes(targetDay)) {
    await chrome.storage.local.set({ [STORAGE_KEYS.LAST_ARCHIVE_DATE]: targetDay });
    return;
  }

  const res    = await chrome.storage.local.get([STORAGE_KEYS.TODAY]);
  const buffer = res[STORAGE_KEYS.TODAY] || [];

  const toArchive = buffer.filter(l => {
    const lDay = l.timestamp ? dateKey(new Date(l.timestamp)) : '';
    return lDay === targetDay;
  });
  const remaining = buffer.filter(l => {
    const lDay = l.timestamp ? dateKey(new Date(l.timestamp)) : '';
    return lDay !== targetDay;
  });

  if (toArchive.length) {
    await StorageManager.writeDay(targetDay, toArchive);
  }

  if (!index.includes(targetDay)) {
    index.unshift(targetDay);
    index.sort((a, b) => b.localeCompare(a));
    await StorageManager.writeIndex(index);
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.TODAY]:             remaining,
    [STORAGE_KEYS.LAST_ARCHIVE_DATE]: targetDay,
  });

  console.log(`[Archiver] ${targetDay}: ${toArchive.length} log archived.`);

  if (toArchive.length) {
    await sendTelegramDailySummary(targetDay, toArchive, { type: 'daily_archive' });
  }
}

async function getTelegramSettings() {
  const keys = [
    STORAGE_KEYS.TELEGRAM_ENABLED,
    STORAGE_KEYS.TELEGRAM_ENDPOINT_URL,
    STORAGE_KEYS.TELEGRAM_CLIENT_SECRET,
    STORAGE_KEYS.TELEGRAM_CHAT_ID,
  ];
  const res = await chrome.storage.local.get(keys);
  return {
    enabled:      Boolean(res[STORAGE_KEYS.TELEGRAM_ENABLED]),
    endpointUrl:  String(res[STORAGE_KEYS.TELEGRAM_ENDPOINT_URL] || '').trim(),
    clientSecret: String(res[STORAGE_KEYS.TELEGRAM_CLIENT_SECRET] || '').trim(),
    chatId:       String(res[STORAGE_KEYS.TELEGRAM_CHAT_ID] || '').trim(),
  };
}

async function sendTelegramMessage(text, meta = {}) {
  try {
    const settings = await getTelegramSettings();
    if (!settings.enabled) {
      return { success: false, error: 'Telegram kapali.' };
    }
    if (!settings.endpointUrl) {
      return { success: false, error: 'Telegram endpoint URL eksik.' };
    }
    if (!/^https?:\/\//i.test(settings.endpointUrl)) {
      return { success: false, error: 'Endpoint URL http veya https ile baslamali.' };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (settings.clientSecret) headers['X-Client-Secret'] = settings.clientSecret;

    const response = await fetch(settings.endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: String(text || '').slice(0, 3800),
        chatId: settings.chatId || undefined,
        meta,
      }),
    });

    const bodyText = await response.text();
    let body = {};
    try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = { raw: bodyText }; }

    if (!response.ok || body.ok === false) {
      return {
        success: false,
        error: body.error || body.description || `Telegram proxy hatasi: ${response.status}`,
      };
    }
    return { success: true, response: body };
  } catch (e) {
    console.warn('[Telegram]', e);
    return { success: false, error: e.message || 'Telegram gonderimi basarisiz.' };
  }
}

async function sendTodayTelegramSummary() {
  const res   = await chrome.storage.local.get([STORAGE_KEYS.TODAY, STORAGE_KEYS.NOTES, STORAGE_KEYS.TAGS]);
  const logs  = res[STORAGE_KEYS.TODAY] || [];
  const notes = res[STORAGE_KEYS.NOTES] || {};
  const tags  = res[STORAGE_KEYS.TAGS] || {};
  const text  = buildTelegramLogSummary(`Bugun Ozeti (${dateKey()})`, logs, notes, tags);
  return await sendTelegramMessage(text, { type: 'today_summary', date: dateKey(), count: logs.length });
}

async function sendTelegramDailySummary(day, logs, meta = {}) {
  const res   = await chrome.storage.local.get([STORAGE_KEYS.NOTES, STORAGE_KEYS.TAGS]);
  const notes = res[STORAGE_KEYS.NOTES] || {};
  const tags  = res[STORAGE_KEYS.TAGS] || {};
  const text  = buildTelegramLogSummary(`Gunluk Arsiv Ozeti (${day})`, logs, notes, tags);
  return await sendTelegramMessage(text, { ...meta, date: day, count: logs.length });
}

async function sendTelegramNoteUpdate(note) {
  if (!note?.symbol || !note?.text) {
    return { success: false, error: 'Not bildirimi eksik.' };
  }
  return await sendTelegramMessage(buildTelegramNoteMessage(note), {
    type: 'note_updated',
    symbol: note.symbol,
    updatedAt: note.updatedAt || Date.now(),
  });
}

function buildTelegramLogSummary(title, logs, notes = {}, tags = {}) {
  if (!logs.length) {
    return `${title}\n\nKayit yok.`;
  }

  const bySymbol = {};
  const lastPriceBySymbol = {};
  let totalMs = 0;
  for (const log of logs) {
    const sym = log.symbol || log.details?.sembol || log.details?.yeni || 'Bilinmiyor';
    bySymbol[sym] = (bySymbol[sym] || 0) + 1;
    if (hasTelegramValue(log.price)) {
      lastPriceBySymbol[sym] = log.price;
    } else if (hasTelegramValue(log.details?.fiyat)) {
      lastPriceBySymbol[sym] = log.details.fiyat;
    }
    totalMs += log.sessionMs || 0;
  }

  const topSymbolLines = Object.entries(bySymbol)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([sym, count], idx) => (
      `${idx + 1}. ${sym} - ${count} kayit - son fiyat: ${formatTelegramValue(lastPriceBySymbol[sym])}`
    ));

  const notedSymbolLines = Object.keys(bySymbol)
    .filter(sym => hasNotesForSymbol(notes, sym) || tags[sym]?.length)
    .slice(0, 6)
    .map(sym => {
      const tagText = (tags[sym] || []).map(id => {
        const def = PREDEFINED_TAGS.find(t => t.id === id);
        return def ? def.label : id;
      }).join(', ');
      const noteCount = getNotesForSymbol(notes, sym).length;
      const noteText = noteCount ? `${noteCount} not` : '';
      const suffix = [tagText, noteText].filter(Boolean).join(' - ');
      return suffix ? `${sym}: ${suffix}` : sym;
    });

  const last = logs[logs.length - 1];
  const lastSymbol = last.symbol || last.details?.sembol || last.details?.yeni || '-';
  const lines = [
    'TradingView Logger',
    title.replace(/\(([^)]+)\)/, '- $1'),
    '',
    'Ozet',
    `Toplam kayit: ${logs.length}`,
    `Farkli hisse: ${Object.keys(bySymbol).length}`,
    `Toplam sure: ${formatTelegramDuration(totalMs)}`,
    '',
    'Son kayit',
    `Hisse: ${lastSymbol}`,
    `Fiyat: ${formatTelegramValue(last.price || last.details?.fiyat)}`,
    `Zaman: ${(last.date || '-') + ' ' + (last.time || '-')}`,
    '',
    'En cok bakilanlar',
    topSymbolLines.join('\n') || '-',
  ];

  if (notedSymbolLines.length) {
    lines.push('', 'Notlu / etiketli', notedSymbolLines.join('\n'));
  }

  return lines.join('\n').slice(0, 3800);
}

function getNotesForSymbol(notes, sym) {
  const value = notes?.[sym];
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  return list.filter(n => String(n?.note ?? n?.text ?? '').trim());
}

function hasNotesForSymbol(notes, sym) {
  return getNotesForSymbol(notes, sym).length > 0;
}

function buildTelegramNoteMessage(note) {
  const trimmed = String(note.text).trim();
  const preview = trimmed.length > 700 ? `${trimmed.slice(0, 700)}...` : trimmed;
  return [
    'TradingView Logger',
    'Not Guncellendi',
    '',
    `Hisse: ${note.symbol}`,
    `Fiyat: ${formatTelegramValue(note.price)}`,
    `Zaman: ${new Date(note.updatedAt || Date.now()).toLocaleString('tr-TR')}`,
    '',
    'Not:',
    preview,
  ].join('\n');
}

function hasTelegramValue(value) {
  const text = String(value ?? '').trim();
  return Boolean(text && text !== '-');
}

function formatTelegramValue(value) {
  return hasTelegramValue(value) ? String(value).trim() : '-';
}

function formatTelegramDuration(ms) {
  if (!ms || ms <= 0) return '-';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}s ${m}dk`;
  if (m > 0) return `${m}dk ${s}sn`;
  return `${s}sn`;
}

async function openPinnedWindow() {
  const url     = chrome.runtime.getURL('src/popup/popup.html') + '?pinned=1';
  const windows = await chrome.windows.getAll({ populate: true });
  for (const win of windows) {
    for (const tab of (win.tabs || [])) {
      if (tab.url?.includes('pinned=1')) {
        chrome.windows.update(win.id, { focused: true });
        return;
      }
    }
  }
  chrome.windows.create({ url, type: 'popup', width: 680, height: 900, top: 80, left: 100 });
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({ [STORAGE_KEYS.TODAY]: [] });
    console.log('[Logger] First install completed.');
  }
  if (reason === 'update' || reason === 'install') {
    await migrateLegacyData();
  }
});

async function migrateLegacyData() {
  try {
    const res    = await chrome.storage.local.get([STORAGE_KEYS.LOGS_LEGACY]);
    const legacy = res[STORAGE_KEYS.LOGS_LEGACY];
    if (!legacy?.length) return;

    console.log(`[Migration] Moving ${legacy.length} legacy logs...`);
    await StorageManager.migrateFromLegacy(legacy);

    const today     = dateKey();
    const todayLogs = legacy.filter(l => l.timestamp && dateKey(new Date(l.timestamp)) === today);
    const res2      = await chrome.storage.local.get([STORAGE_KEYS.TODAY]);
    const existing  = res2[STORAGE_KEYS.TODAY] || [];

    await chrome.storage.local.set({
      [STORAGE_KEYS.TODAY]:       [...existing, ...todayLogs],
      [STORAGE_KEYS.LOGS_LEGACY]: null,
    });
    console.log('[Migration] Completed.');
  } catch (e) {
    console.error('[Migration] Error:', e);
  }
}
