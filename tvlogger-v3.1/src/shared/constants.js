// TradingView Logger — Shared Constants
// =======================================

const STORAGE_KEYS = {
  // chrome.storage.local — küçük & sık erişilen veriler
  TODAY:      'activityLogs_today',  // sadece bugünün logları
  NOTES:      'stockNotes',
  LAST_VIEWS: 'stockLastViews',
  TIME_LOG:   'stockTimeLog',
  TAGS:       'stockTags',
  LAST_ARCHIVE_DATE: 'lastArchiveDate', // son arşiv tarihi

  // Eski key — migration için tutuldu, v3.1'de kaldırılacak
  LOGS_LEGACY: 'activityLogs',
};

// OPFS dosya yolları
const OPFS = {
  DIR:   'logs',                          // logs/ klasörü
  INDEX: 'logs_index.json',               // hangi günler arşivlendi
  // Dosya adı: dateKey(date) → "2025-04-18"
};

const ACTIONS = {
  STARTED: 'Oturum Başladı',
  CHANGED: 'Sembol Değişti',
  CLOSED:  'Oturum Kapandı',
};

// Bugünkü log sayısı limiti (OPFS'e taşınmadan önce)
const MAX_TODAY_LOGS = 500;

const PREDEFINED_TAGS = [
  { id: 'watchlist', label: '👀 İzleme Listesi', color: '#4fc3f7' },
  { id: 'buy',       label: '🟢 Al Listesi',      color: '#4caf50' },
  { id: 'sell',      label: '🔴 Sat Listesi',     color: '#f44336' },
  { id: 'analyzed',  label: '✅ İncelendi',        color: '#ab47bc' },
  { id: 'risky',     label: '⚠️ Dikkatli',         color: '#ffc107' },
  { id: 'favorite',  label: '⭐ Favori',           color: '#ff9800' },
];

// "2025-04-18" formatında tarih anahtarı üret
function dateKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
