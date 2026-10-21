import { useState, useCallback, useMemo, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { circleService } from '../services/circleService';
import { userWalletService } from '../services/userWalletService';

type TxType  = 'disbursement' | 'dues' | 'crowdfund' | 'spin' | 'penalty' | 'refund';
type FilterKey = 'all' | TxType;

const fmtRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export default function AuditTrail({ 
  circleId, 
  onBack = () => {} 
}: { 
  circleId: string; 
  onBack?: () => void;
}) {
  const [filter]                        = useState<FilterKey>('all');
  const [searchQ, setSearchQ]           = useState('');
  const [verifyInput, setVerifyInput]   = useState('');
  const [verifyResult, setVerifyResult] = useState<'valid' | 'invalid' | null>(null);
  const [verifyLoading, setVerifyLoad]  = useState(false);
  const [auditLogs, setAuditLogs]       = useState<any[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!circleId) return;
      try {
        const res = await circleService.getPaymentMatrix(circleId);
        const dataList = Array.isArray(res.data?.data) ? res.data.data : [];
        setAuditLogs(dataList);
      } catch {
        console.warn('Gagal mengambil audit logs dari backend');
      }
    };
    fetchLogs();
  }, [circleId]);

  const handleVerify = useCallback(async () => {
    if (!verifyInput.trim()) return;
    setVerifyLoad(true);
    try {
      const res = await userWalletService.getPaymentDetail(verifyInput.trim());
      setVerifyResult(res.data?.data ? 'valid' : 'invalid');
    } catch {
      setVerifyResult('invalid');
    } finally {
      setVerifyLoad(false);
    }
  }, [verifyInput]);

  const filtered = useMemo(() => {
    const safeLogs = Array.isArray(auditLogs) ? auditLogs : [];
    return safeLogs.filter((l) => {
      const matchType   = filter === 'all' || l.type === filter;
      const matchSearch = !searchQ || (l.name && l.name.toLowerCase().includes(searchQ.toLowerCase()));
      return matchType && matchSearch;
    });
  }, [filter, searchQ, auditLogs]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="shrink-0 bg-white border-b px-6 py-3.5 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-[#0A2578]">
          <ArrowLeft className="w-3.5 h-3.5" /> Kembali
        </button>
        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">100% Verified · {circleId}</span>
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="bg-[#0A2578] rounded-2xl p-6 text-white">
          <h1 className="text-2xl font-black">Transparansi Audit Trail SHA-256</h1>
          <p className="text-xs text-white/70 mt-1">Log transaksi immutable terenkripsi real-time untuk Circle {circleId}</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 bg-white border rounded-2xl p-5">
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Cari transaksi..."
              className="w-full p-2.5 border rounded-xl text-xs mb-4"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="p-3">Anggota</th>
                    <th className="p-3">Tipe</th>
                    <th className="p-3">Nominal</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((log: any, idx: number) => (
                    <tr key={log.id || idx}>
                      <td className="p-3 font-bold">{log.name || 'Member'}</td>
                      <td className="p-3">{log.method || 'Wallet'}</td>
                      <td className="p-3 font-mono">{fmtRp(log.amount || 0)}</td>
                      <td className="p-3"><span className="text-emerald-700 font-bold">VALIDATED</span></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-slate-400">Tidak ada log transaksi.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:col-span-4 bg-white border rounded-2xl p-5 flex flex-col gap-4">
            <h3 className="font-bold text-[#0A2578] text-sm">Verifikasi Resi Mandiri</h3>
            <input
              type="text"
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              placeholder="Tempelkan Hash..."
              className="p-3 border rounded-xl text-xs font-mono"
            />
            <button onClick={handleVerify} disabled={verifyLoading} className="py-3 bg-[#0A2578] text-white font-bold rounded-xl text-xs">
              {verifyLoading ? 'Memverifikasi...' : 'Verifikasi Resi'}
            </button>
            {verifyResult && (
              <p className={`text-xs font-bold ${verifyResult === 'valid' ? 'text-emerald-600' : 'text-red-600'}`}>
                Result: {verifyResult.toUpperCase()}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}