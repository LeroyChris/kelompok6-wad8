import { useCallback, useEffect, useState } from 'react';
import { Plus, WalletCards } from 'lucide-react';
import { userWalletService } from '../services/userWalletService';

type Profile = { full_name: string; email: string };
type Transaction = { id: string; transaction_type: string; mutation_type: 'CREDIT' | 'DEBIT'; amount: number; description: string; created_at: string };
export default function WalletProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('100000');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [profileResponse, walletResponse, transactionResponse] = await Promise.all([userWalletService.getProfile(), userWalletService.getWalletBalance(), userWalletService.getTransactions()]);
      setProfile(profileResponse.data?.data ?? null);
      setBalance(walletResponse.data?.data?.balance ?? 0);
      setTransactions(transactionResponse.data?.data?.items ?? []);
    } catch { setMessage('Profil atau wallet tidak dapat dimuat.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const topUp = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setMessage('Nominal top-up harus positif.'); return; }
    setBusy(true); setMessage('');
    try { await userWalletService.topUpWallet(value); setMessage('Top-up sandbox berhasil dicatat.'); await load(); }
    catch { setMessage('Top-up sandbox gagal.'); }
    finally { setBusy(false); }
  };
  return <section className="p-4 sm:p-6"><div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[0.8fr_1.2fr]"><div className="rounded-2xl bg-[#065F46] p-6 text-white"><WalletCards className="mb-5 w-8"/><p className="text-sm text-white/70">Wallet internal</p><p className="mt-1 text-3xl font-black">Rp {balance.toLocaleString('id-ID')}</p><div className="mt-6 border-t border-white/20 pt-4"><p className="font-bold">{profile?.full_name ?? 'Memuat…'}</p><p className="text-sm text-white/70">{profile?.email}</p></div><label className="mt-6 block text-xs font-bold text-white/80">Top-up sandbox</label><div className="mt-2 flex gap-2"><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="1" className="min-w-0 rounded-lg p-2 text-sm text-slate-800"/><button disabled={busy} onClick={() => void topUp()} className="rounded-lg bg-white px-3 text-[#065F46] disabled:opacity-60"><Plus className="w-4"/></button></div>{message && <p className="mt-3 text-xs text-white/90">{message}</p>}</div><div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"><h1 className="text-xl font-black text-slate-800">Riwayat wallet</h1><div className="mt-4 divide-y">{transactions.map((transaction) => <div key={transaction.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><p className="font-bold text-slate-800">{transaction.transaction_type}</p><p className="text-xs text-slate-500">{transaction.description || new Date(transaction.created_at).toLocaleString('id-ID')}</p></div><p className={transaction.mutation_type === 'CREDIT' ? 'font-bold text-[#065F46]' : 'font-bold text-[#991B1B]'}>{transaction.mutation_type === 'CREDIT' ? '+' : '-'}Rp {transaction.amount.toLocaleString('id-ID')}</p></div>)}{transactions.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Belum ada transaksi.</p>}</div></div></div></section>;
}
