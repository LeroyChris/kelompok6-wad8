import React, { useState, useMemo, useEffect, memo, useCallback } from 'react';
import {
  ChevronRight,
  Lock,
  CheckCircle2,
  TrendingUp,
  Clock,
  Zap,
  X,
  Gavel,
  Disc,
  ArrowLeft,
  AlertTriangle,
  Info,
  ShieldCheck,
  Ban,
} from 'lucide-react';


/* ─── Constants ─── */
const POT = 15_000_000;
const FLOOR = 150_000;   // 1% of pot
const CEILING = 3_750_000; // 25% of pot
const DEFAULT_BID = 375_000; // 2.5%

/* ─── Helpers ─── */
function fmtRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}
function fmtPct(n: number) {
  return (n / POT * 100).toFixed(2) + '%';
}
function toSliderPct(bid: number) {
  return Math.round(((bid - FLOOR) / (CEILING - FLOOR)) * 100);
}


/* ─── Countdown Hook ─── */
function useCountdown(initial: number) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  return {
    h: String(Math.floor(secs / 3600)).padStart(2, '0'),
    m: String(Math.floor((secs % 3600) / 60)).padStart(2, '0'),
    s: String(secs % 60).padStart(2, '0'),
    total: secs,
  };
}

/* ─── Isolated Bid Form ─── */
const BidForm = memo(function BidForm({
  onSubmit,
}: {
  onSubmit: (bid: number) => void;
}) {
  const [rawInput, setRawInput] = useState(String(DEFAULT_BID));
  const [touched, setTouched] = useState(false);
  const [sliderVal, setSliderVal] = useState(DEFAULT_BID);

  /* Parse bid amount from raw input, keep NaN/out-of-range as signal */
  const bidAmount = useMemo(() => {
    const n = Number(rawInput.replace(/\D/g, ''));
    return isNaN(n) ? 0 : n;
  }, [rawInput]);

  const isUnder = bidAmount < FLOOR;
  const isOver  = bidAmount > CEILING;
  const isValid = bidAmount >= FLOOR && bidAmount <= CEILING;
  const validationMsg = isUnder
    ? `Minimum penawaran ${fmtRp(FLOOR)} (1% dari pot)`
    : isOver
    ? `Maksimum penawaran ${fmtRp(CEILING)} (25% dari pot)`
    : '';

  /* Live dynamic calculations */
  const { netAmount, effectivePct } = useMemo(() => {
    const safe = isValid ? bidAmount : DEFAULT_BID;
    return {
      netAmount: POT - safe,
      effectivePct: fmtPct(safe),
    };
  }, [bidAmount, isValid]);

  const sliderPct = useMemo(() => toSliderPct(sliderVal), [sliderVal]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTouched(true);
    const raw = e.target.value.replace(/[^\d]/g, '');
    setRawInput(raw);
    const n = Number(raw);
    if (n >= FLOOR && n <= CEILING) setSliderVal(n);
  }, []);

  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setSliderVal(v);
    setRawInput(String(v));
    setTouched(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) { setTouched(true); return; }
    onSubmit(bidAmount);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Range Bounds Info Bar */}
      <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Floor Limit (1%)</p>
          <p className="text-sm font-black text-[#0A2578] font-mono">{fmtRp(FLOOR)}</p>
        </div>
        <div className="flex-1 flex items-center gap-2 justify-center">
          <div className="h-px flex-1 bg-gradient-to-r from-emerald-400 to-[#F84A4D]" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rentang Bid</span>
          <div className="h-px flex-1 bg-gradient-to-r from-[#F84A4D] to-amber-500" />
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ceiling Limit (25%)</p>
          <p className="text-sm font-black text-[#F84A4D] font-mono">{fmtRp(CEILING)}</p>
        </div>
      </div>

      {/* Number Input */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-[#0A2578]">
          Nominal Penawaran Bunga (Rp)
        </label>
        <div className={`flex items-center border-2 rounded-xl overflow-hidden bg-slate-50 transition-all ${
          touched && !isValid
            ? 'border-[#9E002D] bg-red-50/20'
            : 'border-slate-200 focus-within:border-[#5A83DB] focus-within:bg-white'
        }`}>
          <span className="px-4 py-3.5 text-sm font-bold text-slate-500 border-r border-slate-200 bg-slate-100 shrink-0 select-none">Rp</span>
          <input
            type="text"
            inputMode="numeric"
            value={rawInput ? Number(rawInput).toLocaleString('id-ID') : ''}
            onChange={handleInputChange}
            placeholder="375.000"
            className="flex-1 px-4 py-3.5 text-xl font-black font-mono text-[#0A2578] focus:outline-none bg-transparent placeholder:text-slate-300 placeholder:font-normal"
          />
          {touched && isValid && (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-4 shrink-0" />
          )}
          {touched && !isValid && (
            <AlertTriangle className="w-5 h-5 text-[#9E002D] mr-4 shrink-0" />
          )}
        </div>
        {touched && validationMsg && (
          <p className="text-xs font-semibold text-[#9E002D] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Nominal harus berada di rentang 1% - 25% pot. ({validationMsg})
          </p>
        )}
      </div>

      {/* Range Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
          <span>1% · {fmtRp(FLOOR)}</span>
          <span className="text-[#0A2578] font-black">{fmtPct(sliderVal)}</span>
          <span>25% · {fmtRp(CEILING)}</span>
        </div>
        <div className="relative">
          <input
            type="range"
            min={FLOOR}
            max={CEILING}
            step={25_000}
            value={sliderVal}
            onChange={handleSlider}
            className="auction-slider w-full"
            style={{ '--slider-pct': `${sliderPct}%` } as React.CSSProperties}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-300 font-medium px-0.5">
          {[1, 5, 10, 15, 20, 25].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { const v = Math.round(POT * p / 100); setSliderVal(v); setRawInput(String(v)); setTouched(true); }}
              className="hover:text-[#5A83DB] hover:font-bold transition-all"
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {/* Live Dynamic Calculation */}
      <div className="bg-[#FFF6ED] border border-amber-200/80 rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Est. Uang Cair Bersih</p>
          <p className="text-xl font-black text-[#0A2578] font-mono leading-tight">{fmtRp(netAmount)}</p>
          <p className="text-[10px] text-slate-400 font-medium">Pot dikurangi bunga pemenang</p>
        </div>
        <div className="w-px self-stretch bg-amber-200/60" />
        <div className="flex flex-col items-end gap-0.5">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Suku Bunga Efektif</p>
          <span className="text-lg font-black text-[#5A83DB] bg-[#5A83DB]/15 px-3 py-1 rounded-xl font-mono">
            {effectivePct}
          </span>
          <p className="text-[10px] text-slate-400 font-medium">dari total pot</p>
        </div>
      </div>

      {/* Security Microcopy */}
      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
        <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>Terenkripsi SHA-256. Nilai bid Anda tidak dapat dilihat siapapun hingga lelang ditutup.</span>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full bg-[#F84A4D] hover:bg-[#e03a3d] text-white font-bold py-5 text-base rounded-xl shadow-lg shadow-[#F84A4D]/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
      >
        <ShieldCheck className="w-5 h-5" />
        Kirim Penawaran Rahasia
      </button>
    </form>
  );
});

