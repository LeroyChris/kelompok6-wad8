import React, { useState, useCallback, useRef } from 'react';
import {
  HandCoins, FileCheck2, X, Users, Clock, CheckCircle2,
  ArrowLeft, Disc, Plus, AlertCircle, CreditCard, QrCode,
  Wallet, TrendingUp, Calendar, ChevronRight, Receipt,
  BadgeCheck, Banknote,
} from 'lucide-react';

/* ─── Types ─── */
type CampaignType = 'loan' | 'voluntary';
type PayMethod  = 'bca' | 'mandiri' | 'qris' | 'gopay' | 'ovo';

/* ─── Static Data ─── */
const fmtRp = (n: number) =>
  'Rp ' + n.toLocaleString('id-ID');

const CONTRIBUTORS = [
  { name: 'Ahmad Rizky',   initials: 'AR', color: '#F43F5E', amount: 500_000,   time: '10 Mnt lalu'  },
  { name: 'Farrel Abda',   initials: 'FA', color: '#F59E0B', amount: 1_000_000, time: '1 Jam lalu'   },
  { name: 'Siti Rahma',    initials: 'SR', color: '#10B981', amount: 250_000,   time: 'Kemarin'      },
  { name: 'Deni Setiawan', initials: 'DS', color: '#06B6D4', amount: 500_000,   time: 'Kemarin'      },
  { name: 'Rina Wijaya',   initials: 'RW', color: '#8B5CF6', amount: 750_000,   time: '2 Hari lalu'  },
  { name: 'Eko Prasetyo',  initials: 'EP', color: '#3B82F6', amount: 250_000,   time: '3 Hari lalu'  },
  { name: 'Santi Putri',   initials: 'SP', color: '#EC4899', amount: 250_000,   time: '4 Hari lalu'  },
  { name: 'Hendra Budi',   initials: 'HB', color: '#84CC16', amount: 100_000,   time: '5 Hari lalu'  },
  { name: 'Lestari Dewi',  initials: 'LD', color: '#F97316', amount: 150_000,   time: '5 Hari lalu'  },
];

const PAST_CAMPAIGNS = [
  {
    title: 'Patungan Sewa Lapangan Futsal',
    type: 'voluntary' as CampaignType,
    target: 1_500_000,
    collected: 1_500_000,
    donorCount: 12,
    closedAt: 'Mar 2026',
  },
  {
    title: 'Top-Up Modal Usaha Santi',
    type: 'loan' as CampaignType,
    target: 3_000_000,
    collected: 3_000_000,
    donorCount: 8,
    closedAt: 'Jan 2026',
  },
];

const QUICK_AMOUNTS = [50_000, 100_000, 250_000];
const MAX_TARGET = 5_000_000;
const FEATURED_COLLECTED = 3_750_000;
const FEATURED_TARGET    = 5_000_000;
const FEATURED_PCT       = Math.round((FEATURED_COLLECTED / FEATURED_TARGET) * 100);


/* ─── Payment method config ─── */
const PAY_METHODS: Array<{ id: PayMethod; label: string; sub: string; icon: React.ReactNode; color: string }> = [
  { id: 'bca',     label: 'Virtual Account BCA',     sub: 'Transfer via m-BCA / ATM',       icon: <CreditCard className="w-4 h-4" />, color: '#0038a8' },
  { id: 'mandiri', label: 'Virtual Account Mandiri',  sub: 'Transfer via Livin / ATM',       icon: <CreditCard className="w-4 h-4" />, color: '#003f88' },
  { id: 'qris',    label: 'QRIS Midtrans',            sub: 'Scan QR dari aplikasi manapun',  icon: <QrCode className="w-4 h-4" />,     color: '#e31837' },
  { id: 'gopay',   label: 'GoPay',                    sub: 'Bayar via aplikasi Gojek',       icon: <Wallet className="w-4 h-4" />,     color: '#00AA13' },
  { id: 'ovo',     label: 'OVO',                      sub: 'Bayar via aplikasi OVO',         icon: <Wallet className="w-4 h-4" />,     color: '#4c3494' },
];

