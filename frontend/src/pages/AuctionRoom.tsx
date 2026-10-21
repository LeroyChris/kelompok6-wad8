import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Gavel } from 'lucide-react';
import { cycleService } from '../services/cycleService';
import type { Award, Cycle } from '../services/types';

export default function AuctionRoom({ circleId, role, onBack }: { circleId: string; role: string; onBack: () => void }) {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [award, setAward] = useState<Award | null>(null);
  const [rate, setRate] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const ownerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const load = useCallback(async () => {
    try {
      const response = await cycleService.getCycles(circleId);
      const cycles = (response.data?.data?.items ?? []) as Cycle[];
      const selected = cycles.find((item) => ['BIDDING_OPEN', 'BIDDING_CLOSED', 'READY_FOR_DISBURSEMENT'].includes(item.cycle_status)) ?? null;
      setCycle(selected);
      if (selected) {
        try { const awardResponse = await cycleService.getAward(selected.cycle_id); setAward(awardResponse.data?.data ?? null); }
        catch { setAward(null); }
      }
    } catch { setMessage('Cycle SPSB tidak dapat dimuat.'); }
  }, [circleId]);
  useEffect(() => { void load(); }, [load]);
  const submit = async () => {
    if (!cycle) return;
    const number = Number(rate);
    if (!Number.isFinite(number)) { setMessage('Masukkan persentase bid yang valid.'); return; }
    setBusy(true);
    try { await cycleService.submitBid(cycle.cycle_id, number); setMessage('Bid tersimpan. Anda dapat memperbaruinya selama bidding masih terbuka.'); }
    catch { setMessage('Bid ditolak oleh aturan cycle atau server.'); }
    finally { setBusy(false); }
  };
  const ownerAction = async (action: 'close' | 'resolve') => {
    if (!cycle) return;
    setBusy(true);
    try {
      const response = action === 'close' ? await cycleService.closeBidding(cycle.cycle_id) : await cycleService.resolveAward(cycle.cycle_id);
      if (action === 'resolve') setAward(response.data?.data ?? null);
      setMessage(action === 'close' ? 'Bidding ditutup.' : 'Award dan disbursement berhasil diproses.');
      await load();
    } catch { setMessage(action === 'close' ? 'Bidding belum dapat ditutup.' : 'Award belum dapat diproses.'); }
    finally { setBusy(false); }
  };
  return <section className="p-4 sm:p-6"><button onClick={onBack} className="mb-5 text-sm font-bold text-slate-600"><ArrowLeft className="mr-1 inline w-4"/>Kembali</button><div className="mx-auto max-w-xl rounded-2xl bg-white p-6 ring-1 ring-slate-200"><Gavel className="mb-3 text-[#991B1B]"/><h1 className="text-2xl font-black text-slate-800">Room Lelang SPSB</h1>{cycle ? <><p className="mt-2 text-sm text-slate-500">Cycle #{cycle.cycle_number} · {cycle.cycle_status}</p>{cycle.cycle_status === 'BIDDING_OPEN' && <><label className="mt-6 block text-sm font-bold text-slate-700">Bid rate (%)</label><input value={rate} onChange={(event) => setRate(event.target.value)} type="number" min="0" step="0.01" className="mt-2 w-full rounded-xl border p-3" placeholder="Contoh: 7.50"/><button disabled={busy} onClick={() => void submit()} className="mt-4 w-full rounded-xl bg-[#991B1B] py-3 font-bold text-white disabled:opacity-60">{busy ? 'Menyimpan…' : 'Kirim bid rahasia'}</button></>}{ownerOrAdmin && cycle.cycle_status === 'BIDDING_OPEN' && <button disabled={busy} onClick={() => void ownerAction('close')} className="mt-3 w-full rounded-xl border border-[#991B1B] py-3 text-sm font-bold text-[#991B1B]">Tutup bidding</button>}{ownerOrAdmin && cycle.cycle_status === 'READY_FOR_DISBURSEMENT' && !award && <button disabled={busy} onClick={() => void ownerAction('resolve')} className="mt-4 w-full rounded-xl bg-[#991B1B] py-3 font-bold text-white">Resolve award</button>}</> : <p className="mt-4 text-sm text-slate-500">Tidak ada cycle SPSB aktif.</p>}{award && <div className="mt-5 rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold text-[#065F46]">PEMENANG SPSB</p><p className="text-xl font-black text-slate-800">{award.winner_name}</p><p className="text-sm">Pot: Rp {award.gross_amount.toLocaleString('id-ID')}</p><p className="text-sm">Bid menang: {award.winning_bid_rate_percent ?? '—'}% · Dibayar: {award.payable_bid_rate_percent ?? '—'}%</p><p className="mt-2 break-all text-xs text-slate-500">Decision hash: {award.decision_hash}</p></div>}{message && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}</div></section>;
}
