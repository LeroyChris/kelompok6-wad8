import { useState, type FormEvent } from 'react';
import { X, Zap, Users } from 'lucide-react';
import { circleService } from '../services/circleService';

export default function CreateCircleModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [circleName, setCircleName] = useState('');
  const [trackType, setTrackType] = useState<'SPSB' | 'RANDOM_DRAW'>('RANDOM_DRAW');
  const [contributionAmount, setContributionAmount] = useState<number>(500000);
  const [memberLimit, setMemberLimit] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      await circleService.createCircle({
        circle_name: circleName,
        track_type: trackType,
        contribution_amount: contributionAmount,
        member_limit: memberLimit,
      });
      onSuccess();
      onClose();
    } catch {
      setErrorMsg('Gagal membuat Circle baru.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-[#0A2578] px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base">Buat Circle Arisan Baru</h3>
            <p className="text-xs text-white/60">Pilih mekanisme arisan sesuai kelompok Anda</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
          {errorMsg && (
            <p className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">{errorMsg}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Nama Circle Arisan</label>
            <input
              type="text"
              value={circleName}
              onChange={(e) => setCircleName(e.target.value)}
              placeholder="Contoh: Arisan Alumni 2024 / Arisan Keluarga RT 05"
              className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#5A83DB]"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Pilih Tipe Track Arisan</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTrackType('RANDOM_DRAW')}
                className={`p-3.5 rounded-2xl border-2 text-left flex flex-col gap-2 transition-all ${
                  trackType === 'RANDOM_DRAW'
                    ? 'border-[#0A2578] bg-[#0A2578]/5 ring-1 ring-[#0A2578]'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Users className="w-5 h-5 text-[#0A2578]" />
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Track B</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#0A2578]">Sosial & Keluarga</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Sistem pengocokan acak transparan tanpa suku bunga.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTrackType('SPSB')}
                className={`p-3.5 rounded-2xl border-2 text-left flex flex-col gap-2 transition-all ${
                  trackType === 'SPSB'
                    ? 'border-[#F84A4D] bg-[#F84A4D]/5 ring-1 ring-[#F84A4D]'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Zap className="w-5 h-5 text-[#F84A4D]" />
                  <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Track A</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#F84A4D]">Komersial (SPSB)</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Sistem Lelang Suku Bunga Rahasia untuk finansial produktif.</p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Iuran per Anggota (Rp)</label>
              <input
                type="number"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(Number(e.target.value))}
                className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Maksimal Anggota</label>
              <input
                type="number"
                value={memberLimit}
                onChange={(e) => setMemberLimit(Number(e.target.value))}
                className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#0A2578] text-white font-bold text-xs rounded-xl hover:bg-[#0A2578]/90 transition-all mt-3"
          >
            {loading ? 'Membuat Circle...' : 'Buat Circle Sekarang'}
          </button>
        </form>
      </div>
    </div>
  );
}
