// ============================================================
//  LEVEL UP – App shell
//  · Swipe kiri/kanan untuk pindah tab (dengan animasi)
//  · Tombol "Pasang di HP" (Add to Home Screen) + service worker
//  Dipakai oleh halaman yang punya .tab-nav .tab-btn & .tab-page
//  dengan onclick="showTab('nama', this)".
// ============================================================
(() => {
  // ── CSS ────────────────────────────────────────────────────
  const st = document.createElement('style');
  st.textContent = `
  main{overflow-x:clip}
  .tab-page.anim-l{animation:luTabInL .3s cubic-bezier(.2,.8,.3,1)}
  .tab-page.anim-r{animation:luTabInR .3s cubic-bezier(.2,.8,.3,1)}
  @keyframes luTabInL{from{opacity:0;transform:translateX(48px)}to{opacity:1;transform:none}}
  @keyframes luTabInR{from{opacity:0;transform:translateX(-48px)}to{opacity:1;transform:none}}
  .tab-page.following{transition:none}
  .tab-page.snapback{transition:transform .22s ease,opacity .22s ease}
  .tab-dots{display:none;justify-content:center;gap:6px;padding:8px 0 0}
  .tab-dots i{width:6px;height:6px;border-radius:999px;background:#F0E4E8;transition:all .25s}
  .tab-dots i.on{width:18px;background:#E891A5}
  @media (max-width:760px){.tab-dots{display:flex}}
  #luInstallBtn{display:none;background:#EAF8F0;border:1.5px solid #BFE6D2;color:#3E8A65;border-radius:999px;padding:5px 12px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;font-family:inherit}
  #luIosTip{position:fixed;left:12px;right:12px;bottom:16px;z-index:9998;background:#443E52;color:#fff;border-radius:18px;padding:16px 18px;font-size:13.5px;font-weight:700;line-height:1.6;box-shadow:0 10px 30px rgba(0,0,0,.25);display:none}
  #luIosTip b{color:#FFE3A3}
  #luIosTip button{position:absolute;top:8px;right:12px;background:none;border:none;color:#fff;font-size:18px;cursor:pointer}
  @media (display-mode: standalone){ #luInstallBtn{display:none!important} }
  `;
  document.head.appendChild(st);

  const tabBtns = () => [...document.querySelectorAll('.tab-nav .tab-btn')].filter(b => b.offsetParent !== null || b.classList.contains('active'));
  const activeIdx = () => tabBtns().findIndex(b => b.classList.contains('active'));

  // ── Animasi saat ganti tab (klik maupun swipe) ─────────────
  function wrapShowTab() {
    if (typeof window.showTab !== 'function' || window.showTab._wrapped) return;
    const orig = window.showTab;
    window.showTab = function (name, btn) {
      const before = activeIdx();
      const r = orig.apply(this, arguments);
      const after = activeIdx();
      const page = document.getElementById('tab-' + name);
      if (page && before !== after) {
        page.classList.remove('anim-l', 'anim-r', 'following', 'snapback');
        page.style.transform = ''; page.style.opacity = '';
        void page.offsetWidth;
        page.classList.add(after > before ? 'anim-l' : 'anim-r');
        page.addEventListener('animationend', () => page.classList.remove('anim-l', 'anim-r'), { once: true });
      }
      const b = btn || tabBtns()[after];
      if (b && b.scrollIntoView) b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      updateDots();
      return r;
    };
    window.showTab._wrapped = true;
  }

  // ── Indikator titik (HP) ───────────────────────────────────
  let dots;
  function updateDots() {
    const nav = document.querySelector('.tab-nav');
    if (!nav) return;
    const btns = tabBtns();
    if (!dots) { dots = document.createElement('div'); dots.className = 'tab-dots'; nav.after(dots); }
    const a = activeIdx();
    dots.innerHTML = btns.map((_, i) => `<i class="${i === a ? 'on' : ''}"></i>`).join('');
  }

  // ── Swipe ──────────────────────────────────────────────────
  function blocked(target) {
    if (document.querySelector('.modal-bg.open')) return true;
    if (document.body.classList.contains('tt-dragging')) return true;
    if (target.closest('input,textarea,select,button,[data-noswipe],.tt-scroll,.wa-preview')) return true;
    // elemen yang bisa di-scroll menyamping (tabel lebar) → biarkan scroll
    for (let el = target; el && el !== document.body; el = el.parentElement) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 2) return true;
    }
    return false;
  }

  function initSwipe() {
    const main = document.querySelector('main');
    if (!main || !document.querySelector('.tab-nav')) return;
    let x0, y0, t0, tracking = false, horiz = null, page = null;

    main.addEventListener('touchstart', e => {
      if (e.touches.length !== 1 || blocked(e.target)) { tracking = false; return; }
      const t = e.touches[0];
      x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); tracking = true; horiz = null;
      page = document.querySelector('.tab-page.active');
    }, { passive: true });

    main.addEventListener('touchmove', e => {
      if (!tracking) return;
      const t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (horiz === null && Math.abs(dx) + Math.abs(dy) > 10) horiz = Math.abs(dx) > Math.abs(dy) * 1.4;
      if (!horiz || !page) return;
      const i = activeIdx(), n = tabBtns().length;
      const edge = (dx > 0 && i === 0) || (dx < 0 && i === n - 1);
      const pull = edge ? dx * 0.15 : dx * 0.45;
      page.classList.add('following');
      page.style.transform = `translateX(${pull}px)`;
      page.style.opacity = String(1 - Math.min(0.35, Math.abs(pull) / 600));
    }, { passive: true });

    const finish = e => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0, dt = Date.now() - t0;
      const swipe = horiz && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && (dt < 700 || Math.abs(dx) > 140);
      const btns = tabBtns(), i = activeIdx();
      const next = swipe ? (dx < 0 ? btns[i + 1] : btns[i - 1]) : null;
      if (page) {
        page.classList.remove('following');
        if (next) { page.style.transform = ''; page.style.opacity = ''; }
        else {
          page.classList.add('snapback');
          page.style.transform = ''; page.style.opacity = '';
          setTimeout(() => page && page.classList.remove('snapback'), 240);
        }
      }
      if (next) next.click();
    };
    main.addEventListener('touchend', finish, { passive: true });
    main.addEventListener('touchcancel', finish, { passive: true });
  }

  // ── PWA: Add to Home Screen ────────────────────────────────
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferred = null;

  function initInstall() {
    const header = document.querySelector('.app-header');
    if (!header || isStandalone()) return;
    const btn = document.createElement('button');
    btn.id = 'luInstallBtn'; btn.type = 'button'; btn.textContent = '📲 Pasang di HP';
    const badge = header.querySelector('.header-badge');
    if (badge) badge.before(btn); else header.appendChild(btn);

    const tip = document.createElement('div');
    tip.id = 'luIosTip';
    tip.innerHTML = `<button type="button" aria-label="Tutup">✕</button>
      📲 <b>Pasang Level Up di iPhone/iPad</b><br>
      1. Tap tombol <b>Share</b> (kotak dengan panah ke atas ⬆️) di Safari<br>
      2. Pilih <b>Add to Home Screen</b> / <b>Tambah ke Layar Utama</b><br>
      3. Tap <b>Add</b> — ikon Level Up muncul di layar HP ✦`;
    document.body.appendChild(tip);
    tip.querySelector('button').onclick = () => { tip.style.display = 'none'; };

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault(); deferred = e; btn.style.display = 'inline-block';
    });
    window.addEventListener('appinstalled', () => { btn.style.display = 'none'; deferred = null; });
    if (isIOS) btn.style.display = 'inline-block';

    btn.onclick = async () => {
      if (deferred) {
        deferred.prompt();
        const r = await deferred.userChoice.catch(() => null);
        if (r && r.outcome === 'accepted') btn.style.display = 'none';
        deferred = null;
      } else if (isIOS) {
        tip.style.display = 'block';
      }
    };
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  const boot = () => { wrapShowTab(); updateDots(); initSwipe(); initInstall(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
