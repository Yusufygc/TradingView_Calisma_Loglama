import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Activity, 
  Save, 
  Download, 
  Trash2, 
  Clock, 
  Target, 
  TrendingUp, 
  Minus, 
  Type,
  Search,
  FileText,
  MousePointer2
} from 'lucide-react';

export default function TradingLogger() {
  // State tanımlamaları
  const [logs, setLogs] = useState([]);
  const [ticker, setTicker] = useState('ASELS');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [selectedTool, setSelectedTool] = useState(null);
  const [filter, setFilter] = useState('');

  // Sayfa yüklendiğinde local storage'dan verileri çek (Kalıcılık için)
  useEffect(() => {
    const savedLogs = localStorage.getItem('tradingViewLogs');
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    }
  }, []);

  // Loglar değiştiğinde local storage'a kaydet
  useEffect(() => {
    localStorage.setItem('tradingViewLogs', JSON.stringify(logs));
  }, [logs]);

  // Yeni log ekleme fonksiyonu
  const addLog = () => {
    if (!ticker) {
      alert("Lütfen bir hisse senedi (Ticker) giriniz.");
      return;
    }

    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ticker: ticker.toUpperCase(),
      tool: selectedTool || 'Genel Not',
      price: price || '-',
      note: note || 'Açıklama girilmedi',
    };

    setLogs([newLog, ...logs]);
    
    // Formu temizle (Ticker hariç, seri işlem için kalmalı)
    setPrice('');
    setNote('');
    setSelectedTool(null);
  };

  // Log silme
  const deleteLog = (id) => {
    setLogs(logs.filter(log => log.id !== id));
  };

  // Excel/CSV olarak indirme fonksiyonu
  const exportToCSV = () => {
    if (logs.length === 0) {
      alert("İndirilecek kayıt bulunamadı.");
      return;
    }

    // CSV Başlıkları
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM eklendi (Excel karakter sorunu için)
    csvContent += "Tarih,Saat,Hisse,İşlem Aracı,Fiyat Seviyesi,Notlar\n";

    logs.forEach(log => {
      const date = new Date(log.timestamp).toLocaleDateString('tr-TR');
      const time = new Date(log.timestamp).toLocaleTimeString('tr-TR');
      // Virgül içeren notları tırnak içine al
      const cleanNote = `"${log.note.replace(/"/g, '""')}"`;
      
      csvContent += `${date},${time},${log.ticker},${log.tool},${log.price},${cleanNote}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Trading_Loglari_${new Date().toLocaleDateString('tr-TR')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Tarih formatlayıcı
  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return {
      date: d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      time: d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  // Araç butonları için yapılandırma
  const tools = [
    { id: 'Yatay Çizgi', icon: <Minus size={18} />, color: 'bg-blue-600 hover:bg-blue-500' },
    { id: 'Yatay Işın', icon: <Target size={18} />, color: 'bg-indigo-600 hover:bg-indigo-500' },
    { id: 'Trend Çizgisi', icon: <TrendingUp size={18} />, color: 'bg-purple-600 hover:bg-purple-500' },
    { id: 'Fibonacci', icon: <Activity size={18} />, color: 'bg-green-600 hover:bg-green-500' },
    { id: 'Metin/Not', icon: <Type size={18} />, color: 'bg-yellow-600 hover:bg-yellow-500' },
    { id: 'İndikatör', icon: <LineChart size={18} />, color: 'bg-red-600 hover:bg-red-500' },
  ];

  // Filtreleme
  const filteredLogs = logs.filter(log => 
    log.ticker.includes(filter.toUpperCase()) || 
    log.note.toLowerCase().includes(filter.toLowerCase()) ||
    log.tool.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#131722] text-[#d1d4dc] font-sans p-4 md:p-8">
      {/* Ana Konteyner */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SOL PANEL: Veri Girişi */}
        <div className="lg:col-span-1 space-y-4">
          
          <div className="bg-[#1e222d] p-6 rounded-lg shadow-lg border border-[#2a2e39]">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
              <MousePointer2 className="text-blue-500" />
              İşlem Kaydedici
            </h2>

            {/* Hisse Girişi */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Hisse / Enstrüman</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className="w-full bg-[#2a2e39] border border-[#363a45] rounded p-2 text-white focus:outline-none focus:border-blue-500 font-bold text-lg"
                  placeholder="Örn: ASELS"
                />
                <Search className="absolute right-3 top-3 text-gray-500" size={18} />
              </div>
            </div>

            {/* Araç Seçimi (Grid) */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Kullanılan Araç</label>
              <div className="grid grid-cols-3 gap-2">
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedTool(tool.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded transition-all duration-200 ${
                      selectedTool === tool.id 
                        ? `${tool.color} text-white ring-2 ring-white ring-opacity-50` 
                        : 'bg-[#2a2e39] text-gray-400 hover:bg-[#363a45]'
                    }`}
                  >
                    {tool.icon}
                    <span className="text-[10px] mt-1 font-medium">{tool.id}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fiyat ve Not */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Fiyat Seviyesi (Opsiyonel)</label>
                <input 
                  type="text" 
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-[#2a2e39] border border-[#363a45] rounded p-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Örn: 150.40"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Analiz Notu</label>
                <textarea 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-[#2a2e39] border border-[#363a45] rounded p-2 text-white h-24 focus:outline-none focus:border-blue-500 text-sm resize-none"
                  placeholder="Destek kırılımı bekleniyor, alarm kuruldu..."
                />
              </div>
            </div>

            {/* Kaydet Butonu */}
            <button 
              onClick={addLog}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Loga Ekle
            </button>
          </div>

          {/* İstatistik Özeti (Opsiyonel) */}
          <div className="bg-[#1e222d] p-4 rounded-lg shadow-lg border border-[#2a2e39]">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Toplam Kayıt:</span>
              <span className="font-bold text-white">{logs.length}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-2">
              <span className="text-gray-400">Son İşlem:</span>
              <span className="text-white">{logs.length > 0 ? formatDate(logs[0].timestamp).time : '-'}</span>
            </div>
          </div>

        </div>

        {/* SAĞ PANEL: Log Listesi */}
        <div className="lg:col-span-2 flex flex-col h-[600px] lg:h-auto">
          <div className="bg-[#1e222d] rounded-lg shadow-lg border border-[#2a2e39] flex flex-col h-full">
            
            {/* Liste Başlığı ve Filtre */}
            <div className="p-4 border-b border-[#2a2e39] flex flex-col sm:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <FileText className="text-green-500" />
                Analiz Geçmişi
              </h2>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-grow">
                  <input 
                    type="text" 
                    placeholder="Ara (Hisse, Not...)"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="bg-[#131722] border border-[#363a45] rounded py-1.5 px-3 pl-8 text-sm text-white focus:outline-none w-full"
                  />
                  <Search className="absolute left-2.5 top-2 text-gray-500" size={14} />
                </div>
                <button 
                  onClick={exportToCSV}
                  className="bg-[#2a2e39] hover:bg-[#363a45] text-white px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors border border-[#363a45]"
                  title="Excel/CSV Olarak İndir"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">İndir</span>
                </button>
              </div>
            </div>

            {/* Tablo Header */}
            <div className="grid grid-cols-12 bg-[#2a2e39] p-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">
              <div className="col-span-2 md:col-span-2">Zaman</div>
              <div className="col-span-2 md:col-span-1">Hisse</div>
              <div className="col-span-2 md:col-span-2">Araç</div>
              <div className="col-span-2 md:col-span-2 text-right pr-4">Fiyat</div>
              <div className="col-span-3 md:col-span-4">Not</div>
              <div className="col-span-1 md:col-span-1 text-center">İşlem</div>
            </div>

            {/* Tablo İçeriği (Scrollable) */}
            <div className="flex-grow overflow-y-auto custom-scrollbar">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                  <Activity size={48} className="mb-2 opacity-20" />
                  <p>Henüz kayıt bulunmuyor.</p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const { date, time } = formatDate(log.timestamp);
                  return (
                    <div key={log.id} className="grid grid-cols-12 border-b border-[#2a2e39] p-3 text-sm hover:bg-[#2a2e39] transition-colors items-center group">
                      
                      {/* Zaman */}
                      <div className="col-span-2 md:col-span-2 flex flex-col">
                        <span className="text-white font-medium">{time}</span>
                        <span className="text-[10px] text-gray-500">{date}</span>
                      </div>

                      {/* Hisse */}
                      <div className="col-span-2 md:col-span-1">
                        <span className="bg-blue-900 text-blue-200 text-xs px-2 py-0.5 rounded font-bold">
                          {log.ticker}
                        </span>
                      </div>

                      {/* Araç */}
                      <div className="col-span-2 md:col-span-2 flex items-center gap-2 text-gray-300">
                        {/* İkona göre renklendirme yapılabilir ama basitlik için text */}
                        <span className="truncate">{log.tool}</span>
                      </div>

                      {/* Fiyat */}
                      <div className="col-span-2 md:col-span-2 text-right pr-4 font-mono text-yellow-500">
                        {log.price}
                      </div>

                      {/* Not */}
                      <div className="col-span-3 md:col-span-4 text-gray-400 truncate group-hover:text-gray-200" title={log.note}>
                        {log.note}
                      </div>

                      {/* Silme Butonu */}
                      <div className="col-span-1 md:col-span-1 text-center">
                        <button 
                          onClick={() => deleteLog(log.id)}
                          className="text-gray-600 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
          </div>
        </div>
      </div>
      
      {/* Scrollbar Style Injection */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #131722; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #363a45; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #474d5c; 
        }
      `}</style>
    </div>
  );
}