/* ─── Props ─── */
export interface AuctionRoomProps {
  onBack:     () => void;
  trackType?: 'A' | 'B';
  embedded?:  boolean;
}

/* ─── Main Component ─── */
export default function AuctionRoom({
  onBack    = () => {},
  trackType = 'A',
}: AuctionRoomProps) {
  const [confirmBid, setConfirmBid]     = useState<number | null>(null);
  const [submitted, setSubmitted]       = useState(false);
  const [confirmedBid, setConfirmedBid] = useState<number>(DEFAULT_BID);
  const countdown = useCountdown(9879); // ~2h 44m 39s

  const handleBidSubmit = useCallback((bid: number) => {
    setConfirmBid(bid);
  }, []);

  const handleConfirm = () => {
    if (confirmBid !== null) setConfirmedBid(confirmBid);
    setConfirmBid(null);
    setSubmitted(true);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Top Header Bar */}
      <header className="shrink-0 z-20 bg-white border-b border-slate-200/80 px-4 md:px-6 py-3.5 flex items-center gap-3 shadow-sm">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400 flex-1 min-w-0">
            <button onClick={onBack} className="flex items-center gap-1 hover:text-[#0A2578] transition-colors shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Circles</span>
            </button>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <span className="hidden sm:block truncate text-slate-500 font-semibold">Arisan Alumni 2018</span>
            <ChevronRight className="w-3 h-3 shrink-0 hidden sm:block" />
            <span className="font-bold text-[#0A2578] truncate">Room Lelang SPSB (Siklus 4)</span>
          </nav>

          {/* Live Status Pill */}
          <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            BIDDING_OPEN
          </span>
        </header>

        {/* ── Track B Access Guard ── */}
        {trackType === 'B' && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-md p-8 flex flex-col items-center gap-6 text-center">
              <div className="w-16 h-16 rounded-full bg-[#9E002D]/10 flex items-center justify-center">
                <Ban className="w-8 h-8 text-[#9E002D]" />
              </div>
              <div>
                <h2 className="font-black text-lg text-[#0A2578]">Akses Ditolak</h2>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Fitur <span className="font-bold text-[#0A2578]">Lelang SPSB Bunga</span> hanya berlaku untuk{' '}
                  <span className="font-bold text-[#F84A4D]">Track A (Komersial)</span>. Circle Anda menggunakan Track B (Sosial) dengan mekanisme Roda Pengocokan.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-[#FFF6ED] border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 font-semibold w-full justify-center">
                <Disc className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Gunakan menu <span className="font-black mx-1">Roda Pengocokan</span> untuk memilih pemenang siklus.
              </div>
              <button
                onClick={onBack}
                className="w-full py-3.5 bg-[#0A2578] hover:bg-[#0A2578]/90 text-white font-bold rounded-xl transition-all shadow-md shadow-[#0A2578]/20 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        {trackType === 'A' && <main className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 pb-28 lg:pb-10 flex flex-col gap-6">

          {/* ── ROW 1: Auction Timer Hero Card (Navy) ── */}
          <div className="bg-[#0A2578] rounded-2xl p-6 md:p-8 shadow-xl shadow-[#0A2578]/20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">

              {/* Left: Identity */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/20 text-white/80 text-xs font-bold rounded-full">
                    <Gavel className="w-3 h-3 text-[#5A83DB]" />
                    Siklus 4 dari 15
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Bidding Aktif
                  </span>
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-white leading-tight tracking-tight">
                    Lelang SPSB Siklus 4<br />
                    <span className="text-[#5A83DB]">Alokasi Modal Likuiditas</span>
                  </h1>
                </div>
                <div>
                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-1">Total Pot Tersedia</p>
                  <p className="text-4xl md:text-5xl font-extrabold text-white tracking-tight font-mono">Rp 15.000.000</p>
                </div>
                <div className="flex items-start gap-2 bg-white/8 border border-white/15 rounded-xl px-4 py-3">
                  <Info className="w-4 h-4 text-[#5A83DB] shrink-0 mt-0.5" />
                  <p className="text-xs text-white/70 leading-relaxed">
                    <span className="font-bold text-white">Mekanisme SPSB:</span> Penawar bunga tertinggi memenangkan pot, tetapi hanya membayar bunga senilai penawaran tertinggi kedua. Bidder lain tidak tahu nilai penawaranmu.
                  </p>
                </div>
              </div>

              {/* Right: Countdown Timer */}
              <div className="lg:col-span-5">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 md:p-6 border border-white/20 text-center flex flex-col gap-4">
                  <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Sisa Waktu Penawaran Rahasia</p>

                  {/* Timer Digits */}
                  <div className="flex items-center justify-center gap-2 md:gap-3">
                    {[{ val: countdown.h, label: 'JAM' }, { val: countdown.m, label: 'MNT' }, { val: countdown.s, label: 'DET' }].map(({ val, label }, i) => (
                      <React.Fragment key={label}>
                        <div className="flex flex-col items-center gap-1">
                          <div className="bg-[#0A2578] border border-white/20 rounded-xl px-4 py-3 min-w-[56px]">
                            <span className="text-2xl md:text-3xl font-black text-[#F84A4D] font-mono tabular-nums">{val}</span>
                          </div>
                          <span className="text-[9px] font-bold text-white/40 tracking-widest">{label}</span>
                        </div>
                        {i < 2 && <span className="text-2xl font-black text-white/30 mb-4">:</span>}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Progress bar for urgency */}
                  <div className="flex flex-col gap-1.5">
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-[#F84A4D] rounded-full transition-all duration-1000"
                        style={{ width: `${(countdown.total / (3 * 3600)) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-white/40 font-medium">Bidding menutup: 20 Okt 2026, 23:59</p>
                  </div>

                  {submitted && (
                    <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-3 py-2.5 text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <p className="text-xs font-bold">Penawaran terkunci. Menunggu penutupan lelang.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 2: Bento Workspace Grid ── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

            {/* ── LEFT 7 COLS: Sealed Bid Form ── */}
            <div className="xl:col-span-7">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 flex flex-col gap-6">

                {/* Form Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-black text-[#0A2578] text-base">Input Penawaran Bunga Rahasia</h2>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Sealed Bid — tidak dapat diubah setelah dikunci</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#0A2578]/6 border border-[#0A2578]/15 px-3 py-1.5 rounded-xl text-xs font-bold text-[#0A2578] shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#5A83DB]" />
                    100% Confidential
                  </div>
                </div>

                {submitted ? (
                  /* ── State B: Locked / Post-Submit ── */
                  <div className="flex flex-col gap-5">
                    {/* Green locked badge */}
                    <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-emerald-800">Penawaran Terkunci</p>
                        <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                          <ShieldCheck className="w-3 h-3" /> SHA-256 Encrypted
                        </p>
                      </div>
                    </div>

                    {/* Summary card */}
                    <div className="bg-[#FFF6ED] border border-amber-200/80 rounded-2xl p-5 flex flex-col gap-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ringkasan Penawaran Anda</p>
                      {[
                        { label: 'Bunga Diajukan', value: `${fmtRp(confirmedBid)} (${fmtPct(confirmedBid)})`, highlight: true },
                        { label: 'Est. Uang Cair', value: fmtRp(POT - confirmedBid), highlight: false },
                        { label: 'Status',         value: 'Menunggu penutupan lelang', highlight: false },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-500 font-medium">{row.label}</span>
                          <span className={`text-sm font-black font-mono text-right ${row.highlight ? 'text-[#F84A4D]' : 'text-[#0A2578]'}`}>
                            {row.value}
                          </span>
                        </div>
                      ))}
                      <div className="pt-3 border-t border-amber-200/60">
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          Hasil diumumkan setelah bidding ditutup: 20 Okt 2026, 23:59
                        </div>
                      </div>
                    </div>

                    {/* Unlock / change button */}
                    <button
                      onClick={() => setSubmitted(false)}
                      className="w-full py-3.5 text-sm font-bold text-[#0A2578] border-2 border-slate-300 hover:border-[#0A2578]/40 hover:bg-[#0A2578]/3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Ubah Penawaran
                    </button>
                  </div>
                ) : (
                  <BidForm onSubmit={handleBidSubmit} />
                )}
              </div>
            </div>

            {/* ── RIGHT 5 COLS ── */}
            <div className="xl:col-span-5 flex flex-col gap-5">

              {/* Card 1: SPSB Visual Explanation */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-[#0A2578] text-sm">Bagaimana Lelang SPSB Bekerja?</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Game Theory Visual Diagram</p>
                  </div>
                  <div className="w-8 h-8 bg-[#5A83DB]/10 rounded-lg flex items-center justify-center">
                    <Info className="w-4 h-4 text-[#5A83DB]" />
                  </div>
                </div>
                <div className="p-5 flex flex-col gap-3">
                  {[
                    {
                      step: '01',
                      color: 'bg-[#5A83DB]',
                      title: 'Semua Bid Rahasia',
                      desc: 'Setiap anggota memasukkan penawaran bunga secara tersegel. Tidak ada yang tahu nilai bid orang lain.',
                      icon: <Lock className="w-4 h-4" />,
                    },
                    {
                      step: '02',
                      color: 'bg-amber-500',
                      title: 'Pemenang = Bid Tertinggi',
                      desc: 'Anggota dengan penawaran bunga tertinggi (misal: 3.0%) memenangkan pot arisan siklus ini.',
                      icon: <TrendingUp className="w-4 h-4" />,
                    },
                    {
                      step: '03',
                      color: 'bg-emerald-500',
                      title: 'Bayar Bunga Tertinggi Kedua',
                      desc: 'Pemenang HANYA membayar nilai bunga tertinggi kedua (misal: 2.5%). Selisih 0.5% = hemat Rp 75.000!',
                      icon: <CheckCircle2 className="w-4 h-4" />,
                    },
                  ].map((s) => (
                    <div key={s.step} className="flex gap-3">
                      <div className={`w-8 h-8 ${s.color} rounded-xl flex items-center justify-center text-white shrink-0`}>
                        {s.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-black text-slate-300 font-mono">STEP {s.step}</span>
                          <p className="text-sm font-bold text-[#0A2578]">{s.title}</p>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}

                  {/* Visual Example */}
                  <div className="mt-2 bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contoh Simulasi</p>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { label: 'Ahmad (Pemenang)', bid: '3.0%', pay: '2.5%', winner: true },
                        { label: 'Farrel (Highest 2nd)', bid: '2.5%', pay: '—', winner: false },
                        { label: 'Budi', bid: '2.0%', pay: '—', winner: false },
                      ].map((r) => (
                        <div key={r.label} className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${r.winner ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-slate-100'}`}>
                          <span className={`font-semibold ${r.winner ? 'text-emerald-800' : 'text-slate-600'}`}>{r.label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400">Bid: <span className="font-bold text-slate-700">{r.bid}</span></span>
                            {r.winner && <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-md">Bayar: {r.pay}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Historical Wins */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-[#0A2578] text-sm">Riwayat Bunga Kemenangan</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Siklus lalu — SPSB Final Results</p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-[#5A83DB]" />
                </div>
                <div className="p-5 flex flex-col gap-3">
                  {[
                    { cycle: 1, name: 'Siti Rahma',   initials: 'SR', top: '2.8%', paid: '2.5%', color: 'from-purple-500 to-purple-700', saved: 'Rp 45.000' },
                    { cycle: 2, name: 'Eko Prasetyo', initials: 'EP', top: '3.5%', paid: '3.0%', color: 'from-sky-500 to-sky-700',    saved: 'Rp 75.000' },
                    { cycle: 3, name: 'Rina Wijaya',  initials: 'RW', top: '2.0%', paid: '1.8%', color: 'from-emerald-500 to-emerald-700', saved: 'Rp 30.000' },
                  ].map((w) => (
                    <div key={w.cycle} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${w.color} flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white shrink-0`}>
                        {w.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{w.name}</p>
                        <p className="text-[10px] text-slate-400">Siklus {w.cycle}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Bid:</span>
                          <span className="text-[10px] font-bold text-slate-600 line-through">{w.top}</span>
                          <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">{w.paid}</span>
                        </div>
                        <span className="text-[9px] text-emerald-600 font-semibold">Hemat {w.saved}</span>
                      </div>
                    </div>
                  ))}

                  {/* Average Rate */}
                  <div className="mt-1 flex items-center justify-between text-xs font-semibold text-slate-400 bg-[#0A2578]/4 rounded-xl px-3 py-2.5 border border-[#0A2578]/10">
                    <span>Rata-rata SPSB clearing rate</span>
                    <span className="font-black text-[#0A2578]">2.43% / siklus</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>}

      {/* ── Mobile Fixed Bottom Dock ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#0A2578]/97 backdrop-blur-md text-white px-4 py-3 border-t border-white/10 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] text-white/50 font-bold uppercase tracking-wide">Sisa Waktu Bidding</p>
            <p className="text-sm font-black text-[#F84A4D] font-mono tabular-nums">
              {countdown.h}j : {countdown.m}m : {countdown.s}d
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {submitted ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-3 py-2 rounded-xl">
                <CheckCircle2 className="w-3.5 h-3.5" /> Bid Terkunci
              </span>
            ) : (
              <button
                onClick={() => {/* scroll to form */}}
                className="bg-[#F84A4D] hover:bg-[#e03a3d] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-[#F84A4D]/30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" /> Kirim Bid
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Bid Confirmation Modal ── */}
      {confirmBid !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/55 backdrop-blur-sm lg:p-4"
          onClick={(e) => e.target === e.currentTarget && setConfirmBid(null)}
        >
          <div className="bg-white w-full lg:max-w-md rounded-t-[28px] lg:rounded-3xl shadow-2xl overflow-hidden">
            <div className="w-full flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-black text-lg text-[#0A2578]">Konfirmasi Penawaran Rahasia</h2>
                <p className="text-xs text-slate-400 mt-0.5">Periksa sebelum mengunci bid Anda</p>
              </div>
              <button onClick={() => setConfirmBid(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5 pb-10 lg:pb-6">
              {/* Summary */}
              <div className="bg-[#FFF6ED] border border-amber-200/80 rounded-2xl p-5 flex flex-col gap-4">
                {[
                  { label: 'Nominal Bid (Bunga)', value: fmtRp(confirmBid), accent: true },
                  { label: 'Est. Dana Cair Bersih', value: fmtRp(POT - confirmBid), accent: false },
                  { label: 'Suku Bunga Efektif', value: fmtPct(confirmBid), accent: false },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">{row.label}</span>
                    <span className={`text-sm font-black ${row.accent ? 'text-[#F84A4D]' : 'text-[#0A2578]'} font-mono`}>{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 border-t border-amber-200/60">
                  <span className="text-sm text-slate-500 font-medium">Status Enkripsi</span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    SHA-256 Encrypted
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 text-center leading-relaxed">
                Setelah dikunci, nilai penawaran <span className="font-bold text-slate-600">tidak dapat diubah</span> hingga lelang ditutup. Pastikan nilai sudah benar.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmBid(null)}
                  className="flex-1 py-3 text-sm font-bold text-[#0A2578] border-2 border-[#0A2578]/20 hover:border-[#0A2578]/50 hover:bg-[#0A2578]/4 rounded-xl transition-all"
                >
                  Ubah Penawaran
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-3 text-sm font-bold text-white bg-[#F84A4D] hover:bg-[#e03a3d] rounded-xl shadow-md shadow-[#F84A4D]/25 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Ya, Kunci Penawaran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
