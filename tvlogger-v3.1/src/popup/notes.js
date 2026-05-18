// TradingView Logger - Notes + Tags Module
// =========================================

const NotesModule = (() => {
  let allNotes = {};
  let allTags = {}; // { PGSUS: ['buy','watchlist'], ... }
  let activeTagFilter = null;
  let editingNoteRef = null; // { symbol, id } | null

  function normalizeNoteStore(notes) {
    const normalized = {};

    Object.entries(notes || {}).forEach(([sym, value]) => {
      const rawList = Array.isArray(value) ? value : (value ? [value] : []);
      const list = rawList
        .map(item => {
          const note = String(item?.note ?? item?.text ?? '').trim();
          if (!note) return null;

          const updatedAt = Number(item?.updatedAt || item?.createdAt || Date.now());
          const normalizedNote = {
            id: String(item?.id || `${updatedAt}-${Math.random().toString(36).slice(2, 8)}`),
            note,
            createdAt: Number(item?.createdAt || updatedAt),
            updatedAt,
          };

          if (hasStoredPrice(item)) {
            normalizedNote.priceAtNote = String(item?.priceAtNote || '').trim();
            normalizedNote.priceAtNoteNumber = normalizeStoredPrice(item);
          }

          return normalizedNote;
        })
        .filter(Boolean);

      if (list.length) normalized[sym] = list;
    });

    return normalized;
  }

  function getSymbolNotes(sym) {
    return Array.isArray(allNotes[sym]) ? allNotes[sym] : [];
  }

  function hasStoredPrice(item) {
    return Boolean(
      String(item?.priceAtNote || '').trim() ||
      (item?.priceAtNoteNumber !== null && item?.priceAtNoteNumber !== undefined && item?.priceAtNoteNumber !== '')
    );
  }

  function normalizeStoredPrice(item) {
    const hasDirect = item?.priceAtNoteNumber !== null && item?.priceAtNoteNumber !== undefined && item?.priceAtNoteNumber !== '';
    const direct = Number(item?.priceAtNoteNumber);
    if (hasDirect && Number.isFinite(direct)) return direct;
    const parsed = normalizePrice(item?.priceAtNote);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getLivePriceSnapshot() {
    const priceText = document.getElementById('livePrice')?.textContent.trim() || '';
    const priceNumber = normalizePrice(priceText);
    return {
      priceAtNote: priceText,
      priceAtNoteNumber: Number.isFinite(priceNumber) ? priceNumber : null,
    };
  }

  function getCurrentPriceForSymbol(sym) {
    const liveSymbol = document.getElementById('liveSymbol')?.textContent.trim();
    if (!sym || liveSymbol !== sym) return { text: '', number: null };

    const text = document.getElementById('livePrice')?.textContent.trim() || '';
    const number = normalizePrice(text);
    return { text, number: Number.isFinite(number) ? number : null };
  }

  function renderNotePerformance(sym, note) {
    if (!note.priceAtNote || !Number.isFinite(note.priceAtNoteNumber)) {
      return '<div class="note-performance muted">Fiyat kaydi yok</div>';
    }

    const current = getCurrentPriceForSymbol(sym);
    if (!current.text || !Number.isFinite(current.number)) {
      return `
        <div class="note-performance muted">
          <span>Yorum fiyati: ${escapeHtml(note.priceAtNote)}</span>
          <span>Simdi: -</span>
        </div>`;
    }

    const diffPct = note.priceAtNoteNumber > 0
      ? ((current.number - note.priceAtNoteNumber) / note.priceAtNoteNumber) * 100
      : 0;
    const state = Math.abs(diffPct) < 0.01 ? 'flat' : (diffPct > 0 ? 'up' : 'down');
    const sign = diffPct > 0 ? '+' : '';

    return `
      <div class="note-performance">
        <span>Yorum fiyati: ${escapeHtml(note.priceAtNote)}</span>
        <span>Simdi: ${escapeHtml(current.text)}</span>
        <strong class="note-performance-change ${state}">${sign}%${diffPct.toFixed(2)}</strong>
      </div>`;
  }

  function formatDetailDate(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function renderDetailTags(sym) {
    const tags = allTags[sym] || [];
    if (!tags.length) return '<span class="stock-detail-muted">Etiket yok</span>';

    return tags.map(id => {
      const def = PREDEFINED_TAGS.find(t => t.id === id);
      if (!def) return `<span class="note-tag-chip">${escapeHtml(id)}</span>`;
      return `<span class="note-tag-chip" style="--tag-color:${def.color}">${def.label}</span>`;
    }).join('');
  }

  function getRecentLogsForSymbol(logs, sym) {
    return (logs || [])
      .filter(log => log.symbol === sym || log.details?.sembol === sym || log.details?.yeni === sym)
      .slice(-5)
      .reverse();
  }

  function renderDetailLogs(logs) {
    if (!logs.length) return '<p class="stock-detail-empty">Bugun log yok.</p>';

    return logs.map(log => `
      <div class="stock-detail-log">
        <span>${escapeHtml(log.time || '-')}</span>
        <strong>${escapeHtml(log.action || '-')}</strong>
        <em>${escapeHtml(log.price || log.details?.fiyat || '-')}</em>
      </div>
    `).join('');
  }

  function renderDetailNotes(sym) {
    const notes = getSymbolNotes(sym);
    if (!notes.length) return '<p class="stock-detail-empty">Yorum yok.</p>';

    return notes
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map(note => `
        <div class="stock-detail-note">
          <div class="stock-detail-note-date">${formatDetailDate(note.updatedAt)}</div>
          ${renderNotePerformance(sym, note)}
          <div>${escapeHtml(note.note)}</div>
        </div>
      `).join('');
  }

  async function openStockDetail(sym) {
    const res = await chrome.storage.local.get([
      STORAGE_KEYS.TIME_LOG,
      STORAGE_KEYS.LAST_VIEWS,
      STORAGE_KEYS.TODAY,
    ]);
    const timeLog = res[STORAGE_KEYS.TIME_LOG] || {};
    const lastViews = res[STORAGE_KEYS.LAST_VIEWS] || {};
    const todayLogs = res[STORAGE_KEYS.TODAY] || [];
    const symbolTime = timeLog[sym] || {};
    const lastView = lastViews[sym] || null;
    const logs = getRecentLogsForSymbol(todayLogs, sym);

    closeStockDetail();

    const overlay = document.createElement('div');
    overlay.className = 'stock-detail-overlay';
    overlay.innerHTML = `
      <div class="stock-detail-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(sym)} detay">
        <div class="stock-detail-header">
          <div>
            <div class="stock-detail-symbol">${escapeHtml(sym)}</div>
            <div class="stock-detail-subtitle">${getSymbolNotes(sym).length} yorum</div>
          </div>
          <button class="stock-detail-close" type="button" aria-label="Kapat">×</button>
        </div>
        <div class="stock-detail-grid">
          <div class="stock-detail-stat">
            <span>Toplam sure</span>
            <strong>${formatDuration(symbolTime.totalMs || 0)}</strong>
          </div>
          <div class="stock-detail-stat">
            <span>Seans</span>
            <strong>${symbolTime.sessions || 0}</strong>
          </div>
          <div class="stock-detail-stat">
            <span>Son fiyat</span>
            <strong>${escapeHtml(lastView?.price || '-')}</strong>
          </div>
        </div>
        <div class="stock-detail-section">
          <h3>Son goruntuleme</h3>
          <p>${lastView ? formatDetailDate(lastView.date) : '-'}</p>
        </div>
        <div class="stock-detail-section">
          <h3>Etiketler</h3>
          <div class="note-tag-chips">${renderDetailTags(sym)}</div>
        </div>
        <div class="stock-detail-section">
          <h3>Yorumlar</h3>
          ${renderDetailNotes(sym)}
        </div>
        <div class="stock-detail-section">
          <h3>Bugunku son loglar</h3>
          ${renderDetailLogs(logs)}
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target.closest('.stock-detail-close')) closeStockDetail();
    });
  }

  function closeStockDetail() {
    document.querySelector('.stock-detail-overlay')?.remove();
  }

  function makeNoteId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function clearEditingState() {
    editingNoteRef = null;
    document.getElementById('noteBadge')?.classList.remove('editing-note');
  }

  async function persistNotes() {
    await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: allNotes });
  }

  async function load() {
    const res = await chrome.storage.local.get([STORAGE_KEYS.NOTES, STORAGE_KEYS.TAGS]);
    const storedNotes = res[STORAGE_KEYS.NOTES] || {};
    allNotes = normalizeNoteStore(storedNotes);
    allTags = res[STORAGE_KEYS.TAGS] || {};

    if (JSON.stringify(allNotes) !== JSON.stringify(storedNotes)) {
      await persistNotes();
    }

    renderTagFilterBar();
    renderNotes(document.getElementById('noteSearch')?.value || '');
  }

  function renderTagFilterBar() {
    const bar = document.getElementById('tagFilterBar');
    if (!bar) return;

    const usedTagIds = new Set(
      Object.keys(allNotes)
        .filter(sym => getSymbolNotes(sym).length)
        .flatMap(sym => allTags[sym] || [])
    );

    bar.innerHTML = `
      <button class="tag-filter-btn ${activeTagFilter === null ? 'active' : ''}" data-tag="">Tumu</button>
      ${PREDEFINED_TAGS.filter(t => usedTagIds.has(t.id)).map(t => `
        <button class="tag-filter-btn ${activeTagFilter === t.id ? 'active' : ''}"
                data-tag="${t.id}"
                style="--tag-color:${t.color}">
          ${t.label}
        </button>
      `).join('')}
    `;

    bar.querySelectorAll('.tag-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTagFilter = btn.dataset.tag || null;
        bar.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderNotes(document.getElementById('noteSearch')?.value || '');
      });
    });
  }

  function renderNotes(query = '') {
    const container = document.getElementById('allNotesContainer');
    if (!container) return;

    let entries = Object.entries(allNotes).flatMap(([sym, notes]) =>
      getSymbolNotes(sym).map(note => [sym, note])
    );

    if (activeTagFilter) {
      entries = entries.filter(([sym]) => (allTags[sym] || []).includes(activeTagFilter));
    }

    if (query) {
      const q = query.toLowerCase();
      entries = entries.filter(([sym, data]) =>
        sym.toLowerCase().includes(q) || data.note.toLowerCase().includes(q)
      );
    }

    entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));

    if (entries.length === 0) {
      container.innerHTML = `<p class="empty-state">${
        query || activeTagFilter ? 'Eslesen not bulunamadi.' : 'Henuz not yok.'
      }</p>`;
      return;
    }

    container.innerHTML = entries.map(([sym, data]) => {
      const dateStr = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString('tr-TR') : '';
      const symHtml = highlightMatch(sym, query, false);
      const noteHtml = highlightMatch(data.note, query, false);
      const symTags = (allTags[sym] || []).map(id => {
        const def = PREDEFINED_TAGS.find(t => t.id === id);
        return def ? `<span class="note-tag-chip" style="--tag-color:${def.color}">${def.label}</span>` : '';
      }).join('');

      return `
        <div class="note-card" data-symbol="${escapeHtml(sym)}" data-note-id="${escapeHtml(data.id)}">
          <div class="note-card-header">
            <button class="note-card-symbol note-symbol-detail-btn" type="button" data-symbol="${escapeHtml(sym)}" title="Hisse detayini ac">${symHtml}</button>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="note-card-date">${dateStr}</span>
              <div class="note-actions">
                <button class="btn-icon edit-note-btn" data-symbol="${escapeHtml(sym)}" data-note-id="${escapeHtml(data.id)}" title="Duzenle" aria-label="Duzenle">✏️</button>
                <button class="btn-icon btn-icon-danger delete-note-btn" data-symbol="${escapeHtml(sym)}" data-note-id="${escapeHtml(data.id)}" title="Sil" aria-label="Sil">🗑️</button>
              </div>
            </div>
          </div>
          ${symTags ? `<div class="note-tag-chips">${symTags}</div>` : ''}
          ${renderNotePerformance(sym, data)}
          <div class="note-card-text">${noteHtml}</div>
        </div>`;
    }).join('');

    bindNoteCardEvents(container);
  }

  function bindNoteCardEvents(container) {
    container.querySelectorAll('.delete-note-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        const sym = e.currentTarget.dataset.symbol;
        const noteId = e.currentTarget.dataset.noteId;
        if (!confirm(`"${sym}" notunu sil?`)) return;

        allNotes[sym] = getSymbolNotes(sym).filter(n => n.id !== noteId);
        if (!allNotes[sym].length) delete allNotes[sym];

        if (editingNoteRef?.symbol === sym && editingNoteRef?.id === noteId) {
          document.getElementById('noteInput').value = '';
          clearEditingState();
        }

        await persistNotes();
        renderNotes(document.getElementById('noteSearch')?.value || '');
        renderTagFilterBar();
        if (window._currentSymbol === sym) refreshCurrentNote();
      });
    });

    container.querySelectorAll('.note-symbol-detail-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        openStockDetail(e.currentTarget.dataset.symbol);
      });
    });

    container.querySelectorAll('.edit-note-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const sym = e.currentTarget.dataset.symbol;
        const noteId = e.currentTarget.dataset.noteId;
        const curVal = document.getElementById('noteInput')?.value.trim();
        if (editingNoteRef && curVal && (editingNoteRef.symbol !== sym || editingNoteRef.id !== noteId)) {
          if (!confirm(`"${window._currentSymbol}" icin kaydedilmemis degisiklik var. Devam edilsin mi?`)) return;
        }
        setActiveSymbol(sym, noteId);
      });
    });
  }

  function setActiveSymbol(sym, noteId = null) {
    window._currentSymbol = sym;
    const symEl = document.getElementById('currentSymbol');
    if (symEl) symEl.textContent = sym || '--';

    const input = document.getElementById('noteInput');
    if (noteId) {
      editingNoteRef = { symbol: sym, id: noteId };
      const note = getSymbolNotes(sym).find(n => n.id === noteId);
      if (input) input.value = note?.note || '';
    } else {
      clearEditingState();
      if (input) input.value = '';
    }

    refreshCurrentNote({ preserveInput: Boolean(noteId) });
    renderTagEditor(sym);
    document.querySelector('[data-tab="notes"]')?.click();
  }

  function refreshCurrentNote(options = {}) {
    const sym = window._currentSymbol;
    const badge = document.getElementById('noteBadge');
    const input = document.getElementById('noteInput');
    if (!badge || !input) return;

    if (!sym) {
      badge.textContent = '';
      badge.classList.remove('has-note');
      input.value = '';
      clearEditingState();
      return;
    }

    const noteCount = getSymbolNotes(sym).length;
    if (editingNoteRef?.symbol === sym) {
      badge.textContent = 'Duzenleniyor';
      badge.classList.add('has-note');
    } else if (noteCount > 0) {
      badge.textContent = `${noteCount} Not Var`;
      badge.classList.add('has-note');
      if (!options.preserveInput) input.value = '';
    } else {
      badge.textContent = '';
      badge.classList.remove('has-note');
      if (!options.preserveInput) input.value = '';
    }

    renderTagEditor(sym);
  }

  function renderTagEditor(sym) {
    const wrap = document.getElementById('tagEditorWrap');
    if (!wrap || !sym) {
      if (wrap) wrap.innerHTML = '';
      return;
    }

    const symTags = allTags[sym] || [];
    wrap.innerHTML = `
      <div class="tag-editor-label">Etiketler:</div>
      <div class="tag-editor-chips">
        ${PREDEFINED_TAGS.map(t => `
          <button class="tag-chip ${symTags.includes(t.id) ? 'active' : ''}"
                  data-tag-id="${t.id}"
                  style="--tag-color:${t.color}">
            ${t.label}
          </button>
        `).join('')}
      </div>
    `;

    wrap.querySelectorAll('.tag-chip').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tagId = btn.dataset.tagId;
        if (!allTags[sym]) allTags[sym] = [];
        const idx = allTags[sym].indexOf(tagId);
        if (idx === -1) allTags[sym].push(tagId);
        else allTags[sym].splice(idx, 1);

        await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: allTags });
        renderTagEditor(sym);
        renderTagFilterBar();
        renderNotes(document.getElementById('noteSearch')?.value || '');
      });
    });
  }

  async function save() {
    const sym = window._currentSymbol;
    const input = document.getElementById('noteInput');
    const text = input?.value.trim() || '';
    if (!sym || !text) return;

    const updatedAt = Date.now();
    const list = getSymbolNotes(sym);
    const priceSnapshot = getLivePriceSnapshot();

    if (editingNoteRef?.symbol === sym) {
      const idx = list.findIndex(n => n.id === editingNoteRef.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], note: text, updatedAt };
      } else {
        list.unshift({ id: makeNoteId(), note: text, createdAt: updatedAt, updatedAt, ...priceSnapshot });
      }
    } else {
      list.unshift({ id: makeNoteId(), note: text, createdAt: updatedAt, updatedAt, ...priceSnapshot });
    }

    allNotes[sym] = list;
    await persistNotes();

    const livePrice = document.getElementById('livePrice')?.textContent.trim() || '';
    chrome.runtime.sendMessage({
      type: 'TELEGRAM_NOTE_UPDATED',
      note: { symbol: sym, text, price: livePrice, updatedAt },
    });

    input.value = '';
    clearEditingState();
    renderNotes(document.getElementById('noteSearch')?.value || '');
    renderTagFilterBar();
    refreshCurrentNote();

    const btn = document.getElementById('saveNote');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Kaydedildi';
      setTimeout(() => {
        const b = document.getElementById('saveNote');
        if (b) b.textContent = orig;
      }, 1500);
    }
  }

  async function clearNote() {
    if (!window._currentSymbol) return;
    const input = document.getElementById('noteInput');
    if (input) input.value = '';
    clearEditingState();
    refreshCurrentNote();
  }

  return { load, renderNotes, setActiveSymbol, refreshCurrentNote, save, clearNote };
})();
