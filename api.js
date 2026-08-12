// ============================================================
//  LEVEL UP LEARNING CENTER – Client API Helper (Supabase)
//  Backend: Supabase PostgREST — tidak lagi pakai Google Apps Script
// ============================================================

const SUPABASE_URL = 'https://rpievidcpfeshrixerog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwaWV2aWRjcGZlc2hyaXhlcm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MTE3ODQsImV4cCI6MjEwMjA4Nzc4NH0.Hy2GmXCpA3Hd9OVaNK8JBvSdiKe8e5JaF6o5uaPlfOU';

// ── Core REST helper ────────────────────────────────────────
const SB = {
  headers(extra = {}) {
    return { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', ...extra };
  },
  async req(path, opts = {}) {
    // Range 0-99999 → lewati batas default 1000 baris PostgREST
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
      ...opts,
      headers: SB.headers({ 'Range-Unit': 'items', Range: '0-99999', ...opts.headers }),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try { const j = JSON.parse(text); msg = j.message || j.hint || j.details || text; } catch {}
      throw new Error(msg || ('HTTP ' + res.status));
    }
    if (!text) return null;
    try { return JSON.parse(text); } catch { return null; }
  },
  // SELECT — filters: { col: 'eq.value' } atau raw string
  select(table, filters = {}, extra = '') {
    const qs = Object.entries(filters).map(([k, v]) => `${k}=${v}`).join('&');
    return SB.req(table + '?select=*' + (qs ? '&' + qs : '') + (extra ? '&' + extra : ''));
  },
  insert(table, rows) {
    return SB.req(table, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(rows) });
  },
  upsert(table, rows) {
    return SB.req(table, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(rows) });
  },
  update(table, filters, fields) {
    const qs = Object.entries(filters).map(([k, v]) => `${k}=${v}`).join('&');
    return SB.req(table + '?' + qs, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(fields) });
  },
  del(table, filters) {
    const qs = Object.entries(filters).map(([k, v]) => `${k}=${v}`).join('&');
    return SB.req(table + '?' + qs, { method: 'DELETE' });
  },
};

// ── Util internal ───────────────────────────────────────────
function _uid() {
  const b = new Uint8Array(8);
  (crypto || window.crypto).getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}
function _normPhone(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  if (d && !d.startsWith('0')) d = '0' + d;
  return d;
}
function _d(v) { const s = String(v || '').trim(); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null; }
function _n(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
// buang key yang undefined supaya tidak menimpa kolom lain
function _clean(o) {
  const r = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) r[k] = v;
  return r;
}
const _ymd = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
// Rentang tanggal satu bulan (YYYY-MM) → ['YYYY-MM-01', 'YYYY-MM-<hari terakhir>']
function _monthRange(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  return [`${ym}-01`, _ymd(new Date(y, m, 0))];
}

