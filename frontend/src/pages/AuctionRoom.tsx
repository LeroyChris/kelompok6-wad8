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

import { circleAuctionService } from '../services/circleAuctionService';

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
          {touched && isValid && <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-4 shrink-0" />}
          {touched && !isValid && <AlertTriangle className="w-5 h-5 text-[#9E002D] mr-4 shrink-0" />}
        </div>
        {touched && validationMsg && (
          <p className="text-xs font-semibold text-[#9E002D] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Nominal harus berada di rentang 1% - 25% pot. ({validationMsg})
          </p>
        )}
      </div>

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
      </div>

      <div className="bg-[#FFF6ED] border border-amber-200/80 rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Est. Uang Cair Bersih</p>
          <p className="text-xl font-black text-[#0A2578] font-mono leading-tight">{fmtRp(netAmount)}</p>
        </div>
        <div className="w-px self-stretch bg-amber-200/60" />
        <div className="flex flex-col items-end gap-0.5">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Suku Bunga Efektif</p>
          <span className="text-lg font-black text-[#5A83DB] bg-[#5A83DB]/15 px-3 py-1 rounded-xl font-mono">
            {effectivePct}
          </span>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-[#F84A4D] hover:bg-[#e03a3d] text-white font-bold py-5 text-base rounded-xl shadow-lg shadow-[#F84A4D]/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <ShieldCheck className="w-5 h-5" />
        Kirim Penawaran Rahasia
      </button>
    </form>
  );
});

export interface AuctionRoomProps {
  onBack:     () => void;
  trackType?: 'A' | 'B';
  embedded?:  boolean;
}

export default function AuctionRoom({
  onBack    = () => {},
  trackType = 'A',
}: AuctionRoomProps) {
  const [confirmBid, setConfirmBid]     = useState<number | null>(null);
  const [submitted, setSubmitted]       = useState(false);
  const [confirmedBid, setConfirmedBid] = useState<number>(DEFAULT_BID);
  const countdown = useCountdown(9879);

  const handleBidSubmit = useCallback((bid: number) => {
    setConfirmBid(bid);
  }, []);

  const handleConfirm = async () => {
    if (confirmBid === null) return;
    try {
      await circleAuctionService.submitBid('cyc-uuid-002', confirmBid);
      setConfirmedBid(confirmBid);
      setConfirmBid(null);
      setSubmitted(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengirim penawaran lelang ke server Go');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="shrink-0 z-20 bg-white border-b border-slate-200/80 px-4 md:px-6 py-3.5 flex items-center gap-3 shadow-sm">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400 flex-1 min-w-0">
          <button onClick={onBack} className="flex items-center gap-1 hover:text-[#0A2578] transition-colors shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Circles</span>
          </button>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="font-bold text-[#0A2578] truncate">Room Lelang SPSB (Siklus 4)</span>
        </nav>
      </header>

      {trackType === 'A' && (
        <main className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 pb-28 lg:pb-10 flex flex-col gap-6">
          <div className="bg-[#0A2578] rounded-2xl p-6 md:p-8 shadow-xl">
            <h1 className="text-xl md:text-2xl font-black text-white">Lelang SPSB Siklus 4</h1>
            <p className="text-3xl font-extrabold text-white font-mono mt-2">Rp 15.000.000</p>
          </div>

          <div className="bg-white rounded-2xl border p-6">
            {submitted ? (
              <div className="flex flex-col gap-4">
                <p className="text-emerald-700 font-bold">Penawaran Terkunci!</p>
                <button onClick={() => setSubmitted(false)} className="py-2 border rounded-xl">Ubah Penawaran</button>
              </div>
            ) : (
              <BidForm onSubmit={handleBidSubmit} />
            )}
          </div>
        </main>
      )}

      {confirmBid !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl flex flex-col gap-4">
            <h3 className="font-black text-[#0A2578] text-lg">Konfirmasi Penawaran</h3>
            <p className="text-sm font-mono text-[#F84A4D] font-bold">{fmtRp(confirmBid)}</p>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setConfirmBid(null)} className="flex-1 py-3 border rounded-xl">Batal</button>
              <button onClick={handleConfirm} className="flex-1 py-3 bg-[#F84A4D] text-white font-bold rounded-xl">Kunci Bid</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}