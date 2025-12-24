// Sayfa yüklendiğinde çalışır
console.log("TradingView Smart Logger Aktif 🚀");

document.addEventListener('copy', async (e) => {
    // 1. Panodaki veriyi okumaya çalış
    // TradingView veriyi panoya yazdıktan hemen sonra okumalıyız.
    // Küçük bir gecikme gerekebilir.
    setTimeout(readClipboardAndLog, 100);
});

async function readClipboardAndLog() {
    try {
        const text = await navigator.clipboard.readText();
        
        // TradingView çizim verisi mi kontrol et
        // Genellikle JSON formatındadır ve "points" içerir.
        if (!text.includes('"points":') || !text.includes('"type":')) {
            return; // Çizim verisi değilse yoksay
        }

        const data = JSON.parse(text);
        
        // TradingView sayfasından Hisse Adını (Ticker) Çekme
        // Title elementinden parslama (Genellikle "ASELS 150.00..." şeklindedir)
        const titleText = document.title; 
        const ticker = titleText.split(' ')[0] || "Bilinmeyen";

        // JSON'dan verileri ayıkla
        // Not: TradingView birden fazla obje kopyalamaya izin verir, biz ilkini alalım.
        // Yapı genellikle { "sources": [ ... ] } şeklindedir.
        
        // Basit bir parsing (TV'nin yapısı değişebilir, genel yaklaşımdır)
        let price = "0.00";
        let toolType = "Çizim";
        
        // Eğer TV'nin raw JSON yapısı ise:
        if (data.points && data.points[0]) {
             price = data.points[0].price; // Fiyat genelde buradadır
             toolType = data.type || "Araç";
        } 
        // Eğer bir wrapper içindeyse (sources)
        else if (data.sources && data.sources[0]) {
            const item = data.sources[0];
            if(item.state && item.state.points && item.state.points[0]) {
                price = item.state.points[0].price;
            }
            toolType = item.type || "Araç";
        }

        // Log Objesi Oluştur
        const logEntry = {
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            symbol: ticker,
            price: parseFloat(price).toFixed(2),
            tool: toolType,
            raw: text.substring(0, 50) + "..." // Debug için
        };

        // Arka plana gönder
        chrome.runtime.sendMessage({ type: 'LOG_DRAWING', data: logEntry });

    } catch (err) {
        // JSON parse hatası veya pano izni hatası
        // console.error("Logger Hatası:", err);
    }
}