const API = {
  // ══════════════════════════════════════════════════════════
  //  MURID
  // ══════════════════════════════════════════════════════════
  async getMurid(p = {}) {
    if (p.id) { const r = await SB.select('murid', { id: 'eq.' + p.id }); return r[0] || null; }
    const f = {};
    if (p.aktif) f.aktif = 'eq.' + p.aktif;
    return SB.select('murid', f, 'order=nama.asc');
  },

  async getMuridByLink(link_id) {
    const r = await SB.select('murid', { link_id: 'eq.' + link_id });
    const murid = r[0];
    if (!murid) throw new Error('Murid tidak ditemukan untuk link: ' + link_id);
    murid.kelas = await SB.select('kelas', { murid_id: 'eq.' + murid.id, aktif: 'eq.aktif' });
    return murid;
  },

  async addMurid(p) {
    const id = _uid();
    const link_id = String(p.nama || 'murid').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + id.slice(0, 6);
    await SB.insert('murid', {
      id,
      nama: p.nama || '',
      grade: p.grade || '',
      kelas_sekolah: p.kelas_sekolah || '',
      wa_ortu: String(p.wa_ortu || ''),
      wa_laporan: String(p.wa_laporan || ''),
      rate_invoice: _n(p.rate_invoice),
      pin: p.pin || String(Math.floor(100000 + Math.random() * 900000)),
      tgl_masuk: _d(p.tgl_masuk),
      tgl_berhenti: _d(p.tgl_berhenti),
      aktif: p.aktif || 'aktif',
      link_id,
    });
    return { id, link_id };
  },

  async updateMurid(p) {
    await SB.update('murid', { id: 'eq.' + p.id }, _clean({
      nama: p.nama,
      grade: p.grade,
      kelas_sekolah: p.kelas_sekolah,
      wa_ortu: p.wa_ortu !== undefined ? String(p.wa_ortu) : undefined,
      wa_laporan: p.wa_laporan !== undefined ? String(p.wa_laporan) : undefined,
      rate_invoice: p.rate_invoice !== undefined ? _n(p.rate_invoice) : undefined,
      pin: p.pin,
      tgl_masuk: p.tgl_masuk !== undefined ? _d(p.tgl_masuk) : undefined,
      tgl_berhenti: p.tgl_berhenti !== undefined ? _d(p.tgl_berhenti) : undefined,
      aktif: p.aktif,
    }));
    if (p.nama) await SB.update('kelas', { murid_id: 'eq.' + p.id }, { nama_murid: p.nama });
    return { updated: p.id };
  },

  async deleteMurid(id) { await SB.del('murid', { id: 'eq.' + id }); return { deleted: id }; },

  // ══════════════════════════════════════════════════════════
  //  KELAS
  // ══════════════════════════════════════════════════════════
  async getKelas(p = {}) {
    if (p.id) { const r = await SB.select('kelas', { id: 'eq.' + p.id }); return r[0] || null; }
    const f = {};
    if (p.murid_id) f.murid_id = 'eq.' + p.murid_id;
    if (p.guru_id)  f.guru_id  = 'eq.' + p.guru_id;
    if (p.aktif)    f.aktif    = 'eq.' + p.aktif;
    return SB.select('kelas', f);
  },

  async addKelas(p) {
    const id = _uid();
    const murid = await API.getMurid({ id: p.murid_id });
    if (!murid) throw new Error('Murid tidak ditemukan di list murid — refresh halaman lalu coba lagi');
    const gr = p.guru_id ? await SB.select('guru', { id: 'eq.' + p.guru_id }) : [];
    const guru = gr[0];
    await SB.insert('kelas', {
      id,
      murid_id: p.murid_id,
      nama_murid: murid.nama || '',
      guru_id: p.guru_id || null,
      nama_guru: guru ? guru.nama : (p.nama_guru || ''),
      program: p.program || 'Tutor',
      tipe: p.tipe || 'Private',
      jadwal: p.jadwal || '',
      sesi_kuota: _n(p.sesi_kuota) || 8,
      fee_guru: _n(p.fee_guru),
      tgl_mulai_term: _d(p.tgl_mulai_term),
      tgl_akhir_term: _d(p.tgl_akhir_term),
      aktif: p.aktif || 'aktif',
    });
    return { id };
  },

  async updateKelas(p) {
    await SB.update('kelas', { id: 'eq.' + p.id }, _clean({
      guru_id: p.guru_id || undefined,
      nama_guru: p.nama_guru,
      program: p.program,
      tipe: p.tipe,
      jadwal: p.jadwal,
      sesi_kuota: p.sesi_kuota !== undefined ? _n(p.sesi_kuota) : undefined,
      fee_guru:   p.fee_guru   !== undefined ? _n(p.fee_guru)   : undefined,
      tgl_mulai_term: p.tgl_mulai_term !== undefined ? _d(p.tgl_mulai_term) : undefined,
      tgl_akhir_term: p.tgl_akhir_term !== undefined ? _d(p.tgl_akhir_term) : undefined,
      aktif: p.aktif,
    }));
    return { updated: p.id };
  },

  async deleteKelas(id) { await SB.del('kelas', { id: 'eq.' + id }); return { deleted: id }; },

  // ── SESI BERJALAN per kelas ────────────────────────────────
  async getSesiAllKelas() {
    const [invoices, laporan, kelas] = await Promise.all([
      SB.req('invoice?select=murid_id,bulan&status=eq.lunas'),
      SB.req('laporan?select=kelas_id,tanggal'),
      SB.select('kelas', { aktif: 'eq.aktif' }),
    ]);

    // since = akhir bulan invoice lunas terakhir per murid
    const sinceMap = {};
    invoices.forEach(i => {
      if (!i.bulan) return;
      const [y, m] = String(i.bulan).split('-').map(Number);
      if (!y || !m) return;
      const d = _ymd(new Date(y, m, 0)); // hari terakhir bulan tsb
      if (!sinceMap[i.murid_id] || d > sinceMap[i.murid_id]) sinceMap[i.murid_id] = d;
    });

    // index laporan per kelas
    const lapByKelas = {};
    laporan.forEach(l => {
      if (!l.kelas_id) return;
      (lapByKelas[l.kelas_id] = lapByKelas[l.kelas_id] || []).push(String(l.tanggal || ''));
    });

    return kelas.map(k => {
      const since = sinceMap[k.murid_id] || null;
      // Prioritas: tgl_mulai_term (diisi admin) → since dari invoice lunas → hitung semua
      const startDate = k.tgl_mulai_term || since || null;
      // Sesi = tanggal unik dari laporan (pending & approved sama-sama dihitung)
      const tgl = (lapByKelas[k.id] || []).filter(t => t && (!startDate || t >= startDate));
      return {
        kelas_id: k.id, murid_id: k.murid_id, nama: k.nama_murid,
        guru_id: k.guru_id, nama_guru: k.nama_guru,
        program: k.program, tipe: k.tipe, jadwal: k.jadwal,
        sesi: new Set(tgl).size, kuota: _n(k.sesi_kuota) || 8, since,
        tgl_mulai_term: k.tgl_mulai_term || '', tgl_akhir_term: k.tgl_akhir_term || '',
      };
    });
  },

  // ══════════════════════════════════════════════════════════
  //  GURU
  // ══════════════════════════════════════════════════════════
  getGuru: () => SB.select('guru', {}, 'order=nama.asc'),

  async addGuru(p) {
    const id = _uid();
    await SB.insert('guru', {
      id, nama: p.nama || '', wa: String(p.wa || ''),
      default_fee: _n(p.default_fee), aktif: p.aktif || 'aktif', password: p.password || '',
    });
    return { id };
  },

  async updateGuru(p) {
    await SB.update('guru', { id: 'eq.' + p.id }, _clean({
      nama: p.nama,
      wa: p.wa !== undefined ? String(p.wa) : undefined,
      default_fee: p.default_fee !== undefined ? _n(p.default_fee) : undefined,
      aktif: p.aktif,
      password: p.password,
    }));
    if (p.nama) await SB.update('kelas', { guru_id: 'eq.' + p.id }, { nama_guru: p.nama });
    return { updated: p.id };
  },

  async deleteGuru(id) { await SB.del('guru', { id: 'eq.' + id }); return { deleted: id }; },

  // ── FEE GURU — dihitung dari laporan harian ────────────────
  async getFeeGuru(bulan) {
    if (!bulan) throw new Error('Parameter bulan (YYYY-MM) wajib diisi');
    const [d1, d2] = _monthRange(bulan);
    const [laporan, kelas, guru] = await Promise.all([
      SB.select('laporan', { and: `(tanggal.gte.${d1},tanggal.lte.${d2})` }),
      SB.select('kelas'),
      SB.select('guru'),
    ]);
    const kelasMap = {}; kelas.forEach(k => { kelasMap[k.id] = k; });

    const perGuru = {};
    laporan.forEach(l => {
      const gid = l.guru_id || 'unknown';
      const kid = l.kelas_id || 'tanpa-kelas';
      perGuru[gid] = perGuru[gid] || {};
      perGuru[gid][kid] = perGuru[gid][kid] || { count: 0, tanggal: [] };
      perGuru[gid][kid].count++;
      if (l.tanggal) perGuru[gid][kid].tanggal.push(String(l.tanggal));
    });

    return Object.entries(perGuru).map(([gid, kelasData]) => {
      const g = guru.find(x => x.id === gid);
      let total_sesi = 0, total_fee = 0;
      const detail = Object.entries(kelasData).map(([kid, data]) => {
        const k = kelasMap[kid];
        const fee = k ? (_n(k.fee_guru) || _n(g && g.default_fee)) : _n(g && g.default_fee);
        total_sesi += data.count;
        total_fee += fee * data.count;
        return {
          kelas_id: kid,
          nama_murid: k ? k.nama_murid : '(kelas terhapus)',
          program: k ? k.program : '-',
          tipe: k ? k.tipe : '-',
          sesi: data.count,
          fee_per_sesi: fee,
          subtotal: fee * data.count,
          tanggal: data.tanggal.sort(),
        };
      });
      return { guru_id: gid, nama_guru: g ? g.nama : '(tidak dikenal)', wa: g ? g.wa : '', total_sesi, total_fee, detail };
    }).sort((a, b) => a.nama_guru > b.nama_guru ? 1 : -1);
  },

  // ══════════════════════════════════════════════════════════
  //  LAPORAN
  // ══════════════════════════════════════════════════════════
  async getLaporan(p = {}) {
    const f = {};
    if (p.status)   f.status   = 'eq.' + p.status;
    if (p.murid_id) f.murid_id = 'eq.' + p.murid_id;
    if (p.guru_id)  f.guru_id  = 'eq.' + p.guru_id;
    if (p.kelas_id) f.kelas_id = 'eq.' + p.kelas_id;
    const conds = [];
    if (p.bulan)  { const [a, b] = _monthRange(p.bulan); conds.push(`tanggal.gte.${a}`, `tanggal.lte.${b}`); }
    if (p.dari)   conds.push(`tanggal.gte.${p.dari}`);
    if (p.sampai) conds.push(`tanggal.lte.${p.sampai}`);
    if (conds.length) f.and = `(${conds.join(',')})`;
    const rows = await SB.select('laporan', f, 'order=tanggal.desc');
    rows.forEach(r => { if (!r.status) r.status = 'approved'; });
    return rows;
  },

  async addLaporan(p) {
    const id = _uid();
    const kelas = p.kelas_id ? await API.getKelas({ id: p.kelas_id }) : null;
    const murid_id = p.murid_id || (kelas ? kelas.murid_id : '');
    const guru_id  = p.guru_id  || (kelas ? kelas.guru_id  : '');
    const [mr, gr] = await Promise.all([
      murid_id ? SB.select('murid', { id: 'eq.' + murid_id }) : [],
      guru_id  ? SB.select('guru',  { id: 'eq.' + guru_id })  : [],
    ]);
    const murid = mr[0], guru = gr[0];

    await SB.insert('laporan', {
      id,
      kelas_id: p.kelas_id || null,
      murid_id: murid_id || null,
      nama_murid: murid ? murid.nama : '',
      guru_id: guru_id || null,
      nama_guru: guru ? guru.nama : '',
      tanggal: _d(p.tanggal),
      program: p.program || (kelas ? kelas.program : ''),
      materi_json: typeof p.materi === 'string' ? p.materi : JSON.stringify(p.materi || []),
      catatan: p.catatan || '',
      status: p.status || 'pending',
      timestamp: new Date().toISOString(),
    });

    // Auto-absen hadir untuk kelas & tanggal ini
    if (p.auto_absen && p.kelas_id && p.tanggal) {
      await API.upsertAbsensi({
        kelas_id: p.kelas_id, murid_id, nama: murid ? murid.nama : '',
        tanggal: p.tanggal, status: 'hadir', catatan: 'auto: laporan guru',
      });
    }
    return { id };
  },

  async updateLaporan(p) {
    await SB.update('laporan', { id: 'eq.' + p.id }, _clean({
      tanggal: p.tanggal !== undefined ? _d(p.tanggal) : undefined,
      materi_json: p.materi !== undefined ? (typeof p.materi === 'string' ? p.materi : JSON.stringify(p.materi)) : undefined,
      catatan: p.catatan,
      status: p.status,
    }));
    return { updated: p.id };
  },

  async deleteLaporan(id) { await SB.del('laporan', { id: 'eq.' + id }); return { deleted: id }; },

  // ══════════════════════════════════════════════════════════
  //  LOGIN
  // ══════════════════════════════════════════════════════════
  async loginOrtu(phone, password) {
    const ph = _normPhone(phone);
    if (!ph) throw new Error('Isi nomor HP dulu ya');
    const murid = await SB.select('murid');
    const samePhone = murid.filter(m => _normPhone(m.wa_ortu) === ph || _normPhone(m.wa_laporan) === ph);
    if (!samePhone.length) throw new Error('Nomor HP tidak terdaftar. Hubungi admin Level Up ya 🙏');
    const anak = samePhone.filter(m => m.aktif === 'aktif');
    if (!anak.length) throw new Error('Status murid nonaktif — akses portal dimatikan. Hubungi admin Level Up 🙏');
    const pw = String(anak[0].pin || '');
    if (!pw) throw new Error('Password belum diset. Hubungi admin Level Up untuk mendapatkan password awal 🙏');
    if (String(password || '') !== pw) throw new Error('Password salah');
    const kelas = await SB.select('kelas', { aktif: 'eq.aktif' });
    return anak.map(m => ({
      id: m.id, nama: m.nama, grade: m.grade, kelas_sekolah: m.kelas_sekolah,
      kelas: kelas.filter(x => x.murid_id === m.id), murid_id: m.id,
    }));
  },

  async loginGuru(phone, password) {
    const ph = _normPhone(phone);
    if (!ph) throw new Error('Isi nomor HP dulu ya');
    const all = await SB.select('guru');
    const guru = all.find(g => _normPhone(g.wa) === ph);
    if (!guru) throw new Error('Nomor HP tidak terdaftar sebagai guru. Hubungi admin 🙏');
    if (guru.aktif === 'nonaktif') throw new Error('Status guru nonaktif — akses dimatikan. Hubungi admin 🙏');
    const pw = String(guru.password || '');
    if (!pw) throw new Error('Password belum diset. Hubungi admin untuk mendapatkan password awal 🙏');
    if (String(password || '') !== pw) throw new Error('Password salah');
    return { id: guru.id, nama: guru.nama };
  },

  async loginAdmin(phone, password) {
    const rows = await SB.select('setting');
    const get = k => { const r = rows.find(x => x.key === k); return r ? String(r.value || '') : ''; };
    const adminPhone = _normPhone(get('admin_phone'));
    const adminPass = get('admin_password');
    if (!adminPass) throw new Error('Login admin belum diset — cek tabel setting di Supabase');
    if (adminPhone && _normPhone(phone) !== adminPhone) throw new Error('Nomor HP admin salah');
    if (String(password || '') !== adminPass) throw new Error('Password salah');
    return { ok: true };
  },

  // ── PASSWORD MANAGEMENT ────────────────────────────────────
  async changeOrtuPassword(murid_id, old_pw, new_pw) {
    const r = await SB.select('murid', { id: 'eq.' + murid_id });
    const murid = r[0];
    if (!murid) throw new Error('Data tidak ditemukan');
    if (String(murid.pin || '') !== String(old_pw || '')) throw new Error('Password lama salah');
    if (!new_pw || String(new_pw).length < 4) throw new Error('Password baru minimal 4 karakter');
    await SB.update('murid', { id: 'eq.' + murid_id }, { pin: String(new_pw) });
    return { ok: true };
  },

  async changeGuruPassword(guru_id, old_pw, new_pw) {
    const r = await SB.select('guru', { id: 'eq.' + guru_id });
    const guru = r[0];
    if (!guru) throw new Error('Data tidak ditemukan');
    if (String(guru.password || '') !== String(old_pw || '')) throw new Error('Password lama salah');
    if (!new_pw || String(new_pw).length < 4) throw new Error('Password baru minimal 4 karakter');
    await SB.update('guru', { id: 'eq.' + guru_id }, { password: String(new_pw) });
    return { ok: true };
  },

  async resetOrtuPassword(murid_id) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    await SB.update('murid', { id: 'eq.' + murid_id }, { pin });
    return { murid_id, pin };
  },

  async setGuruPassword(guru_id, password) {
    if (!password || String(password).length < 4) throw new Error('Password minimal 4 karakter');
    await SB.update('guru', { id: 'eq.' + guru_id }, { password: String(password) });
    return { ok: true };
  },

  // ══════════════════════════════════════════════════════════
  //  ABSENSI
  // ══════════════════════════════════════════════════════════
  async getAbsensi(p = {}) {
    const f = {};
    if (p.tanggal)  f.tanggal  = 'eq.' + p.tanggal;
    if (p.murid_id) f.murid_id = 'eq.' + p.murid_id;
    if (p.kelas_id) f.kelas_id = 'eq.' + p.kelas_id;
    const conds = [];
    if (p.bulan)  { const [a, b] = _monthRange(p.bulan); conds.push(`tanggal.gte.${a}`, `tanggal.lte.${b}`); }
    if (p.dari)   conds.push(`tanggal.gte.${p.dari}`);
    if (p.sampai) conds.push(`tanggal.lte.${p.sampai}`);
    if (conds.length) f.and = `(${conds.join(',')})`;
    return SB.select('absensi', f);
  },

  // Simpan absensi per tanggal (replace semua baris tanggal tsb)
  async saveAbsensi(tanggal, data) {
    await SB.del('absensi', { tanggal: 'eq.' + tanggal });
    if (data.length) {
      await SB.insert('absensi', data.map(d => ({
        id: _uid(), kelas_id: d.kelas_id || null, murid_id: d.murid_id || null,
        nama: d.nama || '', tanggal: _d(tanggal), status: d.status, catatan: d.catatan || '',
      })));
    }
    return { saved: data.length };
  },

  // Upsert satu baris absensi (dipakai auto-absen dari laporan guru)
  async upsertAbsensi(p) {
    const existing = await SB.select('absensi', { tanggal: 'eq.' + p.tanggal, kelas_id: 'eq.' + p.kelas_id });
    if (existing.length) {
      await SB.update('absensi', { id: 'eq.' + existing[0].id }, { status: p.status || 'hadir' });
      return { updated: true };
    }
    await SB.insert('absensi', {
      id: _uid(), kelas_id: p.kelas_id || null, murid_id: p.murid_id || null,
      nama: p.nama || '', tanggal: _d(p.tanggal), status: p.status || 'hadir', catatan: p.catatan || '',
    });
    return { inserted: true };
  },

  // ══════════════════════════════════════════════════════════
  //  INVOICE
  // ══════════════════════════════════════════════════════════
  async getInvoice(p = {}) {
    const f = {};
    if (p.murid_id) f.murid_id = 'eq.' + p.murid_id;
    if (p.bulan)    f.bulan    = 'eq.' + String(p.bulan).slice(0, 7);
    return SB.select('invoice', f, 'order=bulan.desc');
  },

  async generateInvoice(p) {
    const murid = await API.getMurid({ id: p.murid_id });
    if (!murid) throw new Error('Murid tidak ditemukan');
    const sesi = _n(p.sesi);
    if (sesi <= 0) throw new Error('Jumlah sesi harus lebih dari 0');
    const rate = _n(p.rate) || _n(murid.rate_invoice);
    const nominal = (p.nominal !== undefined && p.nominal !== '') ? _n(p.nominal) : rate * sesi;

    // Tidak ada batasan duplikat — murid bisa punya >1 invoice per bulan (beda program)
    let label = p.program_label || '';
    if (!label) {
      const kls = await API.getKelas({ murid_id: p.murid_id, aktif: 'aktif' });
      label = [...new Set(kls.map(k => k.program))].join(' & ');
    }

    const id = _uid();
    await SB.insert('invoice', {
      id, murid_id: p.murid_id, nama_murid: murid.nama, bulan: String(p.bulan).slice(0, 7),
      program_label: label, sesi, rate, nominal,
      status: 'belum_bayar', tgl_kirim: null, bukti_url: '', catatan: p.catatan || '',
    });
    return { id, sesi, rate, nominal, program_label: label };
  },

  async updateInvoiceStatus(id, status, tgl_kirim) {
    await SB.update('invoice', { id: 'eq.' + id }, _clean({
      status, tgl_kirim: tgl_kirim !== undefined ? _d(tgl_kirim) : undefined,
    }));
    return { updated: id };
  },

  async updateInvoiceNominal(id, sesi, rate, nominal) {
    await SB.update('invoice', { id: 'eq.' + id }, _clean({
      sesi:    sesi    !== undefined ? _n(sesi)    : undefined,
      rate:    rate    !== undefined ? _n(rate)    : undefined,
      nominal: nominal !== undefined ? _n(nominal) : undefined,
    }));
    return { updated: id };
  },

  async deleteInvoice(id) { await SB.del('invoice', { id: 'eq.' + id }); return { deleted: id }; },

  // Upload bukti bayar ke Supabase Storage
  async uploadBukti(invoice_id, murid_id, bulan, file) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${murid_id}/${bulan}-${Date.now()}.${ext}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/bukti-bayar/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type || 'image/jpeg' },
      body: file,
    });
    if (!res.ok) throw new Error('Upload gagal: ' + (await res.text()));
    const url = `${SUPABASE_URL}/storage/v1/object/public/bukti-bayar/${path}`;
    const today = _ymd(new Date());
    await SB.update('invoice', { id: 'eq.' + invoice_id }, { status: 'lunas', bukti_url: url, tgl_kirim: today });
    return { url };
  },

  // ══════════════════════════════════════════════════════════
  //  LEGACY (tidak dipakai lagi — schema dikelola via SQL Supabase)
  // ══════════════════════════════════════════════════════════
  setup:     async () => ({ note: 'Schema dikelola lewat Supabase SQL Editor' }),
  seed:      async () => { throw new Error('Seed hanya dipakai pada sistem lama'); },
  addColumn: async () => ({ note: 'Tambah kolom lewat Supabase Table Editor' }),
  migrate:   async () => ({ note: 'Migrasi dikelola lewat Supabase SQL Editor' }),
};

