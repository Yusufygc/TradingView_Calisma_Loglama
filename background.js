// Background Service Worker - Enhanced

// Content script'ten gelen logları dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LOG_ACTIVITY') {
    saveLog(request.log);
  } else if (request.type === 'SESSION_REPORT') {
    saveSessionReport(request.report);
  }
});

// Log'u storage'a kaydet
async function saveLog(log) {
  try {
    const result = await chrome.storage.local.get(['activityLogs']);
    const logs = result.activityLogs || [];
    
    logs.push(log);
    
    // Son 2000 log'u tut
    const recentLogs = logs.slice(-2000);
    
    await chrome.storage.local.set({ activityLogs: recentLogs });
  } catch (error) {
    console.error('Log kaydetme hatası:', error);
  }
}

// Oturum raporunu kaydet
async function saveSessionReport(report) {
  try {
    const result = await chrome.storage.local.get(['sessionReports']);
    const reports = result.sessionReports || [];
    
    reports.push(report);
    
    // Son 100 raporu tut
    const recentReports = reports.slice(-100);
    
    await chrome.storage.local.set({ sessionReports: recentReports });
    
    console.log('Oturum raporu kaydedildi:', report.symbol);
  } catch (error) {
    console.error('Rapor kaydetme hatası:', error);
  }
}

// Uzantı yüklendiğinde
chrome.runtime.onInstalled.addListener(() => {
  console.log('TradingView Enhanced Logger yüklendi');
});