import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Disc, FileCheck2, Trophy, Users, History,
  CheckCircle2, Clock, Gavel, Lock, ArrowLeft, ShieldAlert,
  Sparkles, Phone, RefreshCw,
} from 'lucide-react';
import { circleAuctionService } from '../services/circleAuctionService';

/* ─── Types ─── */
type WheelState = 'idle' | 'spinning' | 'done';
type UserRole   = 'leader' | 'member';

interface MemberCandidate {
  name:           string;
  fullName:       string;
  initials:       string;
  color:          string;
  participant_id: string;
}

const PAST_WINNERS = [
  { cycle: 1, name: 'Siti Rahma',   initials: 'SR', color: '#10B981', amount: 'Rp 10.000.000' },
  { cycle: 2, name: 'Eko Prasetyo', initials: 'EP', color: '#3B82F6', amount: 'Rp 10.000.000' },
  { cycle: 3, name: 'Rina Wijaya',  initials: 'RW', color: '#8B5CF6', amount: 'Rp 10.000.000' },
];

const COLORS = ['#F43F5E', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#3B82F6', '#EC4899'];

const CX = 180, CY = 180;
const R  = 155;
const SPIN_MS = 5000;

const deg2rad = (d: number) => (d * Math.PI) / 180;

function getPiePath(i: number, sliceDeg: number): string {
  const s = -90 + i * sliceDeg;
  const e = -90 + (i + 1) * sliceDeg;
  const x1 = (CX + R * Math.cos(deg2rad(s))).toFixed(3);
  const y1 = (CY + R * Math.sin(deg2rad(s))).toFixed(3);
  const x2 = (CX + R * Math.cos(deg2rad(e))).toFixed(3);
  const y2 = (CY + R * Math.sin(deg2rad(e))).toFixed(3);
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`;
}

function getLabelTransform(i: number, sliceDeg: number): string {
  const midDeg = -90 + i * sliceDeg + sliceDeg / 2;
  const lr = R * 0.63;
  const lx = (CX + lr * Math.cos(deg2rad(midDeg))).toFixed(3);
  const ly = (CY + lr * Math.sin(deg2rad(midDeg))).toFixed(3);
  return `translate(${lx}, ${ly}) rotate(${midDeg + 90})`;
}

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

export interface SpinWheelProps {
  onBack:               () => void;
  trackType?:           'A' | 'B';
  userRole?:            UserRole;
  duesPct?:             number;
  onNavigateToAuction?: () => void;
  embedded?:            boolean;
}

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
  const [members, setMembers]         = useState<MemberCandidate[]>([]);
  const [loading, setLoading]         = useState(true);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Fetch Partisipan Real dari API Backend Go
  useEffect(() => {
    let isMounted = true;
    const fetchParticipants = async () => {
      try {
        setLoading(true);
        // Memanggil GET /api/v1/cycles/cyc-uuid-002/participants
        const res = await circleAuctionService.getParticipants('cyc-uuid-002');
        if (res.data?.data && isMounted) {
          const list: MemberCandidate[] = res.data.data.map((item: any, idx: number) => ({
            name: (item.name || 'User').split(' ')[0],
            fullName: item.name || 'User',
            initials: item.initials || 'US',
            color: COLORS[idx % COLORS.length],
            participant_id: item.participant_id || `par-${idx}`,
          }));
          setMembers(list);
        }
      } catch (err) {
        console.warn('Gagal memuat kandidat dari backend Go, menggunakan fallback.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchParticipants();
    return () => { isMounted = false; };
  }, []);

  const N         = members.length > 0 ? members.length : 1;
  const SLICE_DEG = 360 / N;
  const isDuesLocked = duesPct < 100;
  const canSpin      = userRole === 'leader' && !isDuesLocked && wheelState === 'idle' && !loading && members.length > 0;

  // 2. Putar Roda Berdasarkan Pemenang Real dari API Backend Go
  const handleSpin = useCallback(async () => {
    if (!canSpin) return;

    try {
      setWheelState('spinning');
      // Memanggil POST /api/v1/cycles/cyc-uuid-002/draw
      const res = await circleAuctionService.executeDraw('cyc-uuid-002');
      
      let targetWinnerIdx = 0;
      if (res.data?.data?.winner) {
        const winnerObj = res.data.data.winner;
        const found = members.findIndex(
          (m) => m.fullName === winnerObj.name || m.name === winnerObj.name || m.participant_id === winnerObj.participant_id
        );
        if (found !== -1) targetWinnerIdx = found;
      }

      // Rumus Rotasi Presisi: 5 putaran penuh (1800°) + landing offset ke tengah-tengah slice pemenang
      const currentVisual = ((rotation % 360) + 360) % 360;
      const targetDeg     = (360 - (targetWinnerIdx * SLICE_DEG + SLICE_DEG / 2) + 360) % 360;
      const delta         = (targetDeg - currentVisual + 360) % 360 || 360;
      const newRot        = rotation + 1800 + delta;

      setWinnerIdx(targetWinnerIdx);
      setRotation(newRot);

      timerRef.current = setTimeout(() => {
        setWheelState('done');
      }, SPIN_MS + 300);
    } catch (err) {
      alert('Gagal mengeksekusi pengundian acak di server Go.');
      setWheelState('idle');
    }
  }, [canSpin, rotation, members, SLICE_DEG]);

  const handleCloseWinner = useCallback(() => {
    setWheelState('idle');
    setWinnerIdx(null);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const winner = winnerIdx !== null && members[winnerIdx] ? members[winnerIdx] : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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

      {trackType === 'A' ? <TrackAGuard onNavigateToAuction={onNavigateToAuction} /> : (
        <main className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 pb-24 flex flex-col gap-6">

          {/* Hero Summary Card */}
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
                    Iuran: {members.length}/{members.length} LUNAS (100%)
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Total Pot Dimenangkan</p>
                  <p className="text-4xl font-extrabold text-white font-mono tracking-tight mt-1">Rp 5.000.000</p>
                </div>
                <p className="text-xs text-white/60 leading-relaxed max-w-md">
                  Pengocokan acak transparan tanpa bunga via API Go. Setiap anggota memiliki peluang yang sama.
                </p>
              </div>

              <div className="bg-white/10 border border-white/15 rounded-2xl p-5 min-w-[200px]">
                <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-3">Status Pengumpulan Iuran</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-2xl font-extrabold text-white font-mono">{duesPct}%</span>
                  <span className="text-xs text-white/50 font-medium mb-0.5">terkumpul</span>
                </div>
                <div className="h-2 bg-white/15 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${duesPct}%` }} />
                </div>
                <p className="text-[10px] text-white/40 font-medium mt-2">{members.length}/{members.length} anggota sudah bayar</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* RODA PENGOCKAN BOARD */}
            <div className="xl:col-span-7">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 flex flex-col items-center gap-5">
                <div className="w-full flex items-center justify-between">
                  <div>
                    <h2 className="font-black text-[#0A2578] text-base">Roda Pengocokan</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{members.length} anggota eligibel · Siklus 4</p>
                  </div>
                  {wheelState === 'spinning' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-full animate-pulse">
                      <Disc className="w-3.5 h-3.5 animate-spin" />
                      Sedang Berputar...
                    </span>
                  )}
                </div>

                <div className="relative w-full max-w-[340px] select-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 -translate-y-1">
                    <div style={{
                      width: 0, height: 0,
                      borderLeft: '12px solid transparent',
                      borderRight: '12px solid transparent',
                      borderTop: '22px solid #F84A4D',
                      filter: 'drop-shadow(0 2px 4px rgba(248,74,77,0.5))',
                    }} />
                  </div>

                  <div className="relative rounded-full overflow-hidden shadow-2xl shadow-slate-400/30 ring-4 ring-white">
                    <svg viewBox="0 0 360 360" className="w-full" style={{ display: 'block' }}>
                      <g style={{
                        transform: `rotate(${rotation}deg)`,
                        transformOrigin: '50% 50%',
                        transition: wheelState === 'spinning'
                          ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.90, 0.20, 1.00)`
                          : 'none',
                      }}>
                        {members.map((m, i) => (
                          <path key={i} d={getPiePath(i, SLICE_DEG)} fill={m.color} stroke="white" strokeWidth="2.5" />
                        ))}
                        {members.map((m, i) => (
                          <g key={`label-${i}`} transform={getLabelTransform(i, SLICE_DEG)}>
                            <text
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize="12"
                              fontWeight="800"
                              fill="white"
                              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                            >
                              {m.name}
                            </text>
                          </g>
                        ))}
                      </g>
                      <circle cx={CX} cy={CY} r={34} fill="white" />
                      <circle cx={CX} cy={CY} r={30} fill="#0A2578" />
                      <circle cx={CX} cy={CY} r={25} fill="#1a3490" />
                    </svg>
                  </div>
                </div>

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
                    {wheelState === 'spinning' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Disc className="w-6 h-6" />}
                    {wheelState === 'spinning' ? 'Mengacak via Backend...' : 'PUTAR RODA SEKARANG'}
                  </button>
                ) : (
                  <div className="w-full max-w-sm flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">Menunggu Ketua Circle</p>
                      <p className="text-xs text-amber-600 mt-0.5">Menunggu Ketua Circle Memutar Roda...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* DAFTAR ANGGOTA ELIGIBEL */}
            <div className="xl:col-span-5 flex flex-col gap-5">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-[#0A2578] text-sm">Anggota Eligibel Putaran Ini</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Siklus 4 — {members.length} anggota di database</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#0A2578]/8 px-2.5 py-1 rounded-full text-[10px] font-bold text-[#0A2578]">
                    <Users className="w-3 h-3" />
                    {members.length} anggota
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-2.5">
                  {members.map((m, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl border" style={{ borderColor: `${m.color}30`, background: `${m.color}08` }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: m.color }}>
                        {m.initials}
                      </div>
                      <span className="text-xs font-semibold text-slate-700 truncate">{m.fullName}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* WINNER CELEBRATION MODAL */}
      {wheelState === 'done' && winner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black text-white shadow-lg" style={{ background: winner.color }}>
              {winner.initials}
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#0A2578]">{winner.fullName}</h2>
              <p className="text-sm text-slate-500">Pemenang Roda Pengocokan · Siklus 4</p>
            </div>
            <div className="text-3xl font-extrabold font-mono text-[#0A2578]">Rp 5.000.000</div>
            <button onClick={handleCloseWinner} className="w-full py-3.5 bg-[#0A2578] text-white font-bold rounded-xl hover:bg-[#0A2578]/90 transition-colors">
              Tutup & Lihat Resi SHA-256
            </button>
          </div>
        </div>
      )}
    </div>
  );
}