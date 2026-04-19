// TradingView Logger — Notes + Tags Module
// ==========================================

const NotesModule = (() => {
  let allNotes     = {};
  let allTags      = {}; // { PGSUS: ['buy','watchlist'], ... }
  let activeTagFilter = null; // null = hepsi

  // ── Yükleme ───────────────────────────────────────────

  async function load() {
    const res = await chrome.storage.local.get([STORAGE_KEYS.NOTES, STORAGE_KEYS.TAGS]);
    allNotes  = res[STORAGE_KEYS.NOTES] || {};
    allTags   = res[STORAGE_KEYS.TAGS]  || {};
    renderTagFilterBar();
    renderNotes(document.getElementById('noteSearch').value);
  }

  // ── Etiket filtre çubuğu ─────────────────────────────

  function renderTagFilterBar() {
    const bar = document.getElementById('tagFilterBar');
    if (!bar) return;

    // Hangi etiketler kullanılıyor?
    const usedTagIds = new Set(Object.values(allTags).flat());

    bar.innerHTML = `
      <button class="tag-filter-btn ${activeTagFilter === null ? 'active' : ''}" data-tag="">Tümü</button>
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
        renderNotes(document.getElementById('noteSearch').value);
      });
    });
  }

  // ── Not listesi render ───────────────────────────────

  function renderNotes(query) {
    const container = document.getElementById('allNotesContainer');

    let entries = Object.entries(allNotes);

    // Etiket filtresi
    if (activeTagFilter) {
      entries = entries.filter(([sym]) => (allTags[sym] || []).includes(activeTagFilter));
    }

    // Metin arama
    if (query) {
      const q = query.toLowerCase();
      entries = entries.filter(([sym, data]) =>
        sym.toLowerCase().includes(q) || data.note.toLowerCase().includes(q)
      );
    }

    // Sırala: en son güncellenen önce
    entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));

    if (entries.length === 0) {
      container.innerHTML = `<p class="empty-state">${
        query || activeTagFilter ? 'Eşleşen not bulunamadı.' : 'Henüz not yok.'
      }</p>`;
      return;
    }

    container.innerHTML = entries.map(([sym, data]) => {
      const dateStr  = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString('tr-TR') : '';
      const symHtml  = highlightMatch(sym, query, false);
      const noteHtml = highlightMatch(data.note, query, false);
      const symTags  = (allTags[sym] || []).map(id => {
        const def = PREDEFINED_TAGS.find(t => t.id === id);
        return def ? `<span class="note-tag-chip" style="--tag-color:${def.color}">${def.label}</span>` : '';
      }).join('');

      return `
        <div class="note-card" data-symbol="${escapeHtml(sym)}">
          <div class="note-card-header">
            <span class="note-card-symbol">${symHtml}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="note-card-date">${dateStr}</span>
              <div class="note-actions">
                <button class="btn-icon edit-note-btn"   data-symbol="${escapeHtml(sym)}" title="Düzenle">✏️</button>
                <button class="btn-icon btn-icon-danger delete-note-btn" data-symbol="${escapeHtml(sym)}" title="Sil">🗑️</button>
              </div>
            </div>
          </div>
          ${symTags ? `<div class="note-tag-chips">${symTags}</div>` : ''}
          <div class="note-card-text">${noteHtml}</div>
        </div>`;
    }).join('');

    _bindNoteCardEvents(container);
  }

  function _bindNoteCardEvents(container) {
    container.querySelectorAll('.delete-note-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const sym = e.currentTarget.dataset.symbol;
        if (!confirm(`"${sym}" notunu sil?`)) return;
        delete allNotes[sym];
        await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: allNotes });
        renderNotes(document.getElementById('noteSearch').value);
        if (window._currentSymbol === sym) refreshCurrentNote();
      });
    });

    container.querySelectorAll('.edit-note-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sym     = e.currentTarget.dataset.symbol;
        const curVal  = document.getElementById('noteInput').value.trim();
        const isEdit  = document.getElementById('noteBadge').textContent.includes('Düzenleniyor');
        if (isEdit && curVal && window._currentSymbol !== sym) {
          if (!confirm(`"${window._currentSymbol}" için kaydedilmemiş değişiklik var. Devam edilsin mi?`)) return;
        }
        setActiveSymbol(sym);
      });
    });
  }

  // ── Aktif sembol set ─────────────────────────────────

  function setActiveSymbol(sym) {
    window._currentSymbol = sym;
    const symEl = document.getElementById('currentSymbol');
    if (symEl) symEl.textContent = sym || '--';
    refreshCurrentNote();
    renderTagEditor(sym);
    // Notlar sekmesine geç (sadece notes tabı zaten aktif değilse)
    document.querySelector('[data-tab="notes"]')?.click();
  }

  function refreshCurrentNote() {
    const sym   = window._currentSymbol;
    const badge = document.getElementById('noteBadge');
    const input = document.getElementById('noteInput');
    // Null guard — pinned window veya beklenmedik DOM durumunda güvenli ol
    if (!badge || !input) return;
    if (!sym) {
      badge.textContent = ''; badge.classList.remove('has-note'); input.value = '';
      return;
    }
    if (allNotes[sym]) {
      badge.textContent = '✓ Not Var'; badge.classList.add('has-note');
      input.value = allNotes[sym].note;
    } else {
      badge.textContent = ''; badge.classList.remove('has-note');
      input.value = '';
    }
    renderTagEditor(sym);
  }

  // ── Tag editörü ──────────────────────────────────────

  function renderTagEditor(sym) {
    const wrap = document.getElementById('tagEditorWrap');
    if (!wrap || !sym) { if (wrap) wrap.innerHTML = ''; return; }

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
        else            allTags[sym].splice(idx, 1);
        await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: allTags });
        renderTagEditor(sym);
        renderTagFilterBar();
        renderNotes(document.getElementById('noteSearch').value);
      });
    });
  }

  // ── Kaydet / Sil ─────────────────────────────────────

  async function save() {
    const sym  = window._currentSymbol;
    const text = document.getElementById('noteInput').value.trim();
    if (!sym) return;

    if (text) allNotes[sym] = { note: text, updatedAt: Date.now() };
    else      delete allNotes[sym];

    await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: allNotes });
    renderNotes(document.getElementById('noteSearch').value);
    refreshCurrentNote();

    const btn  = document.getElementById('saveNote');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Kaydedildi';
      setTimeout(() => { const b = document.getElementById('saveNote'); if (b) b.textContent = orig; }, 1500);
    }
  }

  async function clearNote() {
    const sym = window._currentSymbol;
    if (!sym) return;
    if (document.getElementById('noteInput').value && !confirm(`"${sym}" notunu temizle?`)) return;
    document.getElementById('noteInput').value = '';
    delete allNotes[sym];
    await chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: allNotes });
    renderNotes(document.getElementById('noteSearch').value);
    refreshCurrentNote();
  }

  return { load, renderNotes, setActiveSymbol, refreshCurrentNote, save, clearNote };
})();