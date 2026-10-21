import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Disc, Users, CheckCircle2, Clock, Gavel, ArrowLeft, ShieldAlert, RefreshCw,
} from 'lucide-react';
import { circleAuctionService } from '../services/circleAuctionService';

type WheelState = 'idle' | 'spinning' | 'done';

interface MemberCandidate {
  name: string;
  fullName: string;
  initials: string;
  color: string;
  participant_id: string;
}

const COLORS = ['#F43F5E', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#3B82F6', '#EC4899'];

const CX = 180, CY = 180;
const R = 155;
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

export interface SpinWheelProps {
  onBack?: () => void;
  circleId: string;
  trackType?: 'A' | 'B';
  onNavigateToAuction?: () => void;
}

export default function SpinWheel({
  onBack = () => {},
  circleId,
  trackType = 'B',
  onNavigateToAuction,
}: SpinWheelProps) {
  const [wheelState, setWheelState] = useState<WheelState>('idle');
  const [rotation, setRotation] = useState(0);
  const [winnerIdx, setWinnerIdx] = useState<number | null>(null);
  const [members, setMembers] = useState<MemberCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchParticipants = async () => {
      if (!circleId) return;
      try {
        setLoading(true);
        const res = await circleAuctionService.getParticipants(circleId);
        const rawList = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
          ? res.data
          : [];

        if (rawList.length > 0 && isMounted) {
          const list: MemberCandidate[] = rawList.map((item: any, idx: number) => ({
            name: (item.full_name || item.name || 'User').split(' ')[0],
            fullName: item.full_name || item.name || 'User',
            initials: item.initials || 'US',
            color: COLORS[idx % COLORS.length],
            participant_id: item.participant_id || item.user_id || `par-${idx}`,
          }));
          setMembers(list);
        } else if (isMounted) {
          setMembers([]);
        }
      } catch {
        console.warn('Gagal memuat kandidat dari backend.');
        if (isMounted) setMembers([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchParticipants();
    return () => { isMounted = false; };
  }, [circleId]);

  const N = members.length > 0 ? members.length : 1;
  const SLICE_DEG = 360 / N;

  const handleSpin = useCallback(async () => {
    if (wheelState !== 'idle' || members.length === 0) return;

    try {
      setWheelState('spinning');
      const res = await circleAuctionService.executeDraw(circleId);
      
      let targetWinnerIdx = 0;
      if (res.data?.data?.winner) {
        const winnerObj = res.data.data.winner;
        const found = members.findIndex(
          (m) => m.fullName === winnerObj.name || m.name === winnerObj.name || m.participant_id === winnerObj.participant_id
        );
        if (found !== -1) targetWinnerIdx = found;
      }

      const currentVisual = ((rotation % 360) + 360) % 360;
      const targetDeg = (360 - (targetWinnerIdx * SLICE_DEG + SLICE_DEG / 2) + 360) % 360;
      const delta = (targetDeg - currentVisual + 360) % 360 || 360;
      const newRot = rotation + 1800 + delta;

      setWinnerIdx(targetWinnerIdx);
      setRotation(newRot);

      timerRef.current = setTimeout(() => {
        setWheelState('done');
      }, SPIN_MS + 300);
    } catch {
      alert('Gagal mengeksekusi pengundian acak dari server Go.');
      setWheelState('idle');
    }
  }, [wheelState, rotation, members, SLICE_DEG, circleId]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const winner = winnerIdx !== null && members[winnerIdx] ? members[winnerIdx] : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="shrink-0 bg-white border-b px-6 py-3.5 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-[#0A2578]">
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali
        </button>
        <span className="text-xs font-bold text-[#0A2578]">Roda Pengocokan (Circle: {circleId})</span>
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="bg-[#0A2578] rounded-2xl p-6 text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black">Pengocokan Arisan Acak</h1>
            <p className="text-xs text-white/70 mt-1">Sistem pengocokan murni transparan berbasis backend Go</p>
          </div>
        </div>

        {trackType === 'A' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center flex flex-col items-center gap-4">
            <ShieldAlert className="w-10 h-10 text-amber-600" />
            <div>
              <h3 className="font-bold text-[#0A2578] text-base">Circle Ini Menggunakan Track A (SPSB)</h3>
              <p className="text-xs text-slate-500 mt-1">Pengocokan acak hanya tersedia untuk Circle Track B.</p>
            </div>
            <button onClick={onNavigateToAuction} className="px-5 py-2.5 bg-[#F84A4D] text-white font-bold rounded-xl text-xs">
              Ke Room Lelang SPSB
            </button>
          </div>
        ) : (
          <div className="bg-white border rounded-2xl p-6 flex flex-col items-center gap-6">
            {loading ? (
              <p className="text-xs font-bold text-slate-400">Memuat anggota circle...</p>
            ) : members.length === 0 ? (
              <p className="text-xs font-bold text-slate-400">Belum ada anggota yang terdaftar di Circle ini.</p>
            ) : (
              <>
                <div className="relative w-full max-w-[320px] select-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 -translate-y-1">
                    <div style={{
                      width: 0, height: 0,
                      borderLeft: '12px solid transparent',
                      borderRight: '12px solid transparent',
                      borderTop: '22px solid #F84A4D',
                    }} />
                  </div>

                  <div className="relative rounded-full overflow-hidden shadow-xl border-4 border-white">
                    <svg viewBox="0 0 360 360" className="w-full">
                      <g style={{
                        transform: `rotate(${rotation}deg)`,
                        transformOrigin: '50% 50%',
                        transition: wheelState === 'spinning' ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.90, 0.20, 1.00)` : 'none',
                      }}>
                        {members.map((m, i) => (
                          <path key={i} d={getPiePath(i, SLICE_DEG)} fill={m.color} stroke="white" strokeWidth="2" />
                        ))}
                        {members.map((m, i) => (
                          <g key={i} transform={getLabelTransform(i, SLICE_DEG)}>
                            <text textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="800" fill="white">
                              {m.name}
                            </text>
                          </g>
                        ))}
                      </g>
                    </svg>
                  </div>
                </div>

                <button
                  onClick={handleSpin}
                  disabled={wheelState === 'spinning'}
                  className="w-full max-w-xs py-4 bg-[#F84A4D] hover:bg-[#e03a3d] text-white font-bold rounded-xl text-sm transition-all"
                >
                  {wheelState === 'spinning' ? 'Mengacak...' : 'PUTAR RODA SEKARANG'}
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {wheelState === 'done' && winner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-sm w-full p-6 rounded-2xl text-center flex flex-col items-center gap-4">
            <h2 className="text-xl font-black text-[#0A2578]">{winner.fullName}</h2>
            <p className="text-xs text-slate-500">Selamat! Anda Pemenang Siklus Ini.</p>
            <button onClick={() => setWheelState('idle')} className="w-full py-3 bg-[#0A2578] text-white font-bold rounded-xl text-xs">
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}