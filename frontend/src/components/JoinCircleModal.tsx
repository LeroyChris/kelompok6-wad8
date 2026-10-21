import { useState, type FormEvent } from 'react';
import { X, KeyRound, RefreshCw } from 'lucide-react';
import { circleService } from '../services/circleService';

export default function JoinCircleModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      await circleService.joinCircle(inviteCode.trim().toUpperCase());
      onSuccess();
      onClose();
    } catch {
      setErrorMsg('Kode undangan tidak valid atau sudah kedaluwarsa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-[#0A2578] px-6 py-4 text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base">Gabung Circle Arisan</h3>
            <p className="text-xs text-white/60">Masukkan kode undangan dari Ketua Circle</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {errorMsg && (
            <p className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
              {errorMsg}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Kode Undangan (Invite Code)</label>
            <div className="flex items-center border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus-within:border-[#0A2578] focus-within:bg-white">
              <KeyRound className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Contoh: ARK-A1B2C3"
                className="w-full text-xs font-mono font-bold uppercase tracking-wider bg-transparent focus:outline-none text-slate-800"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#0A2578] text-white font-bold text-xs rounded-xl hover:bg-[#0A2578]/90 transition-all mt-2 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Gabung ke Circle Sekarang'}
          </button>
        </form>
      </div>
    </div>
  );
}
