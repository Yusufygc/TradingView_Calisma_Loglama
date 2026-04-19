// TradingView Logger — Toast Notification
// =========================================

function showToast(title, bodyHtml, durationMs = 7000) {
  const existing = document.getElementById('tv-logger-toast');
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.id = 'tv-logger-toast';

  const inner = document.createElement('div');
  Object.assign(inner.style, {
    position:   'fixed',
    top:        '70px',
    right:      '20px',
    maxWidth:   '340px',
    minWidth:   '290px',
    background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)',
    border:     '1px solid rgba(79,195,247,0.3)',
    borderRadius: '12px',
    padding:    '16px',
    boxShadow:  '0 8px 32px rgba(0,0,0,0.45)',
    zIndex:     '999999',
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    animation:  'tvl-slideIn 0.3s ease',
  });

  // Animasyon keyframe'i — sadece bir kez ekle
  if (!document.getElementById('tv-logger-style')) {
    const style = document.createElement('style');
    style.id = 'tv-logger-style';
    style.textContent = `
      @keyframes tvl-slideIn {
        from { transform: translateX(110%); opacity: 0; }
        to   { transform: translateX(0);   opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  // Başlık
  const titleEl = document.createElement('div');
  Object.assign(titleEl.style, {
    color: '#4fc3f7', fontWeight: '600', fontSize: '14px', marginBottom: '10px',
  });
  titleEl.textContent = title;

  // Gövde
  const bodyEl = document.createElement('div');
  Object.assign(bodyEl.style, { color: '#ddd', fontSize: '12px', lineHeight: '1.6' });
  bodyEl.innerHTML = bodyHtml; // Arayanın sorumluluğundaki güvenli HTML

  // Kapat butonu
  const closeBtn = document.createElement('button');
  Object.assign(closeBtn.style, {
    position:   'absolute', top: '8px', right: '8px',
    background: 'transparent', border: 'none',
    color: '#777', cursor: 'pointer', fontSize: '18px', lineHeight: '1', padding: '4px',
  });
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => wrap.remove());

  inner.appendChild(titleEl);
  inner.appendChild(bodyEl);
  inner.appendChild(closeBtn);
  wrap.appendChild(inner);
  document.body.appendChild(wrap);

  // Otomatik kapat
  setTimeout(() => {
    if (!wrap.parentElement) return;
    wrap.style.transition = 'opacity 0.3s';
    wrap.style.opacity    = '0';
    setTimeout(() => wrap.remove(), 320);
  }, durationMs);
}
