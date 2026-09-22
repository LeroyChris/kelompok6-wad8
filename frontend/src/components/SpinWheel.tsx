import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Disc, FileCheck2, Trophy, Users, History,
  CheckCircle2, Clock, Gavel, Lock, ArrowLeft, ShieldAlert,
  Sparkles, Phone,
} from 'lucide-react';

/* ─── Types ─── */
type WheelState = 'idle' | 'spinning' | 'done';
type UserRole   = 'leader' | 'member';

/* ─── Wheel Data ─── */
const MEMBERS = [
  { name: 'Ahmad',  fullName: 'Ahmad Rizky',    initials: 'AR', color: '#F43F5E' },
  { name: 'Budi',   fullName: 'Budi Santoso',   initials: 'BS', color: '#F97316' },
  { name: 'Farrel', fullName: 'Farrel Abda',    initials: 'FA', color: '#F59E0B' },
  { name: 'Siti',   fullName: 'Siti Rahma',     initials: 'SR', color: '#10B981' },
  { name: 'Deni',   fullName: 'Deni Setiawan',  initials: 'DS', color: '#06B6D4' },
  { name: 'Rina',   fullName: 'Rina Wijaya',    initials: 'RW', color: '#8B5CF6' },
  { name: 'Eko',    fullName: 'Eko Prasetyo',   initials: 'EP', color: '#3B82F6' },
  { name: 'Santi',  fullName: 'Santi Putri',    initials: 'SP', color: '#EC4899' },
];

const PAST_WINNERS = [
  { cycle: 1, name: 'Siti Rahma',   initials: 'SR', color: '#10B981', amount: 'Rp 10.000.000' },
  { cycle: 2, name: 'Eko Prasetyo', initials: 'EP', color: '#3B82F6', amount: 'Rp 10.000.000' },
  { cycle: 3, name: 'Rina Wijaya',  initials: 'RW', color: '#8B5CF6', amount: 'Rp 10.000.000' },
];

const N         = MEMBERS.length;   // 8
const SLICE_DEG = 360 / N;          // 45°
const CX = 180, CY = 180;           // SVG center
const R  = 155;                     // wheel radius
const SPIN_MS = 5000;

/* ─── SVG Helpers ─── */
const deg2rad = (d: number) => (d * Math.PI) / 180;