/* ─── Sub-components ─── */
function MemberDot({ initials, color, size = 'md' }: { initials: string; color: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-black text-white shrink-0 ring-2 ring-white`}
      style={{ background: `linear-gradient(135deg, ${color}cc, ${color})` }}
    >
      {initials}
    </div>
  );
}

/* ─── Props ─── */
export interface CrowdfundingProps {
  onBack:                () => void;
  onNavigateToAuction?:  () => void;
  onNavigateToSpin?:     () => void;
  embedded?:             boolean;
}

/* ─── Main Component ─── */
export default function Crowdfunding({
  onBack               = () => {},
}: CrowdfundingProps) {
  /* UI state */
  const [showCreateModal, setCreateModal] = useState(false);
  const [showCheckout, setCheckout]       = useState(false);
  const [selectedQuick, setSelectedQuick] = useState<number | null>(null);
  const [customAmount, setCustomAmount]   = useState('');
  const [showCustom, setShowCustom]       = useState(false);
  const [payMethod, setPayMethod]         = useState<PayMethod | null>(null);
  const [checkoutDone, setCheckoutDone]   = useState(false);

  /* Create campaign form */
  const [cTitle, setCTitle]           = useState('');
  const [cType, setCType]             = useState<CampaignType>('loan');
  const [cTarget, setCTarget]         = useState('');
  const [cDays, setCDays]             = useState('');
  const [cTargetErr, setCTargetErr]   = useState('');
  const [cSubmitted, setCSubmitted]   = useState(false);

  const customRef = useRef<HTMLInputElement>(null);

  /* Derived pledge amount */
  const pledgeAmount = showCustom
    ? (parseInt(customAmount.replace(/\D/g, ''), 10) || 0)
    : (selectedQuick ?? 0);

  const handleQuickSelect = useCallback((amt: number) => {
    setSelectedQuick(amt);
    setShowCustom(false);
    setCustomAmount('');
  }, []);

  const handleCustomToggle = useCallback(() => {
    setShowCustom(true);
    setSelectedQuick(null);
    setTimeout(() => customRef.current?.focus(), 60);
  }, []);

  const validateTarget = useCallback((val: string) => {
    const n = parseInt(val.replace(/\D/g, ''), 10);
    if (!val) { setCTargetErr(''); return; }
    if (isNaN(n) || n <= 0) { setCTargetErr('Masukkan nominal yang valid.'); return; }
    if (n > MAX_TARGET) { setCTargetErr(`Batas maksimal pinjaman terikat sesuai batas risiko Circle (Maks. ${fmtRp(MAX_TARGET)}).`); return; }
    setCTargetErr('');
  }, []);

  const handleCreateSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(cTarget.replace(/\D/g, ''), 10);
    if (cTargetErr || !cTitle || !cTarget || isNaN(n) || n > MAX_TARGET) return;
    setCSubmitted(true);
    setTimeout(() => { setCreateModal(false); setCSubmitted(false); setCTitle(''); setCTarget(''); setCDays(''); }, 1500);
  }, [cTargetErr, cTitle, cTarget]);

  const handleCheckoutPay = useCallback(() => {
    if (!payMethod || pledgeAmount <= 0) return;
    setCheckoutDone(true);
    setTimeout(() => { setCheckout(false); setCheckoutDone(false); setPayMethod(null); setSelectedQuick(null); setCustomAmount(''); setShowCustom(false); }, 2000);
  }, [payMethod, pledgeAmount]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Top bar */}
      <header className="shrink-0 z-20 bg-white border-b border-slate-200/80 px-4 md:px-6 py-3.5 flex items-center gap-3 shadow-sm">
          <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400 flex-1 min-w-0">
            <button onClick={onBack} className="flex items-center gap-1 hover:text-[#0A2578] transition-colors shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Dashboard</span>
            </button>
            <span className="mx-0.5 text-slate-300">›</span>
            <span className="font-bold text-[#0A2578] truncate">Patungan Internal</span>
          </nav>
          <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5A83DB]/10 text-[#0A2578] text-xs font-bold rounded-full border border-[#5A83DB]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5A83DB] animate-pulse" />
            Track A · SPSB
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 pb-24 flex flex-col gap-6">

          {/* ── Hero Bar ── */}
          <div className="bg-[#0A2578] rounded-2xl p-6 md:p-8 shadow-xl shadow-[#0A2578]/20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/20 text-white/80 text-xs font-bold rounded-full">
                    <HandCoins className="w-3 h-3 text-[#5A83DB]" />
                    Closed-Loop · Anggota Saja
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-full">
                    <TrendingUp className="w-3 h-3" />
                    1 Kampanye Aktif
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
                  Patungan Modal Internal Circle
                </h1>
                <p className="text-sm text-white/60 max-w-lg leading-relaxed">
                  Fasilitas patungan modal & donasi tertutup khusus anggota Circle Arisan Alumni 2018. Transparan, teraudit, dan bebas bunga eksternal.
                </p>
              </div>
              <button
                onClick={() => setCreateModal(true)}
                className="shrink-0 flex items-center gap-2 bg-[#F84A4D] hover:bg-[#e03a3d] text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-[#F84A4D]/30 transition-all active:scale-[0.97] whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Buat Kampanye Patungan
              </button>
            </div>

            {/* Stats row */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: 'Total Terkumpul', value: 'Rp 3.750.000', icon: <Banknote className="w-3.5 h-3.5" />, sub: 'Siklus berjalan' },
                { label: 'Total Kontributor', value: '9 Anggota', icon: <Users className="w-3.5 h-3.5" />, sub: 'dari 15 anggota' },
                { label: 'Sisa Waktu', value: '12 Hari', icon: <Calendar className="w-3.5 h-3.5" />, sub: 'Kampanye aktif' },
              ].map((s) => (
                <div key={s.label} className="bg-white/10 border border-white/15 rounded-xl p-3.5">
                  <div className="flex items-center gap-1.5 text-white/50 text-[10px] font-bold uppercase tracking-wider mb-1">
                    {s.icon} {s.label}
                  </div>
                  <p className="text-base font-extrabold text-white leading-none">{s.value}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bento Grid ── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

            {/* ── LEFT 7 COLS: Featured Campaign ── */}
            <div className="xl:col-span-7 flex flex-col gap-5">

              {/* Active Campaign Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-lg border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      KAMPANYE AKTIF
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#5A83DB]/12 text-[#0A2578] text-xs font-bold rounded-lg border border-[#5A83DB]/20">
                      <Receipt className="w-3 h-3" />
                      Top-Up Loan Intern
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-[#0A2578] leading-tight">
                    Tambahan Modal Toko Sembako Budi
                  </h2>
                </div>

                {/* Creator info */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <MemberDot initials="BS" color="#F97316" size="sm" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">Budi Santoso</p>
                      <p className="text-[10px] text-[#5A83DB] font-semibold">Pemenang Siklus 3</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto text-xs text-slate-500 font-medium bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
                    <Clock className="w-3.5 h-3.5" />
                    Sisa <span className="font-black text-[#0A2578] mx-0.5">12</span> Hari
                  </div>
                </div>

                {/* Repayment note (Type A specific) */}
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">
                    <span className="font-bold">Cicilan pinjaman</span> akan dipotong otomatis dari iuran bulan depan. Batas risiko Circle: Maks. {fmtRp(MAX_TARGET)}.
                  </p>
                </div>

                {/* Progress section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Terkumpul</p>
                      <p className="text-2xl font-black text-[#0A2578] font-mono leading-none">
                        {fmtRp(FEATURED_COLLECTED)}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        dari target <span className="font-bold text-slate-700">{fmtRp(FEATURED_TARGET)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black" style={{ color: FEATURED_PCT >= 100 ? '#059669' : '#5A83DB' }}>
                        {FEATURED_PCT}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
                      style={{
                        width: `${FEATURED_PCT}%`,
                        background: 'linear-gradient(to right, #5A83DB, #059669)',
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                    </div>
                  </div>

                  {/* Contributor avatars */}
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {CONTRIBUTORS.slice(0, 5).map((c) => (
                        <div
                          key={c.name}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black text-white ring-2 ring-white shrink-0"
                          style={{ background: c.color }}
                          title={c.name}
                        >
                          {c.initials}
                        </div>
                      ))}
                      <div className="w-7 h-7 rounded-full bg-slate-200 ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                        +{CONTRIBUTORS.length - 5}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      <span className="font-bold text-slate-700">{CONTRIBUTORS.length} kontributor</span> telah berpartisipasi
                    </p>
                  </div>
                </div>

                {/* Quick amount selector */}
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-black text-[#0A2578] uppercase tracking-wider">Pilih Nominal Patungan</p>
                  <div className="grid grid-cols-4 gap-2.5">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => handleQuickSelect(amt)}
                        className={`py-3 px-2 text-sm font-bold rounded-xl border transition-all ${
                          selectedQuick === amt && !showCustom
                            ? 'bg-[#0A2578] text-white border-[#0A2578] shadow-md shadow-[#0A2578]/20'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#5A83DB] hover:text-[#0A2578]'
                        }`}
                      >
                        {fmtRp(amt).replace('Rp ', '')}
                      </button>
                    ))}
                    <button
                      onClick={handleCustomToggle}
                      className={`py-3 px-2 text-sm font-bold rounded-xl border transition-all ${
                        showCustom
                          ? 'bg-[#0A2578] text-white border-[#0A2578] shadow-md shadow-[#0A2578]/20'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#5A83DB] hover:text-[#0A2578]'
                      }`}
                    >
                      Lainnya
                    </button>
                  </div>

                  {showCustom && (
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">Rp</span>
                      <input
                        ref={customRef}
                        type="text"
                        inputMode="numeric"
                        value={customAmount}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '');
                          setCustomAmount(raw ? parseInt(raw, 10).toLocaleString('id-ID') : '');
                        }}
                        placeholder="0"
                        className="w-full pl-10 pr-4 py-3.5 border border-[#5A83DB] rounded-xl text-sm font-bold text-[#0A2578] focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/30 bg-[#5A83DB]/4"
                      />
                    </div>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={() => pledgeAmount > 0 && setCheckout(true)}
                  className={`w-full font-extrabold py-5 text-lg rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg ${
                    pledgeAmount > 0
                      ? 'bg-[#F84A4D] hover:bg-[#e03a3d] text-white shadow-[#F84A4D]/30 active:scale-[0.98]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  disabled={pledgeAmount <= 0}
                >
                  <HandCoins className="w-6 h-6" />
                  {pledgeAmount > 0
                    ? `Ikut Patungan — ${fmtRp(pledgeAmount)}`
                    : 'Pilih Nominal untuk Melanjutkan'}
                </button>
              </div>

              {/* Campaign Info Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 grid grid-cols-3 gap-4">
                {[
                  { label: 'Jenis Pendanaan', value: 'Top-Up Loan Intern', icon: <Receipt className="w-4 h-4 text-[#5A83DB]" /> },
                  { label: 'Batas Risiko Circle', value: fmtRp(MAX_TARGET), icon: <AlertCircle className="w-4 h-4 text-amber-500" /> },
                  { label: 'Cicilan Otomatis', value: 'Bulan Depan', icon: <BadgeCheck className="w-4 h-4 text-emerald-600" /> },
                ].map((info) => (
                  <div key={info.label} className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">{info.icon}<p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{info.label}</p></div>
                    <p className="text-sm font-black text-[#0A2578] leading-tight">{info.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT 5 COLS ── */}
            <div className="xl:col-span-5 flex flex-col gap-5">

              {/* Card 1: Contributor Transparency */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-[#0A2578] text-sm">Transparansi Kontributor Internal</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{CONTRIBUTORS.length} kontributor berpartisipasi</p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-[#5A83DB] bg-[#5A83DB]/10 px-2 py-1 rounded-lg">
                    <Users className="w-3 h-3" />
                    {CONTRIBUTORS.length}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {CONTRIBUTORS.slice(0, 6).map((c) => (
                    <div key={c.name} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                      <MemberDot initials={c.initials} color={c.color} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Patungan · {c.time}</p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-sm font-black text-emerald-700">{fmtRp(c.amount)}</span>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 self-end" />
                      </div>
                    </div>
                  ))}
                </div>
                {CONTRIBUTORS.length > 6 && (
                  <button className="w-full px-5 py-3 text-xs font-bold text-[#5A83DB] hover:text-[#0A2578] hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 border-t border-slate-100">
                    Lihat {CONTRIBUTORS.length - 6} kontributor lainnya
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Card 2: Completed Campaigns */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-[#0A2578] text-sm">Riwayat Kampanye Selesai</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{PAST_CAMPAIGNS.length} kampanye berhasil</p>
                  </div>
                  <Disc className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="p-5 flex flex-col gap-3">
                  {PAST_CAMPAIGNS.map((p) => (
                    <div key={p.title} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-800 leading-tight">{p.title}</p>
                        <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                          100% ✓
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                          p.type === 'loan'
                            ? 'bg-[#5A83DB]/12 text-[#0A2578]'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {p.type === 'loan' ? 'Top-Up Loan Intern' : 'Patungan Sukarela'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{p.donorCount} kontributor · {p.closedAt}</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
                      </div>
                      <p className="text-xs font-black text-emerald-700">{fmtRp(p.collected)} TERPENUHI</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 3: SHA-256 Audit */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-black text-[#0A2578] text-sm">Audit Trail SHA-256</h3>
                  <FileCheck2 className="w-4 h-4 text-[#5A83DB]" />
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <div className="bg-slate-900 rounded-xl px-3.5 py-3 flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Kontribusi Hash · Live</p>
                      <p className="text-[10px] text-emerald-400 font-mono truncate">7d4f2e9a1b3c5d8f...e6a2b1c9</p>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0">VALID</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Setiap transaksi patungan direkam secara kriptografis. Tidak ada manipulasi yang mungkin dilakukan pihak manapun.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

      {/* ══════════════════════════════════
          MODAL 1: Create Campaign
      ══════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/60 backdrop-blur-sm lg:p-4">
          <div className="bg-white w-full lg:max-w-lg rounded-t-[32px] lg:rounded-3xl shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col">
            {/* Drag handle */}
            <div className="w-full flex justify-center pt-3 pb-1 lg:hidden shrink-0">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="font-black text-lg text-[#0A2578]">Buat Kampanye Baru</h2>
                <p className="text-xs text-slate-400 mt-0.5">Hanya anggota aktif yang dapat melihat kampanye ini.</p>
              </div>
              <button
                onClick={() => setCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="overflow-y-auto flex-1">
              <div className="p-6 flex flex-col gap-5 pb-10 lg:pb-6">

                {/* Judul */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-black text-[#0A2578]">Judul Kampanye</label>
                  <input
                    type="text"
                    value={cTitle}
                    onChange={(e) => setCTitle(e.target.value)}
                    placeholder="Contoh: Tambahan Modal Usaha Warung"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/30 focus:border-[#5A83DB] bg-slate-50 transition-all"
                    required
                  />
                </div>

                {/* Campaign type radio */}
                <div className="flex flex-col gap-2.5">
                  <label className="text-sm font-black text-[#0A2578]">Jenis Kampanye</label>
                  <div className="flex flex-col gap-2">
                    {[
                      {
                        value: 'loan' as CampaignType,
                        label: 'Top-Up Loan Intern',
                        sub: 'Cicilan dipotong otomatis pada iuran bulan berikutnya.',
                        icon: <Receipt className="w-4 h-4" />,
                      },
                      {
                        value: 'voluntary' as CampaignType,
                        label: 'Patungan Kas / Sponsorship',
                        sub: 'Donasi Sukarela Komunal — tanpa kewajiban pengembalian.',
                        icon: <HandCoins className="w-4 h-4" />,
                      },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          cType === opt.value
                            ? 'border-[#0A2578] bg-[#0A2578]/4'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="campaignType"
                          value={opt.value}
                          checked={cType === opt.value}
                          onChange={() => setCType(opt.value)}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          cType === opt.value ? 'border-[#0A2578] bg-[#0A2578]' : 'border-slate-300'
                        }`}>
                          {cType === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cType === opt.value ? 'text-[#0A2578]' : 'text-slate-400'}>{opt.icon}</span>
                            <p className={`text-sm font-black ${cType === opt.value ? 'text-[#0A2578]' : 'text-slate-700'}`}>{opt.label}</p>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{opt.sub}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Target nominal */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-black text-[#0A2578]">Target Nominal</label>
                  <div className={`flex border-2 rounded-xl overflow-hidden transition-all ${
                    cTargetErr
                      ? 'border-[#9E002D] bg-red-50'
                      : cTarget && !cTargetErr
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 focus-within:border-[#5A83DB]'
                  }`}>
                    <span className="bg-slate-100 border-r border-slate-200 px-4 flex items-center text-sm font-bold text-slate-500 shrink-0">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cTarget}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        const display = raw ? parseInt(raw, 10).toLocaleString('id-ID') : '';
                        setCTarget(display);
                        validateTarget(display);
                      }}
                      placeholder="0 — maks. 5.000.000"
                      className="w-full px-4 py-3 text-sm font-bold focus:outline-none bg-transparent placeholder:font-normal placeholder:text-slate-400"
                      required
                    />
                  </div>
                  {cTargetErr ? (
                    <p className="flex items-start gap-1.5 text-xs text-[#9E002D] font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {cTargetErr}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium">Batas maksimal pinjaman terikat sesuai batas risiko Circle (Maks. {fmtRp(MAX_TARGET)})</p>
                  )}
                </div>

                {/* Batas waktu */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-black text-[#0A2578]">Batas Waktu</label>
                  <div className="flex border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-[#5A83DB] bg-slate-50 transition-all">
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={cDays}
                      onChange={(e) => setCDays(e.target.value)}
                      placeholder="30"
                      className="flex-1 px-4 py-3 text-sm font-bold focus:outline-none bg-transparent placeholder:font-normal placeholder:text-slate-400"
                      required
                    />
                    <span className="bg-slate-100 border-l border-slate-200 px-4 flex items-center text-sm font-bold text-slate-500 shrink-0">Hari</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!!cTargetErr || !cTitle || !cTarget || !cDays || cSubmitted}
                  className={`w-full py-4 font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md ${
                    cSubmitted
                      ? 'bg-emerald-500 text-white'
                      : !!cTargetErr || !cTitle || !cTarget || !cDays
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-[#F84A4D] hover:bg-[#e03a3d] text-white shadow-[#F84A4D]/25 active:scale-[0.98]'
                  }`}
                >
                  {cSubmitted
                    ? <><CheckCircle2 className="w-5 h-5" /> Kampanye Diterbitkan!</>
                    : <><Plus className="w-5 h-5" /> Terbitkan Kampanye</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          MODAL 2: Checkout / Pledge
      ══════════════════════════════════ */}
      {showCheckout && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/60 backdrop-blur-sm lg:p-4">
          <div className="bg-white w-full lg:max-w-md rounded-t-[32px] lg:rounded-3xl shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col">
            <div className="w-full flex justify-center pt-3 pb-1 lg:hidden shrink-0">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="font-black text-lg text-[#0A2578]">Checkout Patungan</h2>
                <p className="text-xs text-slate-400 mt-0.5">Konfirmasi & pilih metode pembayaran</p>
              </div>
              <button onClick={() => { setCheckout(false); setPayMethod(null); setCheckoutDone(false); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-5 pb-10 lg:pb-6">

              {/* Summary */}
              <div className="bg-[#0A2578]/4 border border-[#0A2578]/12 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#0A2578] rounded-xl flex items-center justify-center shrink-0">
                    <HandCoins className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 font-medium">Kampanye</p>
                    <p className="text-sm font-black text-[#0A2578] leading-tight">Tambahan Modal Toko Sembako Budi</p>
                    <p className="text-[10px] text-[#5A83DB] font-bold mt-0.5">Top-Up Loan Intern · Sisa 12 Hari</p>
                  </div>
                </div>
                <div className="border-t border-[#0A2578]/10 pt-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-600">Total Patungan Anda</p>
                  <p className="text-xl font-black text-[#0A2578] font-mono">{fmtRp(pledgeAmount)}</p>
                </div>
              </div>

              {/* Payment method */}
              <div className="flex flex-col gap-2.5">
                <p className="text-sm font-black text-[#0A2578]">Metode Pembayaran</p>
                <div className="flex flex-col gap-2">
                  {PAY_METHODS.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        payMethod === m.id
                          ? 'border-[#0A2578] bg-[#0A2578]/4'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payMethod"
                        value={m.id}
                        checked={payMethod === m.id}
                        onChange={() => setPayMethod(m.id)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        payMethod === m.id ? 'border-[#0A2578] bg-[#0A2578]' : 'border-slate-300'
                      }`}>
                        {payMethod === m.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${m.color}18`, color: m.color }}
                      >
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-black ${payMethod === m.id ? 'text-[#0A2578]' : 'text-slate-700'}`}>{m.label}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{m.sub}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pay CTA */}
              <button
                onClick={handleCheckoutPay}
                disabled={!payMethod || pledgeAmount <= 0 || checkoutDone}
                className={`w-full py-4 font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${
                  checkoutDone
                    ? 'bg-emerald-500 text-white'
                    : !payMethod || pledgeAmount <= 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-[#F84A4D] hover:bg-[#e03a3d] text-white shadow-[#F84A4D]/25 active:scale-[0.98]'
                }`}
              >
                {checkoutDone
                  ? <><CheckCircle2 className="w-5 h-5" /> Pembayaran Berhasil!</>
                  : <><CreditCard className="w-5 h-5" /> Konfirmasi & Bayar Patungan</>}
              </button>

              <p className="text-center text-[10px] text-slate-400 leading-relaxed">
                Pembayaran diproses oleh Midtrans (lisensi PJP BI). Data tersimpan terenkripsi SHA-256. Tidak ada uang yang disimpan oleh ArisanKita.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
