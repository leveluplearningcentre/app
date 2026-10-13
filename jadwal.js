// ============================================================
//  LEVEL UP – Time Table (dipakai admin.html & guru.html)
//  Slot jadwal per kelas disimpan di kolom kelas.jadwal_slots:
//    [{ d: 1-7 (Sen=1 … Min=7), t: "HH:MM", dur: menit }]
//  Kalau kosong, otomatis dibaca dari teks jadwal lama
//  (cth: "Mon/Thu 15.30", "Mon 12.00 & Thu 13.30").
// ============================================================
const JADWAL = (() => {
  const HARI = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const HARI_EN = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_RE = {
    1: /^(mon|monday|sen|senin)$/i, 2: /^(tue|tues|tuesday|sel|selasa)$/i,
    3: /^(wed|wednesday|rab|rabu)$/i, 4: /^(thu|thur|thurs|thursday|kam|kamis)$/i,
    5: /^(fri|friday|jum|jumat)$/i, 6: /^(sat|saturday|sab|sabtu)$/i,
    7: /^(sun|sunday|min|minggu)$/i,
  };
  const DEFAULT_DUR = 60;
  const START_H = 7, END_H = 21, PX_PER_H = 56;

  const pad = n => String(n).padStart(2, '0');
  const ymd = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const fromMin = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

  // ── Teks jadwal lama → slot ─────────────────────────────────
  function parse(text) {
    const slots = [];
    if (!text) return slots;
    const tokens = String(text).match(/[A-Za-z]+|\d{1,2}[.:]\d{2}|\d{1,2}(?=\s*$)/g) || [];
    let pending = [], lastTime = null;
    for (const tok of tokens) {
      const d = +Object.keys(DAY_RE).find(k => DAY_RE[k].test(tok)) || 0;
      if (d) { pending.push(d); continue; }
      if (/^\d/.test(tok)) {
        let [h, m] = tok.split(/[.:]/).map(Number); m = m || 0;
        if (h < 6) h += 12; // "3.30" → 15:30
        if (h > 23 || m > 59) continue;
        lastTime = `${pad(h)}:${pad(m)}`;
        pending.forEach(dd => slots.push({ d: dd, t: lastTime, dur: DEFAULT_DUR }));
        pending = [];
      }
    }
    if (pending.length && lastTime) pending.forEach(dd => slots.push({ d: dd, t: lastTime, dur: DEFAULT_DUR }));
    // buang duplikat
    const seen = new Set();
    return slots.filter(s => { const k = s.d + s.t; if (seen.has(k)) return false; seen.add(k); return true; });
  }

  // ── Slot → teks ringkas ("Tue/Thu 13.00 & Sat 10.00") ───────
  function format(slots) {
    if (!slots || !slots.length) return '';
    const byTime = {};
    [...slots].sort((a, b) => a.d - b.d).forEach(s => { (byTime[s.t] = byTime[s.t] || []).push(s.d); });
    return Object.entries(byTime)
      .sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]))
      .map(([t, ds]) => ds.map(d => HARI_EN[d]).join('/') + ' ' + t.replace(':', '.'))
      .join(' & ');
  }

  function slotsOf(k) {
    let s = k.jadwal_slots;
    if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = null; } }
    if (Array.isArray(s) && s.length) return s.map(x => ({ d: +x.d, t: x.t, dur: +x.dur || DEFAULT_DUR }));
    return parse(k.jadwal);
  }

  function weekStart(date) {
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    const wd = d.getDay() || 7; d.setDate(d.getDate() - wd + 1);
    return d;
  }
  function weekDates(ws) {
    return [1, 2, 3, 4, 5, 6, 7].map(i => { const d = new Date(ws); d.setDate(ws.getDate() + i - 1); return d; });
  }

  // ── Kejadian kelas dalam satu minggu ───────────────────────
  // laporanIdx: { "kelasId|YYYY-MM-DD": [laporan,...] }
  // absenIdx: { "kelasId|YYYY-MM-DD": absensi } → status izin/sakit/libur = tidak perlu laporan
  const IZIN = ['izin', 'sakit', 'libur', 'alpha'];
  function occurrences(kelasList, ws, laporanIdx = {}, today = ymd(new Date()), absenIdx = {}) {
    const out = [], seen = new Set();
    const dates = weekDates(ws);
    // kelas dgn term lebih baru diproses dulu supaya duplikat antar-term terbuang
    const sorted = [...kelasList].filter(k => k.aktif === 'aktif')
      .sort((a, b) => String(b.tgl_mulai_term || '').localeCompare(String(a.tgl_mulai_term || '')));
    for (const k of sorted) {
      for (const s of slotsOf(k)) {
        const date = ymd(dates[s.d - 1]);
        if (k.tgl_mulai_term && date < k.tgl_mulai_term) continue;
        if (k.tgl_akhir_term && date > k.tgl_akhir_term) continue;
        const key = [k.murid_id, k.program, s.d, s.t, date].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const lap = laporanIdx[k.id + '|' + date] || [];
        const pengganti = lap.find(l => l.guru_id && l.guru_id !== k.guru_id);
        const absen = absenIdx[k.id + '|' + date] || null;
        const izin = !lap.length && absen && IZIN.includes(absen.status);
        const status = lap.length ? 'done' : izin ? 'izin' : (date < today ? 'missing' : date === today ? 'today' : 'future');
        out.push({ k, slot: s, date, d: s.d, start: toMin(s.t), end: toMin(s.t) + (s.dur || DEFAULT_DUR), lap, pengganti, status, absen });
      }
    }
    return out;
  }

  // Gabung kelas dgn guru + program + jam yang sama (mis. Semi Private) jadi satu kotak
  const STATUS_RANK = { missing: 0, today: 1, future: 2, izin: 3, done: 3 };
  function groupEvents(evs) {
    const map = new Map();
    evs.forEach(e => {
      const key = [e.date, e.start, e.k.guru_id || e.k.nama_guru, e.k.program].join('|');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return [...map.values()].map(list => {
      if (list.length === 1) return list[0];
      list.sort((a, b) => (a.k.nama_murid || '').localeCompare(b.k.nama_murid || ''));
      const worst = list.reduce((w, e) => STATUS_RANK[e.status] < STATUS_RANK[w.status] ? e : w, list[0]);
      return {
        ...list[0], members: list,
        end: Math.max(...list.map(e => e.end)),
        status: worst.status,
        pengganti: list.find(e => e.pengganti)?.pengganti || null,
      };
    });
  }

  // Bagi kolom kalau ada jadwal yang bentrok jam
  function layoutLanes(evs) {
    evs.sort((a, b) => a.start - b.start || b.end - a.end);
    let cluster = [], clusterEnd = -1;
    const flush = () => {
      const lanes = [];
      cluster.forEach(e => {
        let i = lanes.findIndex(end => end <= e.start);
        if (i < 0) { i = lanes.length; lanes.push(0); }
        lanes[i] = e.end; e.lane = i;
      });
      cluster.forEach(e => { e.lanes = lanes.length; });
      cluster = [];
    };
    evs.forEach(e => {
      if (e.start >= clusterEnd && cluster.length) flush();
      cluster.push(e); clusterEnd = Math.max(clusterEnd, e.end);
    });
    if (cluster.length) flush();
    return evs;
  }

  const PROG_COLOR = {
    Tutor: ['#EAF3FB', '#5E87B8', '#A7C7E7'], Swim: ['#EAF8F0', '#3E8A65', '#BFE6D2'],
    Art: ['#FFF6E3', '#B98A2E', '#FFE3A3'], Mandarin: ['#F4EEFB', '#8A6FB5', '#D9C7F0'],
  };
  const STATUS_ICON = { done: '✅', missing: '⚠️', today: '⏳', future: '', izin: '🙅' };

  // ── Render grid mingguan ───────────────────────────────────
  // opts: { container, ws, events, days:[1..7], showGuru, onClick(ev), onEmpty(d,date,time), onMove(ev,d,time), draggable }
  function render(opts) {
    const { container, ws, showGuru = true } = opts;
    const events = groupEvents(opts.events);
    const days = opts.days || [1, 2, 3, 4, 5, 6, 7];
    const dates = weekDates(ws);
    const today = ymd(new Date());
    const hours = [];
    for (let h = START_H; h < END_H; h++) hours.push(h);
    const H = (END_H - START_H) * PX_PER_H;

    const byDay = {};
    days.forEach(d => { byDay[d] = layoutLanes(events.filter(e => e.d === d)); });

    container.innerHTML = `
      <div class="tt-scroll"><div class="tt" style="--cols:${days.length}">
        <div class="tt-head tt-corner"></div>
        ${days.map(d => {
          const dt = dates[d - 1], isToday = ymd(dt) === today;
          return `<div class="tt-head${isToday ? ' today' : ''}"><span>${HARI[d]}</span><b>${dt.getDate()}</b></div>`;
        }).join('')}
        <div class="tt-hours" style="height:${H}px">${hours.map(h => `<div style="height:${PX_PER_H}px">${pad(h)}:00</div>`).join('')}</div>
        ${days.map(d => {
          const date = ymd(dates[d - 1]);
          return `<div class="tt-col${date === today ? ' today' : ''}" data-d="${d}" data-date="${date}" style="height:${H}px">
            ${hours.map(() => `<div class="tt-line" style="height:${PX_PER_H}px"></div>`).join('')}
            ${byDay[d].map(e => {
              const [bg, ink, bd] = PROG_COLOR[e.k.program] || PROG_COLOR.Tutor;
              const top = (e.start - START_H * 60) / 60 * PX_PER_H;
              const ht = Math.max(22, (e.end - e.start) / 60 * PX_PER_H - 2);
              const w = 100 / e.lanes;
              const idx = events.indexOf(e);
              const mem = e.members || [e];
              const names = mem.map(m => m.k.nama_murid);
              return `<div class="tt-ev st-${e.status}${mem.length > 1 ? ' tt-group' : ''}" data-i="${idx}"
                style="top:${top}px;height:${ht}px;left:calc(${w * e.lane}% + 2px);width:calc(${w}% - 4px);background:${bg};color:${ink};border-color:${bd}"
                title="${names.join(', ')} · ${e.k.program} (${e.k.tipe}) · ${e.k.nama_guru || ''} · ${e.slot.t}">
                <div class="tt-ev-t">${e.slot.t} ${STATUS_ICON[e.status]}${mem.length > 1 ? ` <span class="tt-cnt">👥${mem.length}</span>` : ''}</div>
                ${mem.length > 1
                  ? mem.map(m => `<div class="tt-ev-n tt-ev-m">${STATUS_ICON[m.status] ? `<span class="tt-mi">${STATUS_ICON[m.status]}</span>` : ''}${m.k.nama_murid}</div>`).join('')
                  : `<div class="tt-ev-n">${e.k.nama_murid}</div>`}
                ${showGuru ? `<div class="tt-ev-g">${e.pengganti ? '🔄 ' + (e.pengganti.nama_guru || 'pengganti') : (e.k.nama_guru || '')}</div>` : ''}
              </div>`;
            }).join('')}
          </div>`;
        }).join('')}
      </div></div>`;

    // klik event
    container.querySelectorAll('.tt-ev').forEach(el => {
      el.addEventListener('click', ev => {
        if (el.dataset.dragged) { delete el.dataset.dragged; return; }
        ev.stopPropagation();
        opts.onClick && opts.onClick(events[+el.dataset.i]);
      });
    });
    // klik slot kosong
    if (opts.onEmpty) container.querySelectorAll('.tt-col').forEach(col => {
      col.addEventListener('click', ev => {
        if (ev.target.closest('.tt-ev')) return;
        const y = ev.clientY - col.getBoundingClientRect().top;
        const min = Math.round((START_H * 60 + y / PX_PER_H * 60) / 15) * 15;
        opts.onEmpty(+col.dataset.d, col.dataset.date, fromMin(min));
      });
    });
    if (opts.draggable && opts.onMove) enableDrag(container, events, opts.onMove);
  }

  // ── Drag & drop untuk pindah jadwal ────────────────────────
  // Mouse: geser langsung · HP: tekan-tahan 0,4 detik lalu geser
  function enableDrag(container, events, onMove) {
    container.querySelectorAll('.tt-ev').forEach(el => {
      let sx, sy, timer, dragging = false, ready = false, pid;
      const start = e => {
        sx = e.clientX; sy = e.clientY; pid = e.pointerId; dragging = false;
        ready = e.pointerType === 'mouse';
        if (!ready) timer = setTimeout(() => { ready = true; el.classList.add('tt-armed'); navigator.vibrate && navigator.vibrate(30); }, 400);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end, { once: true });
        window.addEventListener('pointercancel', cancel, { once: true });
      };
      const move = e => {
        if (e.pointerId !== pid) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (!ready) { if (Math.abs(dx) + Math.abs(dy) > 8) cancel(); return; }
        if (!dragging && Math.abs(dx) + Math.abs(dy) < 5) return;
        dragging = true; document.body.classList.add('tt-dragging');
        e.preventDefault();
        el.classList.add('tt-drag');
        el.style.transform = `translate(${dx}px,${dy}px)`;
      };
      const cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener('pointermove', move);
        el.classList.remove('tt-drag', 'tt-armed');
        el.style.transform = '';
        document.body.classList.remove('tt-dragging');
      };
      const cancel = () => { cleanup(); dragging = false; ready = false; };
      const end = e => {
        const wasDragging = dragging;
        cleanup();
        if (!wasDragging) return;
        el.dataset.dragged = '1';
        el.style.visibility = 'hidden';
        const target = document.elementFromPoint(e.clientX, e.clientY);
        el.style.visibility = '';
        const col = target && target.closest('.tt-col');
        if (!col || !container.contains(col)) return;
        const ev = events[+el.dataset.i];
        const top = el.getBoundingClientRect().top - col.getBoundingClientRect().top + (e.clientY - sy);
        const min = Math.max(START_H * 60, Math.round((START_H * 60 + top / PX_PER_H * 60) / 15) * 15);
        const newT = fromMin(min), newD = +col.dataset.d;
        if (newT === ev.slot.t && newD === ev.slot.d) return;
        onMove(ev, newD, newT);
      };
      el.addEventListener('pointerdown', start);
      // setelah tekan-tahan, cegah layar ikut scroll supaya bisa digeser
      el.addEventListener('touchmove', e => { if (ready) e.preventDefault(); }, { passive: false });
      el.addEventListener('contextmenu', e => e.preventDefault());
    });
  }

  // ── CSS (sekali saja) ──────────────────────────────────────
  const css = `
  .tt-scroll{overflow:auto;border:1.5px solid #F0E4E8;border-radius:14px;max-height:72vh;background:#fff;-webkit-overflow-scrolling:touch}
  .tt{display:grid;grid-template-columns:52px repeat(var(--cols),minmax(118px,1fr));position:relative;min-width:calc(52px + var(--cols)*118px)}
  .tt-head{position:sticky;top:0;z-index:3;background:#fff;border-bottom:1.5px solid #F0E4E8;padding:8px 4px;text-align:center;font-size:11px;font-weight:800;color:#9A93A8}
  .tt-head span{display:block;text-transform:uppercase;letter-spacing:.5px}
  .tt-head b{font-family:'Baloo 2',cursive;font-size:18px;color:#443E52}
  .tt-head.today b{background:#E891A5;color:#fff;border-radius:999px;padding:0 9px}
  .tt-corner{left:0;z-index:4}
  .tt-hours{position:sticky;left:0;z-index:2;background:#fff;border-right:1.5px solid #F0E4E8}
  .tt-hours div{font-size:10.5px;font-weight:800;color:#9A93A8;text-align:right;padding:2px 6px 0 0;box-sizing:border-box}
  .tt-col{position:relative;border-right:1px solid #F6EEF1}
  .tt-col.today{background:#FFFAF8}
  .tt-line{border-bottom:1px dashed #F3E8EC;box-sizing:border-box}
  .tt-ev{position:absolute;border-radius:9px;border:1.5px solid;padding:3px 6px;font-size:11px;line-height:1.25;overflow:hidden;cursor:pointer;box-shadow:0 2px 6px rgba(68,62,82,.08);transition:box-shadow .15s;touch-action:pan-x pan-y;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
  .tt-ev:hover{box-shadow:0 4px 12px rgba(68,62,82,.18);z-index:5}
  .tt-ev-t{font-weight:900;font-size:10.5px;opacity:.85}
  .tt-ev-n{font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tt-ev-g{font-weight:700;font-size:10px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tt-ev-m{font-size:10.5px;line-height:1.3}
  .tt-mi{font-size:9px;margin-right:2px}
  .tt-cnt{font-size:9.5px;font-weight:900;background:rgba(255,255,255,.7);border-radius:999px;padding:0 5px;margin-left:2px}
  .tt-ev.tt-group:hover{overflow:visible;height:auto!important;min-height:fit-content;z-index:20}
  .tt-ev.st-missing{border-color:#E87979!important;border-style:dashed;box-shadow:0 0 0 2px rgba(232,121,121,.18)}
  .tt-ev.st-done{opacity:.78}
  .tt-ev.st-izin{opacity:.5;border-style:dashed;background-image:repeating-linear-gradient(135deg,transparent 0 6px,rgba(154,147,168,.12) 6px 12px)!important}
  .tt-ev.tt-armed{box-shadow:0 0 0 3px #E891A5}
  .tt-ev.tt-drag{z-index:50;opacity:.9;box-shadow:0 10px 24px rgba(68,62,82,.3);cursor:grabbing;transition:none}
  body.tt-dragging{user-select:none;-webkit-user-select:none}
  .tt-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;font-weight:800;color:#9A93A8;margin-top:10px}
  `;
  if (typeof document !== 'undefined' && !document.getElementById('tt-css')) {
    const st = document.createElement('style'); st.id = 'tt-css'; st.textContent = css;
    document.head.appendChild(st);
  }

  return { IZIN, HARI, HARI_EN, parse, format, slotsOf, weekStart, weekDates, occurrences, groupEvents, render, ymd, toMin, fromMin, DEFAULT_DUR };
})();