// ── Util bersama ────────────────────────────────────────────
const LU = {
  PROGRAMS: ['Tutor', 'Swim', 'Art', 'Mandarin'],
  TIPE: ['Private', 'Semi Private', 'Home Service'],
  GRADES: ['Growing', 'Improving', 'Advanced'],
  BANK: 'BCA 2881889996 a.n. Clara E',
  rp: (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'),
  bulanID: (ym) => {
    if (!ym) return '—';
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  },
  fmtDate: (s) => {
    if (!s) return '–';
    try { return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return s; }
  },
  fmtDateDDMM: (s) => {
    if (!s) return '–';
    const [y, m, d] = String(s).split('-');
    return `${d}/${m}/${y}`;
  },
  parseMateri: (json) => {
    try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
  },
  stars: (n) => '★'.repeat(Number(n) || 0) + '☆'.repeat(Math.max(0, 4 - (Number(n) || 0))),
  // Template WA invoice LevelUp
  waInvoice: ({ bulan, nama, program, sesi, rate, total }) => (
`Dear Parents,
Berikut kami informasikan billing bulan ${bulan}

Nama Anak: ${nama}
Program: ${program}
Jumlah Sesi: ${sesi}
💰 Rate: ${LU.rp(rate)}/ sesi
💰 Total: ${LU.rp(total)}

Pembayaran dapat dilakukan melalui:
${LU.BANK}

Mohon konfirmasi setelah melakukan pembayaran ya 🙏
Terima kasih banyak atas kepercayaannya 😊`),
  // Template WA laporan harian
  waLaporan: ({ tanggal, nama, program, tipe, materi, catatan }) => {
    const tglFmt = tanggal
      ? new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    const materiTxt = (materi && materi.length)
      ? materi.map(x => `• ${x.m} ${LU.stars(x.s)}`).join('\n')
      : '—';
    return `Hello parents ✦

✦ Daily Report — Level Up Learning Center
${tglFmt}
Nama: ${nama || '—'}
Program: ${program || '—'}${tipe ? ' (' + tipe + ')' : ''}

Materi hari ini:
${materiTxt}

Teacher's Note:
${catatan || '—'}

☆ Little steps today, big LEVEL UP tomorrow ☆`;
  },
};
