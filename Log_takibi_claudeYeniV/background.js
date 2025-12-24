// Background Service Worker - Enhanced with Screenshots

// Content script'ten gelen logları ve screenshot'ları dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LOG_ACTIVITY') {
    saveLog(request.log);
  } else if (request.type === 'SESSION_REPORT') {
    saveSessionReport(request.report);
  } else if (request.type === 'SAVE_SCREENSHOT') {
    saveScreenshot(request);
  } else if (request.type === 'CAPTURE_SCREENSHOT') {
    captureTabScreenshot(sender.tab.id, request.rect, sendResponse);
    return true; // Async response için
  }
});

// Log kaydetme
async function saveLog(log) {
  try {
    const result = await chrome.storage.local.get(['activityLogs']);
    const logs = result.activityLogs || [];
    
    logs.push(log);
    
    // Son 2000 log
    const recentLogs = logs.slice(-2000);
    
    await chrome.storage.local.set({ activityLogs: recentLogs });
  } catch (error) {
    console.error('Log kaydetme hatası:', error);
  }
}

// Oturum raporu kaydetme
async function saveSessionReport(report) {
  try {
    const result = await chrome.storage.local.get(['sessionReports']);
    const reports = result.sessionReports || [];
    
    reports.push(report);
    
    // Son 100 rapor
    const recentReports = reports.slice(-100);
    
    await chrome.storage.local.set({ sessionReports: recentReports });
    
    console.log('✅ Oturum raporu kaydedildi:', report.symbol);
  } catch (error) {
    console.error('Rapor kaydetme hatası:', error);
  }
}

// Screenshot kaydetme - Sembol bazlı organize
async function saveScreenshot(request) {
  try {
    const { symbol, filename, data, drawingInfo } = request;
    
    if (!data) {
      console.log('Screenshot verisi boş');
      return;
    }
    
    // Sembol bazlı screenshot storage
    const storageKey = `screenshots_${symbol}`;
    const result = await chrome.storage.local.get([storageKey]);
    const screenshots = result[storageKey] || [];
    
    screenshots.push({
      filename: filename,
      data: data,
      timestamp: Date.now(),
      drawingInfo: {
        araç: drawingInfo.araç,
        fiyat: drawingInfo.fiyat,
        zaman: drawingInfo.zaman
      }
    });
    
    // Son 50 screenshot'ı tut (her sembol için)
    const recentScreenshots = screenshots.slice(-50);
    
    await chrome.storage.local.set({ [storageKey]: recentScreenshots });
    
    console.log(`📸 Screenshot kaydedildi: ${symbol}/${filename}`);
  } catch (error) {
    console.error('Screenshot kaydetme hatası:', error);
  }
}

// Tab screenshot alma (Chrome API)
async function captureTabScreenshot(tabId, rect, sendResponse) {
  try {
    const screenshot = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 90
    });
    
    sendResponse({ screenshot: screenshot });
  } catch (error) {
    console.error('Tab capture hatası:', error);
    sendResponse({ screenshot: null });
  }
}

// Uzantı yüklendiğinde
chrome.runtime.onInstalled.addListener(() => {
  console.log('🚀 TradingView Enhanced Logger (Screenshot Edition) yüklendi');
});