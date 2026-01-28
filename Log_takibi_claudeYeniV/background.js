// TradingView Simple Logger - Background Script
// ==============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOG_ACTIVITY') {
    saveLog(message.log);
    sendResponse({ success: true });
  }
  return true;
});

async function saveLog(log) {
  try {
    const result = await chrome.storage.local.get(['activityLogs']);
    const logs = result.activityLogs || [];

    logs.push(log);

    // Son 1000 log tut
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }

    await chrome.storage.local.set({ activityLogs: logs });
    console.log('Log kaydedildi:', log.action);
  } catch (error) {
    console.error('Log kayıt hatası:', error);
  }
}

// Extension yüklendiğinde
chrome.runtime.onInstalled.addListener(() => {
  console.log('TradingView Simple Logger yüklendi.');
});