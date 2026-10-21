import { useCallback, useEffect, useState } from 'react';
import { Disc, Gavel, LockKeyhole, Play, Wallet } from 'lucide-react';
import { circleService } from '../services/circleService';
import { cycleService } from '../services/cycleService';
import { userWalletService } from '../services/userWalletService';
import type { Cycle, Obligation } from '../services/types';
import PaymentModal from '../components/PaymentModal';

type PaymentProof = { payment_proof_id: string; full_name: string; amount: number; proof_url: string };
type CircleDetail = { circle_name: string; track_type: 'SPSB' | 'RANDOM_DRAW'; invite_code?: string; active_member_count: number; circle_status: string };
export default function Dashboard({ circleId, role, onNavigate }: { circleId: string; role: string; onNavigate: (screen: string) => void }) {
  const [detail, setDetail] = useState<CircleDetail | null>(null);
  const [balance, setBalance] = useState(0);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [selected, setSelected] = useState<Obligation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const cycle = cycles.find((item) => !['COMPLETED', 'CANCELLED'].includes(item.cycle_status)) ?? cycles[0] ?? null;
	const noActiveCycle = !cycles.some((item) => !['COMPLETED', 'CANCELLED'].includes(item.cycle_status));
  const load = useCallback(async () => {
    try {
      setError('');
      const [detailResponse, walletResponse, cyclesResponse] = await Promise.all([circleService.getCircleDetail(circleId), userWalletService.getWalletBalance(), cycleService.getCycles(circleId)]);
      setDetail(detailResponse.data?.data ?? null);
      setBalance(walletResponse.data?.data?.balance ?? 0);
      const listed = (cyclesResponse.data?.data?.items ?? []) as Cycle[];
      setCycles(listed);
      const active = listed.find((item) => !['COMPLETED', 'CANCELLED'].includes(item.cycle_status)) ?? listed[0] ?? null;
      if (role === 'OWNER' || role === 'ADMIN') {
        const proofResponse = await circleService.getPaymentProofs(circleId);
        setProofs(proofResponse.data?.data?.items ?? []);
      } else setProofs([]);
      if (active) {
        const obligationsResponse = await cycleService.getObligations(active.cycle_id);
        setObligations(obligationsResponse.data?.data?.items ?? []);
      } else setObligations([]);
    } catch { setError('Dashboard tidak dapat dimuat dari server.'); }
  }, [circleId, role]);
  useEffect(() => { void load(); }, [load]);
  const ownerAction = async (action: 'lock' | 'cycle') => {
    setBusy(true); setError('');
    try {
      if (action === 'lock') await circleService.lockCircle(circleId);
      else await circleService.createCycle(circleId, Math.max(0, ...cycles.map((item) => item.cycle_number)) + 1, new Date(Date.now() + 30 * 86400000).toISOString());
      await load();
    } catch { setError(action === 'lock' ? 'Circle belum penuh atau tidak dapat dikunci.' : 'Cycle tidak dapat dibuat. Pastikan circle sudah LOCKED.'); }
    finally { setBusy(false); }
  };
  const reviewProof = async (proofId: string, status: 'APPROVED' | 'REJECTED') => {
    setBusy(true);
    try { await circleService.reviewPaymentProof(proofId, status); await load(); }
    catch { setError('Bukti pembayaran tidak dapat ditinjau.'); }
    finally { setBusy(false); }
  };
  const unpaid = obligations.find((item) => item.status !== 'PAID');
  const owner = role === 'OWNER';
  return <section className="p-4 sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Circle</p><h1 className="text-2xl font-black text-slate-800">{detail?.circle_name ?? 'Memuat…'}</h1></div>{detail?.invite_code && <code className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Invite: {detail.invite_code}</code>}</div>
    {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-[#991B1B]">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-[#065F46] p-5 text-white"><Wallet className="mb-3"/><p className="text-xs font-bold uppercase text-white/70">Saldo wallet</p><p className="mt-1 text-xl font-black">Rp {balance.toLocaleString('id-ID')}</p></div><div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"><p className="text-xs font-bold uppercase text-slate-500">Cycle aktif</p><p className="mt-2 text-xl font-black text-slate-800">{cycle ? `#${cycle.cycle_number}` : 'Belum ada'}</p><p className="text-xs text-slate-500">{cycle?.cycle_status ?? 'Belum dimulai'}</p></div><div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"><p className="text-xs font-bold uppercase text-slate-500">Status circle</p><p className="mt-2 text-xl font-black text-slate-800">{detail?.circle_status ?? '—'}</p><p className="text-xs text-slate-500">{detail?.active_member_count ?? 0} anggota aktif</p></div></div>
    {owner && detail?.circle_status === 'RECRUITING' && <button disabled={busy} onClick={() => void ownerAction('lock')} className="mt-5 rounded-xl bg-[#991B1B] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><LockKeyhole className="mr-1 inline w-4"/>Kunci circle saat penuh</button>}
    {owner && noActiveCycle && (detail?.circle_status === 'LOCKED' || detail?.circle_status === 'RUNNING') && <button disabled={busy} onClick={() => void ownerAction('cycle')} className="mt-5 rounded-xl bg-[#991B1B] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Play className="mr-1 inline w-4"/>{cycles.length === 0 ? 'Mulai cycle pertama' : 'Mulai cycle berikutnya'}</button>}
    <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-slate-200"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black text-slate-800">Iuran saya</h2><p className="text-xs text-slate-500">Cycle saat ini</p></div>{cycle && detail?.track_type === 'SPSB' && <button onClick={() => onNavigate('auction')} className="rounded-xl bg-[#991B1B] px-4 py-2 text-sm font-bold text-white"><Gavel className="mr-1 inline w-4"/>Ajukan lelang</button>}{cycle && detail?.track_type === 'RANDOM_DRAW' && <button onClick={() => onNavigate('draw')} className="rounded-xl bg-[#991B1B] px-4 py-2 text-sm font-bold text-white"><Disc className="mr-1 inline w-4"/>Random draw</button>}</div>{unpaid ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><span className="text-sm font-bold text-slate-700">Rp {unpaid.amount_due.toLocaleString('id-ID')} · {unpaid.status}</span><button onClick={() => setSelected(unpaid)} className="rounded-lg bg-[#991B1B] px-3 py-2 text-sm font-bold text-white">Bayar sekarang</button></div> : <p className="mt-4 text-sm text-[#065F46]">Tidak ada iuran Anda yang belum dibayar pada cycle ini.</p>}</div>
    {(role === 'OWNER' || role === 'ADMIN') && proofs.length > 0 && <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-slate-200"><h2 className="font-black text-slate-800">Bukti transfer menunggu review</h2><div className="mt-3 grid gap-3">{proofs.map((proof) => <div key={proof.payment_proof_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><div><p className="font-bold">{proof.full_name} · Rp {proof.amount.toLocaleString('id-ID')}</p><a href={proof.proof_url} target="_blank" rel="noreferrer" className="text-xs text-[#991B1B] underline">Lihat bukti</a></div><div className="flex gap-2"><button disabled={busy} onClick={() => void reviewProof(proof.payment_proof_id, 'REJECTED')} className="rounded-lg border border-[#991B1B] px-3 py-2 text-xs font-bold text-[#991B1B]">Tolak</button><button disabled={busy} onClick={() => void reviewProof(proof.payment_proof_id, 'APPROVED')} className="rounded-lg bg-[#065F46] px-3 py-2 text-xs font-bold text-white">Setujui</button></div></div>)}</div></div>}
    {selected && <PaymentModal obligationId={selected.obligation_id} amount={selected.amount_due} onClose={() => setSelected(null)} onSuccess={() => { setSelected(null); void load(); }} />}
  </section>;
}
