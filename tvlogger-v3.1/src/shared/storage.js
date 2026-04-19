// TradingView Logger — StorageManager (OPFS Wrapper)
// ====================================================
// Hem background service worker hem popup tarafından kullanılır.
// OPFS (Origin Private File System) üzerinde logs/ klasörünü yönetir.
//
// JSONL formatı: her satır tek bir JSON log objesi.
// Bu sayede dosyayı baştan sona parse etmek yerine sadece son N satırı okuyabiliriz.

const StorageManager = (() => {

  // ── OPFS kök dizinini al ─────────────────────────────

  async function _getRoot() {
    return await navigator.storage.getDirectory();
  }

  async function _getLogsDir(create = true) {
    const root = await _getRoot();
    return await root.getDirectoryHandle(OPFS.DIR, { create });
  }

  // ── Index okuma / yazma ──────────────────────────────
  // Index: arşivlenmiş günlerin listesi, en yeni önce
  // ["2025-04-18", "2025-04-17", ...]

  async function readIndex() {
    try {
      const root = await _getRoot();
      const fh   = await root.getFileHandle(OPFS.INDEX, { create: false });
      const file = await fh.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch {
      return []; // dosya yoksa boş
    }
  }

  async function writeIndex(index) {
    const root = await _getRoot();
    const fh   = await root.getFileHandle(OPFS.INDEX, { create: true });
    const w    = await fh.createWritable();
    await w.write(JSON.stringify(index));
    await w.close();
  }

  // ── Günlük JSONL dosyası yaz ─────────────────────────
  // dateStr: "2025-04-18"
  // logs: array of log objects

  async function writeDay(dateStr, logs) {
    if (!logs.length) return;
    const dir    = await _getLogsDir(true);
    const fh     = await dir.getFileHandle(`${dateStr}.jsonl`, { create: true });
    const w      = await fh.createWritable();
    const lines  = logs.map(l => JSON.stringify(l)).join('\n') + '\n';
    await w.write(lines);
    await w.close();
  }

  // ── Günlük JSONL dosyası oku ─────────────────────────

  async function readDay(dateStr) {
    try {
      const dir  = await _getLogsDir(false);
      const fh   = await dir.getFileHandle(`${dateStr}.jsonl`, { create: false });
      const file = await fh.getFile();
      const text = await file.text();
      return _parseJsonl(text);
    } catch {
      return [];
    }
  }

  // ── Birden fazla gün oku ─────────────────────────────

  async function readDays(dateStrArray) {
    const results = await Promise.all(dateStrArray.map(d => readDay(d)));
    return results.flat();
  }

  // ── Son N günü oku ───────────────────────────────────

  async function readRecentDays(n = 30) {
    const index = await readIndex();
    const recent = index.slice(0, n);
    return await readDays(recent);
  }

  // ── Gün sil ──────────────────────────────────────────

  async function deleteDay(dateStr) {
    try {
      const dir = await _getLogsDir(false);
      await dir.removeEntry(`${dateStr}.jsonl`);
    } catch { /* zaten yok */ }
  }

  // ── Tüm arşivi log objesi array olarak döndür ─────────
  // (Formatlama CSVExporter'a bırakıldı)

  async function exportAllAsCSV() {
    const index = await readIndex();
    const all   = await readDays(index);
    // Raw log array'i JSON olarak serialize et — background mesajla gönderir
    // archive.js'de CSVExporter.fromArchiveString() bu veriyi işler
    return JSON.stringify(all);
  }

  // ── OPFS storage kullanım bilgisi ────────────────────

  async function getStorageInfo() {
    try {
      const estimate = await navigator.storage.estimate();
      const index    = await readIndex();
      return {
        usedBytes:  estimate.usage  || 0,
        quotaBytes: estimate.quota  || 0,
        archivedDays: index.length,
        oldestDay:  index[index.length - 1] || null,
        newestDay:  index[0] || null,
      };
    } catch {
      return { usedBytes: 0, quotaBytes: 0, archivedDays: 0, oldestDay: null, newestDay: null };
    }
  }

  // ── Migration: eski activityLogs → OPFS ──────────────
  // Eski format: tek büyük array. Onları tarihe göre grupla ve OPFS'e taşı.

  async function migrateFromLegacy(legacyLogs) {
    if (!legacyLogs?.length) return;

    // Tarihe göre grupla
    const byDate = {};
    for (const log of legacyLogs) {
      // timestamp'den ISO tarih üret
      const dk = log.timestamp ? dateKey(new Date(log.timestamp)) : log.date;
      if (!byDate[dk]) byDate[dk] = [];
      byDate[dk].push(log);
    }

    const index = await readIndex();

    for (const [dk, logs] of Object.entries(byDate)) {
      const today = dateKey();
      if (dk === today) continue; // bugünkü loglar zaten today buffer'da

      if (!index.includes(dk)) {
        // Eğer bu gün için zaten OPFS'te dosya varsa mevcut ile birleştir
        const existing = await readDay(dk);
        const merged   = _dedupe([...existing, ...logs]);
        await writeDay(dk, merged);
        index.push(dk);
      }
    }

    // Index'i tarihe göre sırala (yeni → eski)
    index.sort((a, b) => b.localeCompare(a));
    await writeIndex(index);

    console.log(`[StorageManager] Migration tamamlandı: ${Object.keys(byDate).length} gün OPFS'e taşındı.`);
  }

  // ── Yardımcılar ──────────────────────────────────────

  function _parseJsonl(text) {
    return text.trim().split('\n')
      .filter(line => line.trim())
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  }

  function _dedupe(logs) {
    const seen = new Set();
    return logs.filter(l => {
      const key = `${l.timestamp}-${l.symbol}-${l.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return {
    readIndex,
    writeIndex,
    writeDay,
    readDay,
    readDays,
    readRecentDays,
    deleteDay,
    exportAllAsCSV,
    getStorageInfo,
    migrateFromLegacy,
  };
})();