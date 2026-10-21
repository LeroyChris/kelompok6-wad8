import { useState } from 'react';
import { X, Wallet, Upload } from 'lucide-react';
import { cycleService } from '../services/cycleService';

export default function PaymentModal({ obligationId, amount, onClose, onSuccess }: { obligationId: string; amount: number; onClose: () => void; onSuccess: () => void }) {
  const [method, setMethod] = useState<'WALLET' | 'MANUAL_TRANSFER'>('WALLET');
  const [proofUrl, setProofUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setMessage('');
    try {
      if (method === 'WALLET') {
        await cycleService.payWallet(obligationId, crypto.randomUUID());
        setMessage('Pembayaran wallet berhasil.'); onSuccess();
      } else {
        const order = await cycleService.createManualPayment(obligationId);
        const orderId = order.data?.data?.payment_order_id as string | undefined;
        if (!orderId || !proofUrl.trim()) throw new Error('Unggah URL bukti transfer untuk melanjutkan.');
        await cycleService.uploadProof(orderId, proofUrl.trim());
        setMessage('Bukti transfer dikirim untuk ditinjau owner/admin.'); onSuccess();
      }
    } catch (error) {
      const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage(apiMessage ?? 'Pembayaran gagal diproses.');
    }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-slate-950/40 p-4">
    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
      <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold text-slate-500">Iuran cycle</p><h2 className="text-xl font-black text-slate-800">Rp {amount.toLocaleString('id-ID')}</h2></div><button onClick={onClose}><X /></button></div>
      <div className="mb-4 grid grid-cols-2 gap-2"><button onClick={() => setMethod('WALLET')} className={`rounded-xl p-3 text-xs font-bold ${method === 'WALLET' ? 'bg-[#991B1B] text-white' : 'bg-slate-100 text-slate-700'}`}><Wallet className="mx-auto mb-1 w-4"/>Wallet</button><button onClick={() => setMethod('MANUAL_TRANSFER')} className={`rounded-xl p-3 text-xs font-bold ${method === 'MANUAL_TRANSFER' ? 'bg-[#991B1B] text-white' : 'bg-slate-100 text-slate-700'}`}><Upload className="mx-auto mb-1 w-4"/>Transfer Manual</button></div>
      {method === 'MANUAL_TRANSFER' && <input value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder="https://... bukti transfer" className="mb-3 w-full rounded-xl border p-3 text-sm" />}
      {message && <p className="mb-3 rounded-xl bg-slate-100 p-3 text-xs text-slate-700">{message}</p>}
      <button disabled={busy} onClick={submit} className="w-full rounded-xl bg-[#991B1B] py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Memproses…' : method === 'WALLET' ? 'Bayar dengan Wallet' : 'Kirim Bukti Transfer'}</button>
    </div></div>;
}
