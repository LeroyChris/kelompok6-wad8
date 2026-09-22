import { useState, useMemo, useCallback } from 'react';
import {
  Shield, ChevronDown, Table2, Gavel, Disc,
  X, CheckCircle2, Clock, AlertCircle, AlertTriangle, Search,
  Download, ArrowLeft, CreditCard, RefreshCw, Check,
  MessageCircle, Hash, ExternalLink,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════
   TYPES & CONSTANTS
══════════════════════════════════════════════════════════ */
type TrackType = 'TRACK_A' | 'TRACK_B';
type Status    = 'lunas' | 'pending' | 'belum_bayar';
type FilterKey = 'all' | Status;

interface Member {
  id:       string;
  name:     string;
  initials: string;
  color:    string;
  status:   Status;
  amount:   number;
  date:     string | null;
  method:   string | null;
  hash:     string | null;
}

const fmtRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

const DUES_PER_MEMBER = 1_000_000;

const MEMBERS: Member[] = [
  { id: '1',  name: 'Ahmad Rizky',   initials: 'AR', color: '#F43F5E', status: 'lunas',      amount: DUES_PER_MEMBER, date: '12 Okt 2026', method: 'Virtual Account BCA',    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { id: '2',  name: 'Budi Santoso',  initials: 'BS', color: '#F97316', status: 'lunas',      amount: DUES_PER_MEMBER, date: '11 Okt 2026', method: 'Virtual Account Mandiri', hash: 'a8f5f167f44f4964e6c998dee827110c9a41b48d834cb4c1c1b2d4b07b1fa62c' },
  { id: '3',  name: 'Farrel Abda',   initials: 'FA', color: '#F59E0B', status: 'lunas',      amount: DUES_PER_MEMBER, date: '14 Okt 2026', method: 'QRIS Midtrans',           hash: 'c4ca4238a0b923820dcc509a6f75849b1ce3f9d67598f0e4d34e49b0c33b0f3e' },
  { id: '4',  name: 'Siti Rahma',    initials: 'SR', color: '#10B981', status: 'lunas',      amount: DUES_PER_MEMBER, date: '10 Okt 2026', method: 'GoPay',                   hash: 'd41d8cd98f00b204e9800998ecf8427e3f8a41b99f5af4d5e1a2b3c4d5e6f700' },
  { id: '5',  name: 'Deni Setiawan', initials: 'DS', color: '#06B6D4', status: 'belum_bayar', amount: DUES_PER_MEMBER, date: null,          method: null,                      hash: null },
  { id: '6',  name: 'Rina Wijaya',   initials: 'RW', color: '#8B5CF6', status: 'lunas',      amount: DUES_PER_MEMBER, date: '13 Okt 2026', method: 'OVO',                     hash: 'f1d2e3c4b5a697886950413228171809586734257829101928374655647382910a' },
  { id: '7',  name: 'Eko Prasetyo',  initials: 'EP', color: '#3B82F6', status: 'lunas',      amount: DUES_PER_MEMBER, date: '11 Okt 2026', method: 'Virtual Account BNI',     hash: 'b14a7b8059d9c055954c92674ce60032c6d4f25f1c8b6f2d5b0f654fd9dfdc9a' },
  { id: '8',  name: 'Santi Putri',   initials: 'SP', color: '#EC4899', status: 'lunas',      amount: DUES_PER_MEMBER, date: '12 Okt 2026', method: 'Virtual Account BRI',     hash: 'eccbc87e4b5ce2fe28308fd9f2a7baf3a87ff679a2f3e71d9181a67b7542122c' },
  { id: '9',  name: 'Hendra Budi',   initials: 'HB', color: '#84CC16', status: 'pending',    amount: DUES_PER_MEMBER, date: null,           method: null,                      hash: null },
  { id: '10', name: 'Lestari Dewi',  initials: 'LD', color: '#F97316', status: 'lunas',      amount: DUES_PER_MEMBER, date: '10 Okt 2026', method: 'QRIS Midtrans',           hash: '4e07408562bedb8b60ce05c1decb3462889fbb18c6d4e8b20c66f8e45f9add0d' },
];

const CYCLES = [
  { label: 'Siklus 4 dari 15 (Jatuh Tempo: 25 Okt 2026)', value: 4 },
  { label: 'Siklus 3 dari 15 (Jatuh Tempo: 25 Sep 2026)', value: 3 },
  { label: 'Siklus 2 dari 15 (Jatuh Tempo: 25 Agt 2026)', value: 2 },
  { label: 'Siklus 1 dari 15 (Jatuh Tempo: 25 Jul 2026)',  value: 1 },
];

/* ══════════════════════════════════════════════════════════
   STATUS BADGE CONFIG
══════════════════════════════════════════════════════════ */
const STATUS_CFG: Record<Status, {
  label:  (t: TrackType) => string;
  bg:     string;
  text:   string;
  border: string;
}> = {
  lunas:      { label: () => 'LUNAS',      bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  pending:    { label: () => 'PENDING',    bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-200'   },
  belum_bayar:{ label: (t) => t === 'TRACK_A' ? 'MENUNGGAK' : 'BELUM BAYAR', bg: 'bg-red-100', text: 'text-[#9E002D]', border: 'border-red-200' },
};

/* ══════════════════════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════════════════════ */
function Avatar({ initials, color, size = 'md' }: { initials: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-[10px]' : size === 'lg' ? 'w-12 h-12 text-sm' : 'w-9 h-9 text-xs';
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-black text-white shrink-0 ring-2 ring-white`}
      style={{ background: `linear-gradient(135deg, ${color}cc, ${color})` }}
    >
      {initials}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   RECEIPT MODAL
══════════════════════════════════════════════════════════ */
function ReceiptModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (member.hash) {
      navigator.clipboard.writeText(member.hash).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/50 backdrop-blur-sm lg:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full lg:max-w-md rounded-t-[28px] lg:rounded-3xl shadow-2xl overflow-hidden">
        <div className="w-full flex justify-center pt-3 lg:hidden">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        {/* Navy header */}
        <div className="bg-[#0A2578] px-6 pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-[#5A83DB]" />
              <h2 className="font-black text-base text-white tracking-tight">Detail Resi Pembayaran SHA-256</h2>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 bg-white/10 border border-white/15 rounded-xl px-4 py-3">
            <Avatar initials={member.initials} color={member.color} />
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm text-white">{member.name}</p>
              <p className="text-xs text-white/60 mt-0.5">{fmtRp(member.amount)} · {member.date}</p>
            </div>
            <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-full whitespace-nowrap">
              ✓ LUNAS
            </span>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4 pb-10 lg:pb-6">
          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Timestamp',   value: `${member.date} · 14:22:37 WIB` },
              { label: 'Metode',      value: member.method ?? '—' },
              { label: 'Nominal',     value: fmtRp(member.amount) },
              { label: 'Siklus',      value: 'Siklus 4 dari 15' },
            ].map((d) => (
              <div key={d.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-1">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{d.label}</p>
                <p className="text-xs font-bold text-slate-800 break-words leading-relaxed">{d.value}</p>
              </div>
            ))}
          </div>

          {/* Hash block */}
          <div className="bg-slate-900 rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">SHA-256 Transaction Hash</p>
              <button
                onClick={handleCopy}
                className={`text-[10px] font-bold transition-colors ${copied ? 'text-emerald-400' : 'text-[#5A83DB] hover:text-white'}`}
              >
                {copied ? '✓ Disalin' : 'Salin Hash'}
              </button>
            </div>
            <code className="text-xs text-emerald-400 font-mono break-all leading-relaxed tracking-wide">
              {member.hash}
            </code>
          </div>

          {/* Validation badge */}
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-black text-emerald-800">100% VALIDATED</p>
              <p className="text-xs text-emerald-600 mt-0.5">Hash terverifikasi oleh sistem Audit Trail SHA-256 ArisanKita.</p>
            </div>
          </div>

          <button onClick={onClose} className="w-full py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MANUAL CASH MODAL
══════════════════════════════════════════════════════════ */
function CashModal({
  unpaid, trackType, onClose,
}: { unpaid: Member[]; trackType: TrackType; onClose: () => void }) {
  const [cashMember, setCashMember] = useState('');
  const [cashNote,   setCashNote]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [done,       setDone]       = useState(false);

  const handleConfirm = () => {
    if (!cashMember) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
      setTimeout(() => onClose(), 1500);
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/50 backdrop-blur-sm lg:p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="bg-white w-full lg:max-w-md rounded-t-[28px] lg:rounded-3xl shadow-2xl overflow-hidden">
        <div className="w-full flex justify-center pt-3 lg:hidden">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-lg text-[#0A2578]">Konfirmasi Bayar Cash/Manual</h2>
            <p className="text-xs text-slate-400 mt-0.5">Rekam pembayaran tunai yang diterima Ketua</p>
          </div>
          <button onClick={onClose} disabled={loading} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-30">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="p-8 flex flex-col items-center gap-4 text-center pb-10 lg:pb-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <p className="font-black text-lg text-[#0A2578]">Berhasil Dikonfirmasi!</p>
              <p className="text-sm text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
                Status anggota telah diperbarui ke LUNAS dan dicatat di Audit Trail SHA-256.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-5 pb-10 lg:pb-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#0A2578]">Pilih Anggota</label>
              <div className="relative">
                <select
                  value={cashMember}
                  onChange={(e) => setCashMember(e.target.value)}
                  className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/40 focus:border-[#5A83DB] transition-all bg-slate-50 appearance-none cursor-pointer"
                >
                  <option value="">— Pilih anggota yang membayar —</option>
                  {unpaid.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {STATUS_CFG[m.status].label(trackType)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#0A2578]">Catatan Pembayaran Cash</label>
              <textarea
                value={cashNote}
                onChange={(e) => setCashNote(e.target.value)}
                placeholder="Contoh: Bayar tunai saat kumpul arisan 20 Okt 2026..."
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/40 focus:border-[#5A83DB] transition-all bg-slate-50 resize-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Pastikan Anda sudah menerima uang tunai sebelum mengkonfirmasi. Aksi ini tidak dapat dibatalkan dan akan tercatat permanen di Audit Trail.
              </p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={!cashMember || loading}
              className="w-full bg-[#0A2578] hover:bg-[#0A2578]/90 text-white font-bold py-4 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <><Check className="w-4 h-4" />Konfirmasi Lunas</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function PaymentMatrix({
  onBack,
  trackType     = 'TRACK_A',
  userRole      = 'leader',
  embedded,
  onOpenPayment,
}: {
  onBack:          () => void;
  trackType?:      TrackType;
  userRole?:       'leader' | 'member';
  embedded?:       boolean;
  onOpenPayment?:  () => void;
}) {
  const [filter,       setFilter]       = useState<FilterKey>('all');
  const [search,       setSearch]       = useState('');
  const [cycleOpen,    setCycleOpen]    = useState(false);
  const [activeCycle,  setActiveCycle]  = useState(0);
  const [receiptMember, setReceiptMember] = useState<Member | null>(null);
  const [showCashModal, setShowCashModal] = useState(false);

  const lunasCount   = MEMBERS.filter((m) => m.status === 'lunas').length;
  const pendingCount = MEMBERS.filter((m) => m.status === 'pending').length;
  const overdueCount = MEMBERS.filter((m) => m.status === 'belum_bayar').length;
  const collected    = lunasCount * DUES_PER_MEMBER;
  const target       = MEMBERS.length * DUES_PER_MEMBER;
  const collectedPct = Math.round((collected / target) * 100);

  const filtered = useMemo(() => MEMBERS.filter((m) => {
    const matchFilter = filter === 'all' || m.status === filter;
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  }), [filter, search]);

  const unpaidMembers = MEMBERS.filter((m) => m.status !== 'lunas');

  const handleDownloadCsv = useCallback(() => {
    const rows = [
      ['Nama', 'Status', 'Nominal', 'Tanggal', 'Metode', 'Hash SHA-256'],
      ...MEMBERS.map((m) => [
        m.name,
        STATUS_CFG[m.status].label(trackType),
        String(m.amount),
        m.date ?? '—',
        m.method ?? '—',
        m.hash ?? '—',
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `matriks-siklus-${CYCLES[activeCycle].value}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [activeCycle, trackType]);

  return (
    <div className={embedded ? 'flex-1 flex flex-col overflow-hidden' : 'min-h-screen bg-[#F8FAFC] font-sans antialiased flex flex-col'}>

      {/* ── TOP NAVY HEADER BAR ── */}
      <div className="shrink-0 bg-[#0A2578] text-white px-4 md:px-6 xl:px-8 pt-6 pb-6">
        {/* Breadcrumb when not embedded */}
        {!embedded && (
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Dashboard
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left: title + cycle + progress */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Table2 className="w-5 h-5 text-[#5A83DB]" />
                <h1 className="text-lg font-black tracking-tight">Matriks Pembayaran Iuran Circle</h1>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  trackType === 'TRACK_A'
                    ? 'text-[#5A83DB] bg-[#5A83DB]/20 border-[#5A83DB]/30'
                    : 'text-emerald-300 bg-emerald-500/20 border-emerald-500/30'
                }`}>
                  {trackType === 'TRACK_A' ? 'Track A · Lelang SPSB' : 'Track B · Roda Pengocokan'}
                </span>
                <span className="text-white/40 text-xs">·</span>
                <span className="text-white/60 text-xs">Arisan {trackType === 'TRACK_A' ? 'Alumni 2018' : 'Keluarga Besar'}</span>
              </div>
            </div>

            {/* Cycle dropdown */}
            <div className="relative w-full max-w-[380px]">
              <button
                onClick={() => setCycleOpen((v) => !v)}
                className="w-full flex items-center justify-between bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-white/15 transition-colors"
              >
                <span className="truncate">{CYCLES[activeCycle].label}</span>
                <ChevronDown className={`w-4 h-4 text-white/50 shrink-0 ml-2 transition-transform duration-200 ${cycleOpen ? 'rotate-180' : ''}`} />
              </button>
              {cycleOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0d2d8a] border border-white/15 rounded-xl overflow-hidden shadow-2xl z-20">
                  {CYCLES.map((c, i) => (
                    <button
                      key={c.value}
                      onClick={() => { setActiveCycle(i); setCycleOpen(false); }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-white/10 transition-colors ${
                        i === activeCycle ? 'bg-white/10 font-bold text-white' : 'font-medium text-white/70'
                      }`}
                    >
                      {c.label}
                      {i === activeCycle && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Collection progress */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-base font-black text-white">{fmtRp(collected)} Terkumpul</span>
                <span className="text-sm text-white/50">dari {fmtRp(target)}</span>
              </div>
              <div className="h-2.5 bg-white/15 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${collectedPct}%`,
                    background: 'linear-gradient(90deg, #5A83DB, #34d399)',
                  }}
                />
              </div>
              <div className="flex items-center gap-5 text-xs">
                <span className="text-white/60">
                  <span className="font-black text-emerald-400">{lunasCount}</span> Lunas
                </span>
                <span className="text-white/60">
                  <span className="font-black text-amber-300">{pendingCount}</span> Pending
                </span>
                <span className="text-white/60">
                  <span className="font-black text-red-300">{overdueCount}</span>{' '}
                  {trackType === 'TRACK_A' ? 'Menunggak' : 'Belum Bayar'}
                </span>
                <span className="ml-auto font-black text-[#5A83DB]">{collectedPct}%</span>
              </div>
            </div>
          </div>

          {/* Right: pay CTA box */}
          <div className="lg:col-span-5">
            <div className="bg-white/10 border border-white/15 rounded-2xl p-5 flex flex-col gap-4">
              <div>
                <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mb-1">Iuran Saya — Siklus 4</p>
                <p className="text-3xl font-black text-white">{fmtRp(DUES_PER_MEMBER)}</p>
                <p className="text-xs text-white/50 mt-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Jatuh Tempo 25 Okt 2026
                </p>
              </div>
              <button
                onClick={onOpenPayment}
                className="w-full bg-[#F84A4D] hover:bg-[#e03a3d] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#F84A4D]/30 active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                Bayar Iuran Saya Sekarang
              </button>
              <p className="text-[10px] text-white/40 text-center">Non-Custodial Direct Payment via Payment Gateway BI</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN WORKSPACE ── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 pb-24">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

          {/* ── LEFT: MATRIX TABLE (8 cols) ── */}
          <div className="xl:col-span-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">

              {/* Table toolbar */}
              <div className="p-5 border-b border-slate-100 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="font-black text-base text-[#0A2578]">Detail Pembayaran Anggota</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{MEMBERS.length} anggota · Siklus {CYCLES[activeCycle].value}</p>
                  </div>
                  <button
                    onClick={handleDownloadCsv}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-600 border border-slate-200 px-3.5 py-2 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh Laporan CSV
                  </button>
                </div>

                {/* Filter pills + search */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { key: 'all'         as FilterKey, label: `Semua (${MEMBERS.length})` },
                      { key: 'lunas'       as FilterKey, label: `Lunas (${lunasCount})` },
                      { key: 'pending'     as FilterKey, label: `Pending (${pendingCount})` },
                      { key: 'belum_bayar' as FilterKey, label: `Belum Bayar (${overdueCount})` },
                    ]).map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all border whitespace-nowrap ${
                          filter === f.key
                            ? 'bg-[#0A2578] text-white border-[#0A2578]'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-[#0A2578]/30 hover:text-[#0A2578]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari nama anggota..."
                      className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/30 focus:border-[#5A83DB] transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Anggota', 'Status Iuran', 'Nominal', 'Tanggal & Metode', 'Hash SHA-256', 'Aksi'].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((m, idx) => {
                      const cfg       = STATUS_CFG[m.status];
                      const isOverdue = m.status === 'belum_bayar';
                      const isPending = m.status === 'pending';
                      return (
                        <tr
                          key={m.id}
                          className={`hover:bg-slate-50/80 transition-colors ${isOverdue ? 'bg-red-50/50' : ''}`}
                        >
                          {/* Member */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar initials={m.initials} color={m.color} size="sm" />
                              <div>
                                <p className="text-sm font-bold text-slate-800">{m.name}</p>
                                <p className="text-[10px] text-slate-400">Anggota #{String(idx + 1).padStart(2, '0')}</p>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1.5">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border w-fit ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                {cfg.label(trackType)}
                              </span>
                              {isOverdue && trackType === 'TRACK_A' && (
                                <span className="text-[9px] font-bold text-[#9E002D] flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  +1% Denda Aktif
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="px-5 py-4">
                            <p className="text-sm font-black text-slate-800">{fmtRp(m.amount)}</p>
                            {isOverdue && trackType === 'TRACK_A' && (
                              <p className="text-[10px] font-bold text-[#9E002D] mt-0.5">
                                +{fmtRp(m.amount * 0.01)} denda
                              </p>
                            )}
                          </td>

                          {/* Date & method */}
                          <td className="px-5 py-4">
                            {m.date ? (
                              <div>
                                <p className="text-xs font-semibold text-slate-700">{m.date}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{m.method}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300 italic">—</span>
                            )}
                          </td>

                          {/* Hash */}
                          <td className="px-5 py-4">
                            {m.hash ? (
                              <code className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-lg block max-w-[100px] truncate border border-slate-200">
                                {m.hash.slice(0, 10)}…
                              </code>
                            ) : (
                              <span className="text-xs text-slate-300 italic">—</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="px-5 py-4">
                            {m.status === 'lunas' && (
                              <button
                                onClick={() => setReceiptMember(m)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-[#0A2578] hover:bg-[#0A2578]/5 px-3 py-1.5 rounded-xl transition-colors border border-[#0A2578]/15 whitespace-nowrap"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Lihat Resi
                              </button>
                            )}
                            {isOverdue && trackType === 'TRACK_A' && userRole === 'leader' && (
                              <button className="flex items-center gap-1.5 text-xs font-semibold bg-[#9E002D] hover:bg-[#9E002D]/90 text-white px-3 py-1.5 rounded-xl transition-colors shadow-sm whitespace-nowrap">
                                <AlertTriangle className="w-3 h-3" />
                                Terapkan Denda +1%
                              </button>
                            )}
                            {isOverdue && (trackType === 'TRACK_B' || userRole !== 'leader') && (
                              <button className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl transition-colors shadow-sm whitespace-nowrap">
                                <MessageCircle className="w-3 h-3" />
                                Ingatkan WA
                              </button>
                            )}
                            {isPending && (
                              <button className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap">
                                <Clock className="w-3 h-3" />
                                Cek Status
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-14 text-center">
                          <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-400 font-medium">Tidak ada anggota ditemukan</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── RIGHT: STATS + RECONCILIATION (4 cols) ── */}
          <div className="xl:col-span-4 flex flex-col gap-5">

            {/* Summary card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-5 flex flex-col gap-4">
              <div>
                <h3 className="font-black text-sm text-[#0A2578]">Ringkasan Tagihan Siklus {CYCLES[activeCycle].value}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{MEMBERS.length} anggota total</p>
              </div>

              <div className="flex flex-col gap-2.5">
                {[
                  {
                    label:  'Lunas',
                    count:  lunasCount,
                    amount: lunasCount * DUES_PER_MEMBER,
                    icon:   <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
                    rowCls: 'bg-emerald-50 border-emerald-100',
                    amtCls: 'text-emerald-700',
                  },
                  {
                    label:  'Pending',
                    count:  pendingCount,
                    amount: pendingCount * DUES_PER_MEMBER,
                    icon:   <Clock className="w-4 h-4 text-amber-500" />,
                    rowCls: 'bg-amber-50 border-amber-100',
                    amtCls: 'text-amber-700',
                  },
                  {
                    label:  trackType === 'TRACK_A' ? 'Menunggak' : 'Belum Bayar',
                    count:  overdueCount,
                    amount: overdueCount * DUES_PER_MEMBER,
                    icon:   <AlertCircle className="w-4 h-4 text-[#9E002D]" />,
                    rowCls: 'bg-red-50 border-red-100',
                    amtCls: 'text-[#9E002D]',
                  },
                ].map((s) => (
                  <div key={s.label} className={`flex items-center justify-between p-3 rounded-xl border ${s.rowCls}`}>
                    <div className="flex items-center gap-2.5">
                      {s.icon}
                      <div>
                        <p className="text-xs font-bold text-slate-700">{s.label}</p>
                        <p className="text-[10px] text-slate-400">{s.count} Anggota</p>
                      </div>
                    </div>
                    <p className={`text-xs font-black ${s.amtCls}`}>{fmtRp(s.amount)}</p>
                  </div>
                ))}
              </div>

              {/* Total row */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-500">Total Target Siklus</p>
                  <p className="text-base font-black text-[#0A2578]">{fmtRp(target)}</p>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700"
                    style={{ width: `${collectedPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 text-right font-semibold">{collectedPct}% Terkumpul</p>
              </div>
            </div>

            {/* Manual reconciliation card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-5 flex flex-col gap-4">
              <div>
                <h3 className="font-black text-sm text-[#0A2578]">Rekonsiliasi Pembayaran Manual</h3>
                <p className="text-xs text-slate-400 mt-0.5">Offline / Cash</p>
              </div>

              <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  Bagi anggota yang membayar tunai langsung ke Ketua. Setiap konfirmasi manual dicatat di Audit Trail SHA-256.
                </p>
              </div>

              {userRole === 'leader' && (
                <button
                  onClick={() => setShowCashModal(true)}
                  className="w-full flex items-center justify-center gap-2 border border-slate-300 text-slate-700 hover:border-[#0A2578]/40 hover:text-[#0A2578] hover:bg-[#0A2578]/3 font-bold py-3 rounded-xl transition-all text-sm"
                >
                  <Check className="w-4 h-4" />
                  + Tandai Lunas Manual (Cash)
                </button>
              )}

              <div className="flex items-center gap-2.5 p-3 bg-[#0A2578]/4 border border-[#0A2578]/10 rounded-xl">
                <Shield className="w-4 h-4 text-[#0A2578] shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-[#0A2578] uppercase tracking-wider">Integritas Data Terjamin</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">Setiap transaksi di-hash SHA-256 dan disimpan on-chain circle.</p>
                </div>
              </div>
            </div>

            {/* Track-specific policy card */}
            <div className={`rounded-2xl border p-4 ${
              trackType === 'TRACK_A'
                ? 'bg-[#5A83DB]/5 border-[#5A83DB]/20'
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-center gap-2 mb-2.5">
                {trackType === 'TRACK_A'
                  ? <Gavel className="w-4 h-4 text-[#5A83DB]" />
                  : <Disc className="w-4 h-4 text-emerald-600" />}
                <p className={`text-[10px] font-black uppercase tracking-wider ${
                  trackType === 'TRACK_A' ? 'text-[#0A2578]' : 'text-emerald-800'
                }`}>
                  {trackType === 'TRACK_A' ? 'Kebijakan Denda Track A' : 'Kebijakan Sosial Track B'}
                </p>
              </div>
              <p className={`text-xs leading-relaxed ${
                trackType === 'TRACK_A' ? 'text-slate-600' : 'text-emerald-700'
              }`}>
                {trackType === 'TRACK_A'
                  ? 'Anggota melewati jatuh tempo dikenakan denda 1% per bulan dari nominal iuran. Denda terakumulasi hingga pembayaran diselesaikan.'
                  : 'Tidak ada denda keterlambatan. Ketua akan mengirim notifikasi pengingat via WhatsApp kepada anggota yang belum membayar.'}
              </p>

              {/* Overdue count alert */}
              {overdueCount > 0 && (
                <div className={`mt-3 flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl ${
                  trackType === 'TRACK_A'
                    ? 'bg-red-100 text-[#9E002D] border border-red-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {trackType === 'TRACK_A'
                    ? <><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{overdueCount} anggota menunggak</>
                    : <><MessageCircle className="w-3.5 h-3.5 shrink-0" />{overdueCount} perlu diingatkan</>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── RECEIPT MODAL ── */}
      {receiptMember && (
        <ReceiptModal member={receiptMember} onClose={() => setReceiptMember(null)} />
      )}

      {/* ── MANUAL CASH MODAL ── */}
      {showCashModal && (
        <CashModal
          unpaid={unpaidMembers}
          trackType={trackType}
          onClose={() => setShowCashModal(false)}
        />
      )}
    </div>
  );
}
