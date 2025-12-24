chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LOG_DRAWING') {
    const logData = request.data;

    // 1. Veriyi Chrome Storage'a kaydet (veya sunucunuza POST edin)
    chrome.storage.local.get({ logs: [] }, (result) => {
      const logs = result.logs;
      logs.push(logData);
      chrome.storage.local.set({ logs: logs }, () => {
        
        // 2. Kullanıcıya Bildirim Göster
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png', // Klasörde 128x128 png olmalı
          title: 'Çizim Loglandı! 📝',
          message: `${logData.symbol} - ${logData.tool} @ ${logData.price}`
        });
        
        console.log("Log Kaydedildi:", logData);
      });
    });
  }
});