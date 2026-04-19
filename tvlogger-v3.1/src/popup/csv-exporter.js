// TradingView Logger — CSV Exporter
// ===================================
// Tüm export işlemleri bu modülden geçer.
//
// Encoding: UTF-16 LE + BOM (\xFF\xFE)
//   → Excel'in tüm versiyonlarında Türkçe karakterler (İ, Ö, Ü, Ş, Ğ, Ç) bozulmadan açılır
//   → UTF-8 BOM (eski yöntem) bazı Excel versiyonlarında ### ve karakter bozukluğu yaptı
//
// Delimiter: ; (noktalı virgül) — Türkçe Excel varsayılanı
// Sayısal fiyatlar: virgüllü ondalık (1.234,56) — Excel TR locale için sayısal hücre

const CSVExporter = (() => {

  // ── Ana export fonksiyonu ────────────────────────────────────────────────

  function exportLogs(logs, opts = {}) {
    if (!logs?.length) { alert('Dışa aktarilacak veri bulunamadi.'); return; }

    const sorted   = [...logs].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const filename = opts.filename || `tvlogger_${dateKey()}.csv`;

    const lines = [
      _buildMetaBlock(sorted, opts),
      '',
      _buildHeaderRow(),
      ...sorted.map(_buildDataRow),
      '',
      _buildSummaryBlock(sorted),
    ];

    _download(lines.join('\r\n'), filename);
  }

  // ── Meta blok ────────────────────────────────────────────────────────────

  function _buildMetaBlock(logs, opts) {
    const first = logs[0];
    const last  = logs[logs.length - 1];
    const uniq  = [...new Set(logs.map(l => l.symbol).filter(Boolean))];

    return [
      `sep=;`,
      `Rapor Adi;TradingView Logger - Aktivite Raporu`,
      `Olusturma Tarihi;${_now()}`,
      `Kapsam;${opts.dateRange || `${first?.date || '-'}  -  ${last?.date || '-'}`}`,
      `Toplam Kayit;${logs.length}`,
      `Takip Edilen Hisseler;${uniq.length} hisse: ${uniq.slice(0, 10).join(', ')}${uniq.length > 10 ? ` ve ${uniq.length - 10} hisse daha` : ''}`,
      `Toplam Inceleme Suresi;${formatDuration(logs.reduce((s, l) => s + (l.sessionMs || 0), 0))}`,
    ].join('\r\n');
  }

  // ── Başlık satırı ─────────────────────────────────────────────────────────

  function _buildHeaderRow() {
    return [
      'Tarih',
      'Saat',
      'Hisse Senedi',
      'Islem',
      'Fiyat (TL)',
      'Inceleme Suresi',
      'Onceki Hisse',
      'Yeni Hisse',
      'Not',
    ].join(';');
  }

  // ── Veri satırı ───────────────────────────────────────────────────────────

  function _buildDataRow(log) {
    const details = log.details || {};

    const price    = _numericPrice(log.price);
    const duration = (log.sessionMs && log.sessionMs > 1000)
      ? formatDuration(log.sessionMs) : '-';

    let prevSymbol = '-';
    let nextSymbol = '-';
    let notes      = '-';

    if (log.action === ACTIONS.CHANGED) {
      prevSymbol = details.eski  || '-';
      nextSymbol = details.yeni  || '-';
    } else if (log.action === ACTIONS.STARTED) {
      nextSymbol = details.sembol || log.symbol || '-';
      notes      = 'Oturum baslangici';
    } else if (log.action === ACTIONS.CLOSED) {
      prevSymbol = details.sembol || log.symbol || '-';
      notes      = 'Oturum sonu';
    }

    // Aksiyon metni ASCII'ye indir (Türkçe harf içermez ama güvenlik için)
    const actionAscii = _toAscii(log.action || '-');

    return [
      _formatDate(log.date),
      log.time    || '-',
      log.symbol  || '-',
      actionAscii,
      price,
      duration,
      prevSymbol,
      nextSymbol,
      notes,
    ].map(_cell).join(';');
  }

  // ── Özet blok ────────────────────────────────────────────────────────────

  function _buildSummaryBlock(logs) {
    const bySymbol = {};
    for (const l of logs) {
      if (!l.symbol || l.symbol === 'Bilinmiyor') continue;
      if (!bySymbol[l.symbol]) bySymbol[l.symbol] = { count: 0, totalMs: 0, prices: [] };
      bySymbol[l.symbol].count++;
      bySymbol[l.symbol].totalMs += (l.sessionMs || 0);
      if (l.price && l.price !== '-') bySymbol[l.symbol].prices.push(l.price);
    }

    const ranked = Object.entries(bySymbol).sort((a, b) => b[1].totalMs - a[1].totalMs);

    return [
      ``,
      `;;; HISSE BAZINDA OZET`,
      `Hisse Senedi;Toplam Log;Toplam Inceleme;Ilk Fiyat (TL);Son Fiyat (TL)`,
      ...ranked.map(([sym, data]) => {
        const prices = data.prices;
        const firstP = prices.length ? _numericPrice(prices[0])               : '-';
        const lastP  = prices.length ? _numericPrice(prices[prices.length - 1]) : '-';
        return [sym, data.count, formatDuration(data.totalMs), firstP, lastP]
          .map(_cell).join(';');
      }),
    ].join('\r\n');
  }

  // ── Download — UTF-16 LE ──────────────────────────────────────────────────
  // UTF-16 LE + BOM: Excel'in tüm versiyonlarında Türkçe bozulmaz

  function _download(content, filename) {
    // UTF-16 LE encoding: her karakter 2 byte
    const utf16 = _encodeUtf16LE(content);

    // BOM: \xFF\xFE (UTF-16 LE işareti)
    const bom  = new Uint8Array([0xFF, 0xFE]);
    const blob = new Blob([bom, utf16], { type: 'text/csv;charset=utf-16le;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function _encodeUtf16LE(str) {
    // TextEncoder UTF-16 LE'yi doğrudan desteklemiyor
    // Manuel encode: her JS char code 2 byte Little Endian
    const buf  = new ArrayBuffer(str.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < str.length; i++) {
      view.setUint16(i * 2, str.charCodeAt(i), true); // true = little endian
    }
    return buf;
  }

  // ── Yardımcılar ───────────────────────────────────────────────────────────

  function _cell(val) {
    if (val === null || val === undefined) return '-';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function _formatDate(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
    try {
      const d = new Date(dateStr);
      if (!isNaN(d)) {
        return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
      }
    } catch (_) {}
    return dateStr;
  }

  function _numericPrice(raw) {
    if (!raw || raw === '-') return '-';
    const n = normalizePrice(raw);
    if (n === null || isNaN(n)) return String(raw).replace('.', ',');
    // Virgüllü Türkçe format — Excel TR locale sayısal hücre olarak tanır
    return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Türkçe özel harfleri ASCII'ye çevir (aksiyon metni vs.)
  function _toAscii(str) {
    return str
      .replace(/İ/g, 'I').replace(/ı/g, 'i')
      .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
      .replace(/Ü/g, 'U').replace(/ü/g, 'u')
      .replace(/Ş/g, 'S').replace(/ş/g, 's')
      .replace(/Ö/g, 'O').replace(/ö/g, 'o')
      .replace(/Ç/g, 'C').replace(/ç/g, 'c')
      .replace(/—/g, '-').replace(/–/g, '-')
      .replace(/₺/g, 'TL');
  }

  function _now() {
    return new Date().toLocaleString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return {

    fromLogsModule(logs, dateRange) {
      exportLogs(logs, {
        filename:  `tvlogger_loglar_${dateKey()}.csv`,
        dateRange,
      });
    },

    fromDay(day, logs) {
      const [y, m, d] = day.split('-');
      exportLogs(logs, {
        filename:  `tvlogger_${day}.csv`,
        dateRange: `${d}.${m}.${y}`,
      });
    },

    fromArchiveString(jsonRaw) {
      let logs = [];
      try {
        logs = JSON.parse(jsonRaw);
      } catch {
        const lines = jsonRaw.trim().split('\n').slice(1);
        logs = lines.map(line => {
          const p = line.split(';');
          return { date: p[0]||'', time: p[1]||'', symbol: p[2]||'',
                   action: p[3]||'', price: p[4]||'', sessionMs: parseInt(p[5])||0, details: {} };
        }).filter(l => l.symbol);
      }
      exportLogs(logs, {
        filename: `tvlogger_tam_arsiv_${dateKey()}.csv`,
      });
    },
  };

})();