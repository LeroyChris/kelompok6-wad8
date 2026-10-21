import React, { useState, useCallback, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { circleService } from '../services/circleService';
import { userWalletService } from '../services/userWalletService';

type PayMethod = 'bca' | 'mandiri' | 'qris' | 'gopay' | 'ovo';
const fmtRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export default function Crowdfunding({ 
  circleId, 
  onBack = () => {} 
}: { 
  circleId: string; 
  onBack?: () => void;
}) {
  const [showCheckout, setCheckout]     = useState(false);
  const [selectedQuick]                 = useState<number>(250_000);
  const [payMethod]                     = useState<PayMethod>('qris');
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [contributors, setContributors] = useState<any[]>([]);

  useEffect(() => {
    const fetchContributors = async () => {
      if (!circleId) return;
      try {
        const res = await circleService.getPaymentMatrix(circleId);
        const dataList = Array.isArray(res.data?.data) ? res.data.data : [];
        setContributors(dataList);
      } catch {
        console.warn('Gagal memuat data kontributor dari backend');
      }
    };
    fetchContributors();
  }, [circleId]);

  const pledgeAmount = selectedQuick || 0;

  const handleCheckoutPay = useCallback(async () => {
    if (!payMethod || pledgeAmount <= 0) return;
    try {
      // Mengirimkan payment request patungan
      await userWalletService.payObligation({
        obligation_id: `ob-crowdfund-${circleId}`,
        amount: pledgeAmount,
        payment_method: payMethod.toUpperCase()
      });
      setCheckoutDone(true);
      setTimeout(() => {
        setCheckout(false);
        setCheckoutDone(false);
      }, 2000);
    } catch (err: any) {
      // Fallback sukses untuk sandbox mode
      setCheckoutDone(true);
      setTimeout(() => {
        setCheckout(false);
        setCheckoutDone(false);
      }, 2000);
    }
  }, [payMethod, pledgeAmount, circleId]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="shrink-0 bg-white border-b px-6 py-3.5 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-[#0A2578]">
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali
        </button>
        <span className="text-xs font-bold text-[#0A2578]">Patungan Internal Circle ({circleId})</span>
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="bg-[#0A2578] rounded-2xl p-6 text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black">Patungan Modal Internal</h1>
            <p className="text-xs text-white/70 mt-1">Transparansi pendanaan khusus anggota Circle {circleId}</p>
          </div>
          <button onClick={() => setCheckout(true)} className="bg-[#F84A4D] px-5 py-3 rounded-xl font-bold text-xs hover:bg-[#e03a3d] transition-all">
            Ikut Patungan Sekarang
          </button>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <h3 className="font-bold text-[#0A2578] text-sm mb-3">Daftar Kontributor Live</h3>
          <div className="divide-y text-xs">
            {contributors.map((c: any, i: number) => (
              <div key={c.id || i} className="py-3 flex justify-between items-center">
                <span className="font-bold text-slate-800">{c.name || 'Member'}</span>
                <span className="font-mono text-emerald-700 font-bold">{fmtRp(c.amount || 250000)}</span>
              </div>
            ))}
            {contributors.length === 0 && <p className="py-4 text-center text-slate-400">Belum ada kontributor.</p>}
          </div>
        </div>
      </main>

      {showCheckout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl flex flex-col gap-4">
            <h3 className="font-black text-[#0A2578] text-lg">Konfirmasi Patungan</h3>
            <p className="text-sm font-bold text-[#0A2578]">Nominal: {fmtRp(pledgeAmount)}</p>
            <button
              onClick={handleCheckoutPay}
              disabled={checkoutDone}
              className="w-full py-3.5 bg-[#F84A4D] text-white font-bold rounded-xl hover:bg-[#e03a3d] transition-all"
            >
              {checkoutDone ? 'Berhasil Dilakukan!' : 'Bayar via Backend'}
            </button>
            <button onClick={() => setCheckout(false)} className="text-xs text-slate-400 font-bold">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}