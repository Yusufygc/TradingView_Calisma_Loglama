// TradingView Logger — Background Service Worker v3.1
// ======================================================
// Sorumluluklar:
//   1. Gelen logları TODAY buffer'a (chrome.storage.local) yazar
//   2. Gün değişimini tespit edip dünü OPFS'e arşivler
//   3. Popup'tan ARCHIVE_NOW / EXPORT_ARCHIVE / GET_STORAGE_INFO mesajlarını işler
//   4. İlk çalışmada eski activityLogs verisini OPFS'e migrate eder
//   5. Pinned window açar

importScripts('../shared/constants.js', '../shared/storage.js');

// ── Mesaj dinleyici ──────────────────────────────────────────────────────

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

        case 'EXPORT_ARCHIVE':
          const csv = await StorageManager.exportAllAsCSV();
          sendResponse({ success: true, csv });
          break;

        case 'GET_STORAGE_INFO':
          const info  = await StorageManager.getStorageInfo();
          const local = await chrome.storage.local.getBytesInUse();
          sendResponse({ success: true, info: { ...info, localBytes: local } });
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

// ── Log kayıt ────────────────────────────────────────────────────────────

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

// ── Arşivleme ────────────────────────────────────────────────────────────

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

  // Index güncelle
  if (!index.includes(targetDay)) {
    index.unshift(targetDay);
    index.sort((a, b) => b.localeCompare(a));
    await StorageManager.writeIndex(index);
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.TODAY]:             remaining,
    [STORAGE_KEYS.LAST_ARCHIVE_DATE]: targetDay,
  });

  console.log(`[Archiver] ${targetDay}: ${toArchive.length} log arşivlendi.`);
}

// ── Pinned window ─────────────────────────────────────────────────────────

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
  chrome.windows.create({ url, type: 'popup', width: 680, height: 780, top: 80, left: 100 });
}

// ── Kurulum & Migration ───────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({ [STORAGE_KEYS.TODAY]: [] });
    console.log('[Logger] İlk kurulum tamamlandı.');
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

    console.log(`[Migration] ${legacy.length} eski log taşınıyor...`);
    await StorageManager.migrateFromLegacy(legacy);

    const today     = dateKey();
    const todayLogs = legacy.filter(l => l.timestamp && dateKey(new Date(l.timestamp)) === today);
    const res2      = await chrome.storage.local.get([STORAGE_KEYS.TODAY]);
    const existing  = res2[STORAGE_KEYS.TODAY] || [];

    await chrome.storage.local.set({
      [STORAGE_KEYS.TODAY]:       [...existing, ...todayLogs],
      [STORAGE_KEYS.LOGS_LEGACY]: null,
    });
    console.log('[Migration] Tamamlandı.');
  } catch (e) {
    console.error('[Migration] Hata:', e);
  }
}