function getPiePath(i: number): string {
  const s = -90 + i * SLICE_DEG;
  const e = -90 + (i + 1) * SLICE_DEG;
  const x1 = (CX + R * Math.cos(deg2rad(s))).toFixed(3);
  const y1 = (CY + R * Math.sin(deg2rad(s))).toFixed(3);
  const x2 = (CX + R * Math.cos(deg2rad(e))).toFixed(3);
  const y2 = (CY + R * Math.sin(deg2rad(e))).toFixed(3);
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`;
}

function getLabelTransform(i: number): string {
  const midDeg = -90 + i * SLICE_DEG + SLICE_DEG / 2;
  const lr = R * 0.63;
  const lx = (CX + lr * Math.cos(deg2rad(midDeg))).toFixed(3);
  const ly = (CY + lr * Math.sin(deg2rad(midDeg))).toFixed(3);
  return `translate(${lx}, ${ly}) rotate(${midDeg + 90})`;
}


/* ─── Track A Access Guard (module-level, no closure capture) ─── */
function TrackAGuard({ onNavigateToAuction }: { onNavigateToAuction?: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-md p-8 flex flex-col items-center gap-5 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <h2 className="font-black text-lg text-[#0A2578]">Akses Terbatas</h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Circle ini menggunakan <span className="font-bold text-[#0A2578]">Track A (Komersial)</span>. Fitur Roda Pengocokan hanya berlaku untuk{' '}
            <span className="font-bold text-emerald-700">Track B (Sosial & Keluarga)</span>.
          </p>
        </div>
        <div className="w-full bg-[#FFF6ED] border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 font-semibold flex items-center gap-2 justify-center">
          <Gavel className="w-3.5 h-3.5 shrink-0" />
          Gunakan <span className="font-black mx-1">Room Lelang SPSB</span> untuk alokasi pot.
        </div>
        <button
          onClick={onNavigateToAuction}
          className="w-full py-3.5 bg-[#F84A4D] hover:bg-[#e03a3d] text-white font-bold rounded-xl transition-all shadow-md shadow-[#F84A4D]/20 flex items-center justify-center gap-2"
        >
          <Gavel className="w-4 h-4" />
          Ke Room Lelang SPSB
        </button>
      </div>
    </div>
  );
}

/* ─── Avatar Stack ─── */
/* ─── Props ─── */
export interface SpinWheelProps {
  onBack:               () => void;
  trackType?:           'A' | 'B';
  userRole?:            UserRole;
  duesPct?:             number;
  onNavigateToAuction?: () => void;
  embedded?:            boolean;
}

/* ─── Main Component ─── */
export default function SpinWheel({
  onBack              = () => {},
  trackType           = 'B',
  userRole            = 'leader',
  duesPct             = 100,
  onNavigateToAuction,
}: SpinWheelProps) {
  const [wheelState, setWheelState]   = useState<WheelState>('idle');
  const [rotation, setRotation]       = useState(0);
  const [winnerIdx, setWinnerIdx]     = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDuesLocked = duesPct < 100;
  const pendingCount = Math.round(((100 - duesPct) / 100) * N);
  const canSpin      = userRole === 'leader' && !isDuesLocked && wheelState === 'idle';

  const handleSpin = useCallback(() => {
    if (!canSpin) return;
    const winner = Math.floor(Math.random() * N);
    // spec: Angle = (360×5) + (360 − winner_index×(360/N)), with half-slice centering
    const currentVisual = ((rotation % 360) + 360) % 360;
    const targetDeg     = (360 - (winner * SLICE_DEG + SLICE_DEG / 2) + 360) % 360;
    const delta         = (targetDeg - currentVisual + 360) % 360 || 360;
    const newRot        = rotation + 1800 + delta; // 5 full spins + landing offset

    setWinnerIdx(winner);
    setRotation(newRot);
    setWheelState('spinning');

    timerRef.current = setTimeout(() => setWheelState('done'), SPIN_MS + 400);
  }, [canSpin, rotation]);

  const handleCloseWinner = useCallback(() => {
    setWheelState('idle');
    setWinnerIdx(null);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const winner = winnerIdx !== null ? MEMBERS[winnerIdx] : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Top Bar */}
      <header className="shrink-0 z-20 bg-white border-b border-slate-200/80 px-4 md:px-6 py-3.5 flex items-center gap-3 shadow-sm">
          <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400 flex-1 min-w-0">
            <button onClick={onBack} className="flex items-center gap-1 hover:text-[#0A2578] transition-colors shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Dashboard</span>
            </button>
            <span className="mx-0.5 text-slate-300">›</span>
            <span className="font-bold text-[#0A2578] truncate">Roda Pengocokan (Siklus 4)</span>
          </nav>
          <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Track B · Sosial
          </span>
        </header>

        {/* Track A Guard or Main Content */}
        {trackType === 'A' ? <TrackAGuard onNavigateToAuction={onNavigateToAuction} /> : (
          <main className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 pb-24 flex flex-col gap-6">

            {/* ── Hero Summary Card (Navy) ── */}
            <div className="bg-[#0A2578] rounded-2xl p-6 md:p-8 shadow-xl shadow-[#0A2578]/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/20 text-white/80 text-xs font-bold rounded-full">
                      <Disc className="w-3 h-3 text-emerald-400" />
                      Siklus 4 dari 15
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      {duesPct === 100
                        ? `Iuran: ${N}/${N} LUNAS (100%)`
                        : `Iuran: ${N - pendingCount}/${N} Lunas (${duesPct}%)`}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Total Pot Dimenangkan</p>
                    <p className="text-4xl font-extrabold text-white font-mono tracking-tight mt-1">Rp 10.000.000</p>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed max-w-md">
                    Pengocokan acak transparan tanpa bunga. Setiap anggota memiliki peluang yang sama untuk memenangkan pot arisan siklus ini.
                  </p>
                </div>

                {/* Dues Progress */}
                <div className="bg-white/10 border border-white/15 rounded-2xl p-5 min-w-[200px]">
                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-3">Status Pengumpulan Iuran</p>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-2xl font-extrabold text-white font-mono">{duesPct}%</span>
                    <span className="text-xs text-white/50 font-medium mb-0.5">terkumpul</span>
                  </div>
                  <div className="h-2 bg-white/15 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${duesPct}%`,
                        background: duesPct === 100
                          ? 'linear-gradient(to right, #34d399, #10b981)'
                          : 'linear-gradient(to right, #f59e0b, #f97316)',
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-white/40 font-medium mt-2">
                    {N - pendingCount}/{N} anggota sudah bayar
                  </p>
                </div>
              </div>
            </div>

            {/* ── Bento Grid ── */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

              {/* ── LEFT 7 COLS: Spin Wheel Board ── */}
              <div className="xl:col-span-7">
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 flex flex-col items-center gap-5">
                  {/* Card Header */}
                  <div className="w-full flex items-center justify-between">
                    <div>
                      <h2 className="font-black text-[#0A2578] text-base">Roda Pengocokan</h2>
                      <p className="text-xs text-slate-400 mt-0.5">{N} anggota eligibel · Siklus 4</p>
                    </div>
                    {wheelState === 'spinning' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-full animate-pulse">
                        <Disc className="w-3.5 h-3.5 animate-spin" />
                        Sedang Berputar...
                      </span>
                    )}
                    {wheelState === 'idle' && winnerIdx === null && (
                      <span className="text-xs text-slate-400 font-medium">Siap diputar</span>
                    )}
                  </div>

                  {/* Wheel Container */}
                  <div className="relative w-full max-w-[340px] select-none">
                    {/* Top pointer */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 -translate-y-1">
                      <div
                        style={{
                          width: 0,
                          height: 0,
                          borderLeft: '12px solid transparent',
                          borderRight: '12px solid transparent',
                          borderTop: '22px solid #F84A4D',
                          filter: 'drop-shadow(0 2px 4px rgba(248,74,77,0.5))',
                        }}
                      />
                    </div>

                    {/* SVG Wheel */}
                    <div className="relative rounded-full overflow-hidden shadow-2xl shadow-slate-400/30 ring-4 ring-white">
                      <svg
                        viewBox="0 0 360 360"
                        className="w-full"
                        style={{ display: 'block' }}
                      >
                        {/* Rotating group */}
                        <g
                          style={{
                            transform: `rotate(${rotation}deg)`,
                            transformOrigin: '50% 50%',
                            transition: wheelState === 'spinning'
                              ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.90, 0.20, 1.00)`
                              : 'none',
                          }}
                        >
                          {/* Slices */}
                          {MEMBERS.map((m, i) => (
                            <path
                              key={i}
                              d={getPiePath(i)}
                              fill={m.color}
                              stroke="white"
                              strokeWidth="2.5"
                            />
                          ))}

                          {/* Labels */}
                          {MEMBERS.map((m, i) => (
                            <g key={`label-${i}`} transform={getLabelTransform(i)}>
                              <text
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="12"
                                fontWeight="800"
                                fill="white"
                                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                              >
                                {m.name}
                              </text>
                            </g>
                          ))}
                        </g>

                        {/* Center cap — static (not in rotating group) */}
                        <circle cx={CX} cy={CY} r={34} fill="white" />
                        <circle cx={CX} cy={CY} r={30} fill="#0A2578" />
                        <circle cx={CX} cy={CY} r={25} fill="#1a3490" />
                        {/* Shield icon centered at (180,180), ~22px tall */}
                        <path
                          d="M180 168 L192 172 L192 181 C192 187.6 186.6 193 180 195 C173.4 193 168 187.6 168 181 L168 172 Z"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    {/* Dues Lock Overlay */}
                    {isDuesLocked && (
                      <div className="absolute inset-0 rounded-full bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-center px-6">
                        <div className="w-12 h-12 bg-amber-500/20 border border-amber-400/40 rounded-full flex items-center justify-center">
                          <Lock className="w-6 h-6 text-amber-300" />
                        </div>
                        <p className="text-sm font-bold text-white leading-tight">
                          Pengocokan dikunci sampai iuran<br />terkumpul 100%
                        </p>
                        <p className="text-xs text-amber-300 font-semibold">
                          ({pendingCount} Anggota Belum Bayar)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Spin CTA or Member Wait Badge */}
                  {userRole === 'leader' ? (
                    <button
                      onClick={handleSpin}
                      disabled={!canSpin}
                      className={`w-full max-w-sm font-extrabold py-5 text-lg rounded-xl transition-all flex items-center justify-center gap-3 ${
                        canSpin
                          ? 'bg-[#F84A4D] hover:bg-[#e03a3d] text-white shadow-xl shadow-[#F84A4D]/30 active:scale-[0.97]'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Disc className={`w-6 h-6 ${wheelState === 'spinning' ? 'animate-spin' : ''}`} />
                      {wheelState === 'spinning' ? 'Sedang Berputar...' : isDuesLocked ? 'Iuran Belum Lengkap' : 'PUTAR RODA SEKARANG'}
                    </button>
                  ) : (
                    <div className="w-full max-w-sm flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
                      <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-amber-800">Menunggu Ketua Circle</p>
                        <p className="text-xs text-amber-600 mt-0.5">Menunggu Ketua Circle Memutar Roda Pengocokan...</p>
                      </div>
                    </div>
                  )}

                  {/* Past winner result bar */}
                  {wheelState === 'idle' && winnerIdx !== null && (
                    <div
                      className="w-full max-w-sm flex items-center gap-3 rounded-xl px-4 py-3.5 border"
                      style={{ background: `${MEMBERS[winnerIdx].color}15`, borderColor: `${MEMBERS[winnerIdx].color}40` }}
                    >
                      <Trophy className="w-4 h-4 shrink-0" style={{ color: MEMBERS[winnerIdx].color }} />
                      <p className="text-sm font-bold" style={{ color: MEMBERS[winnerIdx].color }}>
                        Pemenang Siklus 4: <span className="font-black">{MEMBERS[winnerIdx].fullName}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT 5 COLS ── */}
              <div className="xl:col-span-5 flex flex-col gap-5">

                {/* Card 1: Eligible Members */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-[#0A2578] text-sm">Anggota Eligibel Putaran Ini</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Siklus 4 — {MEMBERS.length} anggota di roda</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#0A2578]/8 px-2.5 py-1 rounded-full text-[10px] font-bold text-[#0A2578]">
                      <Users className="w-3 h-3" />
                      {N} anggota
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-2.5">
                    {MEMBERS.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors"
                        style={{ borderColor: `${m.color}30`, background: `${m.color}08` }}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 ring-1 ring-white"
                          style={{ background: m.color }}
                        >
                          {m.initials}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 truncate">{m.fullName}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card 2: Historical Winners */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-[#0A2578] text-sm">Pemenang Historis</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Siklus-siklus sebelumnya</p>
                    </div>
                    <History className="w-4 h-4 text-[#5A83DB]" />
                  </div>
                  <div className="p-5 flex flex-col gap-3">
                    {PAST_WINNERS.map((w) => (
                      <div key={w.cycle} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white shrink-0"
                          style={{ background: `linear-gradient(135deg, ${w.color}cc, ${w.color})` }}
                        >
                          {w.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{w.name}</p>
                          <p className="text-[10px] text-slate-400">Siklus {w.cycle} · Roda Pengocokan</p>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">{w.amount}</span>
                          <span className="text-[9px] text-slate-400 mt-0.5">Langsung cair</span>
                        </div>
                      </div>
                    ))}

                    {/* Stats row */}
                    <div className="mt-1 flex items-center justify-between text-xs font-semibold bg-[#0A2578]/4 rounded-xl px-3 py-2.5 border border-[#0A2578]/10">
                      <span className="text-slate-400">Rata-rata Pot / Siklus</span>
                      <span className="font-black text-[#0A2578]">Rp 10.000.000</span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Audit Trail & Transparansi */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-[#0A2578] text-sm">Audit Trail & Transparansi</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Log kriptografis real-time</p>
                    </div>
                    <FileCheck2 className="w-4 h-4 text-[#5A83DB]" />
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    {/* SHA-256 Log Badge */}
                    <div className="flex items-center gap-2.5 bg-slate-900 rounded-xl px-3.5 py-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">SHA-256 Log · Siklus 4</p>
                        <p className="text-[10px] text-emerald-400 font-mono truncate">
                          a3f9b1c2d4e5f6...7890abcd
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0">
                        VALID
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Sistem pengocokan terenkripsi tanpa manipulasi. Setiap hasil diverifikasi on-chain dan dapat diaudit publik kapan saja.
                    </p>

                    {/* Transparency Pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {['Zero-Bias RNG', 'On-chain Verify', 'Immutable Log'].map((tag) => (
                        <span key={tag} className="text-[10px] font-bold text-[#0A2578] bg-[#0A2578]/8 border border-[#0A2578]/15 px-2 py-1 rounded-lg">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

      {/* ── Winner Celebration Modal ── */}
      {wheelState === 'done' && winner && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/60 backdrop-blur-sm lg:p-4">
          <div className="bg-white w-full lg:max-w-md rounded-t-[32px] lg:rounded-3xl shadow-2xl overflow-hidden">
            {/* Drag handle */}
            <div className="w-full flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
            </div>

            {/* Celebration Header */}
            <div
              className="px-6 pt-6 pb-8 text-center flex flex-col items-center gap-4"
              style={{ background: `linear-gradient(135deg, ${winner.color}18, ${winner.color}08)` }}
            >
              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: winner.color }}>
                <Sparkles className="w-4 h-4" />
                Selamat kepada Pemenang Siklus 4!
                <Sparkles className="w-4 h-4" />
              </div>

              <div className="relative">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black text-white ring-4 ring-white shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${winner.color}dd, ${winner.color})` }}
                >
                  {winner.initials}
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center ring-2 ring-white">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black text-[#0A2578]">{winner.fullName}</h2>
                <p className="text-sm text-slate-500 mt-0.5">Pemenang Roda Pengocokan · Siklus 4</p>
              </div>

              <div
                className="text-3xl font-extrabold font-mono"
                style={{ color: winner.color }}
              >
                Rp 10.000.000
              </div>
            </div>

            {/* Auto-disbursement status */}
            <div className="px-6 py-4 border-y border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700">Status Auto-Disbursement</p>
                <p className="text-xs text-emerald-700 font-semibold mt-0.5">Pencairan Berhasil: Sent via Payment Gateway BI</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg shrink-0">
                Berhasil ✓
              </span>
            </div>

            {/* Actions */}
            <div className="p-6 flex flex-col gap-3 pb-10 lg:pb-6">
              <button
                onClick={() => {
                  const msg = encodeURIComponent(
                    `🎉 Selamat ${winner.fullName}! Kamu memenangkan pot Arisan Keluarga Besar Siklus 4 sebesar *Rp 10.000.000* via ArisanKita! 🏆`
                  );
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 text-sm font-bold text-white rounded-xl transition-all active:scale-[0.97] shadow-md"
                style={{ background: '#25D366' }}
              >
                <Phone className="w-4 h-4" />
                Kirim Ucapan Selamat via WhatsApp
              </button>
              <button
                onClick={handleCloseWinner}
                className="w-full py-3.5 text-sm font-bold text-[#0A2578] border-2 border-slate-200 hover:border-[#0A2578]/30 hover:bg-[#0A2578]/5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <FileCheck2 className="w-4 h-4" />
                Tutup & Lihat Resi SHA-256
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
