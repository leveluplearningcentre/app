// ============================================================
//  LEVEL UP LEARNING CENTER – Client API Helper
//  Ganti SCRIPT_URL dengan URL deployment Apps Script kamu (/exec)
// ============================================================

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQj-Gwe8aAGusSubJyi_XIK6bsN4-KxtYL__5e1s8TxbPVvsdShNmbhZh5REtv1Eh60w/exec';

const API = {
  async post(payload) {
    const res  = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.status === 'error') throw new Error(json.message);
    return json.data;
  },
  async get(params) {
    const qs  = new URLSearchParams(params).toString();
    const res = await fetch(SCRIPT_URL + '?' + qs);
    const json = await res.json();
    if (json.status === 'error') throw new Error(json.message);
    return json.data;
  },

  // MURID
  getMurid:       (opts = {}) => API.post({ action: 'getMurid', ...opts }),
  getMuridByLink: (link_id)   => API.post({ action: 'getMuridByLink', link_id }),
  addMurid:       (d)         => API.post({ action: 'addMurid', ...d }),
  updateMurid:    (d)         => API.post({ action: 'updateMurid', ...d }),
  deleteMurid:    (id)        => API.post({ action: 'deleteMurid', id }),

  // KELAS (enrollment murid per program)
  getKelas:        (opts = {}) => API.post({ action: 'getKelas', ...opts }),
  addKelas:        (d)         => API.post({ action: 'addKelas', ...d }),
  updateKelas:     (d)         => API.post({ action: 'updateKelas', ...d }),
  deleteKelas:     (id)        => API.post({ action: 'deleteKelas', id }),
  getSesiAllKelas: ()          => API.post({ action: 'getSesiAllKelas' }),

  // GURU
  getGuru:    ()       => API.post({ action: 'getGuru' }),
  addGuru:    (d)      => API.post({ action: 'addGuru', ...d }),
  updateGuru: (d)      => API.post({ action: 'updateGuru', ...d }),
  deleteGuru: (id)     => API.post({ action: 'deleteGuru', id }),
  getFeeGuru: (bulan)  => API.post({ action: 'getFeeGuru', bulan }),

  // LAPORAN  (materi = [{m:'...', s:1-4}, ...])
  getLaporan:    (opts = {}) => API.post({ action: 'getLaporan', ...opts }),
  addLaporan:    (d)         => API.post({ action: 'addLaporan', ...d }),
  deleteLaporan: (id)        => API.post({ action: 'deleteLaporan', id }),

  // ABSENSI
  getAbsensi:    (opts = {})      => API.post({ action: 'getAbsensi', ...opts }),
  saveAbsensi:   (tanggal, data)  => API.post({ action: 'saveAbsensi', tanggal, data }),
  upsertAbsensi: (d)              => API.post({ action: 'upsertAbsensi', ...d }),

  // INVOICE
  getInvoice:           (opts = {}) => API.post({ action: 'getInvoice', ...opts }),
  generateInvoice:      (d)         => API.post({ action: 'generateInvoice', ...d }),
  updateInvoiceStatus:  (id, status, tgl_kirim) => API.post({ action: 'updateInvoiceStatus', id, status, tgl_kirim }),
  updateInvoiceNominal: (id, sesi, rate, nominal) => API.post({ action: 'updateInvoiceNominal', id, sesi, rate, nominal }),
  deleteInvoice:        (id)        => API.post({ action: 'deleteInvoice', id }),
  uploadBukti: (invoice_id, murid_id, bulan, file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          resolve(await API.post({ action: 'uploadBukti', invoice_id, murid_id, bulan, base64: e.target.result, filename: file.name }));
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }),

  // SETUP
  setup: () => API.post({ action: 'setup' }),
  seed:  () => API.post({ action: 'seed' }),
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
};
