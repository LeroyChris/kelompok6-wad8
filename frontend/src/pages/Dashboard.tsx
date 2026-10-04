import { useState, useEffect } from 'react';
import { userWalletService } from '../services/userWalletService';
import {
  Copy,
  Check,
  Bell,
  MessageCircle,
  TrendingUp,
  Users,
  Star,
  BarChart3,
  Zap,
  X,
  CreditCard,
  Search,
  Gavel,
  RefreshCw,
  Building2,
  Plus,
  Trash2,
} from 'lucide-react';

/* ─── Types ─── */
type StatusKey = 'lunas' | 'pending' | 'overdue';
type Filter = 'all' | 'lunas' | 'unpaid';

/* ─── Data Fallback ─── */
const members: Array<{
  id: number; name: string; initials: string; status: StatusKey;
  date: string; method: string; color: string;
}> = [
  { id: 1, name: 'Ahmad Rizky',    initials: 'AR', status: 'lunas',   date: '12 Okt 2026', method: 'Virtual Account', color: 'from-[#5A83DB] to-[#0A2578]' },
  { id: 2, name: 'Farrel Abda',    initials: 'FA', status: 'lunas',   date: '14 Okt 2026', method: 'QRIS Midtrans',   color: 'from-emerald-500 to-emerald-700' },
  { id: 3, name: 'Santi Putri',    initials: 'SP', status: 'lunas',   date: '10 Okt 2026', method: 'Transfer Bank',   color: 'from-purple-500 to-purple-700' },
  { id: 4, name: 'Rina Wijaya',    initials: 'RW', status: 'lunas',   date: '09 Okt 2026', method: 'Virtual Account', color: 'from-emerald-500 to-emerald-700' },
  { id: 5, name: 'Toni Prasetya',  initials: 'TP', status: 'lunas',   date: '11 Okt 2026', method: 'QRIS Midtrans',   color: 'from-sky-500 to-sky-700' },
  { id: 6, name: 'Mega Sari',      initials: 'MS', status: 'lunas',   date: '13 Okt 2026', method: 'Transfer Bank',   color: 'from-rose-500 to-rose-700' },
  { id: 7, name: 'Eko Prasetyo',   initials: 'EP', status: 'lunas',   date: '10 Okt 2026', method: 'Virtual Account', color: 'from-amber-500 to-orange-600' },
  { id: 8, name: 'Lina Wulandari', initials: 'LW', status: 'lunas',   date: '11 Okt 2026', method: 'E-Wallet GoPay', color: 'from-teal-500 to-teal-700' },
  { id: 9, name: 'Budi Santoso',   initials: 'BS', status: 'pending', date: '—',            method: '—',              color: 'from-amber-500 to-amber-700' },
  { id:10, name: 'Deni Setiawan',  initials: 'DS', status: 'overdue', date: '—',            method: '—',              color: 'from-red-500 to-red-800' },
];

const cashFlowData = [
  { label: 'Siklus 1', pct: 100, collected: 'Rp 15 Jt' },
  { label: 'Siklus 2', pct: 100, collected: 'Rp 15 Jt' },
  { label: 'Siklus 3', pct: 90,  collected: 'Rp 13,5 Jt' },
  { label: 'Siklus 4', pct: 80,  collected: 'Rp 12 Jt' },
  { label: 'Siklus 5', pct: 0,   collected: '—' },
  { label: 'Siklus 6', pct: 0,   collected: '—' },
];

const pastWinners = [
  { cycle: 1, name: 'Siti Rahma',   initials: 'SR', rate: '2.5%', color: 'from-purple-500 to-purple-700' },
  { cycle: 2, name: 'Eko Prasetyo', initials: 'EP', rate: '3.0%', color: 'from-sky-500 to-sky-700' },
  { cycle: 3, name: 'Rina Wijaya',  initials: 'RW', rate: '1.8%', color: 'from-emerald-500 to-emerald-700' },
];

const statusConfig: Record<StatusKey, { label: string; bg: string; text: string; dot: string }> = {
  lunas:   { label: 'LUNAS',      bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  pending: { label: 'PENDING',    bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500'   },
  overdue: { label: 'MENUNGGAK', bg: 'bg-red-100',     text: 'text-[#9E002D]',   dot: 'bg-[#9E002D]'  },
};

/* ─── Sub-components ─── */
function StatusBadge({ status }: { status: StatusKey }) {
  const c = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function Avatar({ initials, color, size = 'md' }: { initials: string; color: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white shrink-0 ring-2 ring-white`}>
      {initials}
    </div>
  );
}

/* ─── Props ─── */
export interface DashboardProps {
  onBack?:        () => void;
  onNavigate?:    (screen: string) => void;
  embedded?:      boolean;
  onOpenPayment?: () => void;
}

/* ─── Main Component ─── */
export default function Dashboard({
  onNavigate,
}: DashboardProps) {
  const [copiedCode, setCopiedCode]   = useState(false);
  const [reminded, setReminded]       = useState<Record<number, boolean>>({});
  const [filter, setFilter]           = useState<Filter>('all');
  const [showPayModal, setPayModal]   = useState(false);
  const [searchQuery, setSearch]      = useState('');
  const [hoveredBar, setHoveredBar]   = useState<number | null>(null);

  // STATE INTEGRASI BACKEND GO (TRACK 1)
  const [walletBalance, setWalletBalance]     = useState<number>(0);
  const [reputationScore, setReputationScore] = useState<number>(100);
  const [profileName, setProfileName]         = useState<string>('Pengguna');
  const [apiLoading, setApiLoading]           = useState<boolean>(true);
  const [topUpAmount, setTopUpAmount]         = useState<string>('100000');
  const [topUpLoading, setTopUpLoading]       = useState<boolean>(false);

  // STATE REKENING BANK
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [showBankModal, setBankModal]   = useState<boolean>(false);
  const [newBankName, setNewBankName]   = useState<string>('BCA');
  const [newAccNo, setNewAccNo]         = useState<string>('');
  const [newAccHolder, setNewAccHolder] = useState<string>('');

  // Fetch data dari backend
  const fetchBackendData = async () => {
    try {
      setApiLoading(true);
      const [resWallet, resProfile, resRep] = await Promise.all([
        userWalletService.getWalletBalance(),
        userWalletService.getProfile(),
        userWalletService.getReputation(),
      ]);

      if (resWallet.data?.data) setWalletBalance(resWallet.data.data.balance);
      if (resProfile.data?.data) setProfileName(resProfile.data.data.full_name);
      if (resRep.data?.data) setReputationScore(resRep.data.data.reputation_score);
    } catch (err) {
      console.warn('Backend API menggunakan data fallback lokal:', err);
    } finally {
      setApiLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await userWalletService.getBankAccounts();
      if (res.data?.data) setBankAccounts(res.data.data);
    } catch (err) {
      console.warn('Gagal mengambil daftar rekening bank:', err);
    }
  };

  useEffect(() => {
    fetchBackendData();
    fetchBankAccounts();
  }, []);

  // Handlers
  const handleSandboxTopUp = async () => {
    const amount = Number(topUpAmount);
    if (isNaN(amount) || amount <= 0) return alert('Masukkan jumlah top-up yang valid');

    try {
      setTopUpLoading(true);
      const res = await userWalletService.topUpWallet(amount);
      if (res.data?.status === 'success') {
        alert(`Top-Up Sandbox Berhasil!\nSaldo Baru: Rp ${res.data.data.new_balance.toLocaleString('id-ID')}`);
        setWalletBalance(res.data.data.new_balance);
        setPayModal(false);
      }
    } catch (err) {
      alert('Gagal melakukan Top-Up ke Backend Go. Pastikan Server Go aktif.');
    } finally {
      setTopUpLoading(false);
    }
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccNo || !newAccHolder) return alert('Isi semua data rekening');

    try {
      await userWalletService.addBankAccount({
        bank_name: newBankName,
        account_number: newAccNo,
        account_holder: newAccHolder,
        is_primary: bankAccounts.length === 0,
      });
      alert('Rekening bank berhasil ditambahkan!');
      setNewAccNo('');
      setNewAccHolder('');
      fetchBankAccounts();
    } catch (err) {
      alert('Gagal menambah rekening bank');
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm('Hapus rekening ini?')) return;
    try {
      await userWalletService.deleteBankAccount(id);
      fetchBankAccounts();
    } catch (err) {
      alert('Gagal menghapus rekening');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText('ARK-8891').catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const lunasCount   = members.filter((m) => m.status === 'lunas').length;
  const pendingCount = members.filter((m) => m.status === 'pending').length;
  const overdueCount = members.filter((m) => m.status === 'overdue').length;

  const statusOrder: Record<StatusKey, number> = { overdue: 0, pending: 1, lunas: 2 };

  const filteredMembers = members
    .filter((m) => {
      const matchSearch = searchQuery === '' || m.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter =
        filter === 'all' ? true :
        filter === 'lunas' ? m.status === 'lunas' :
        m.status !== 'lunas';
      return matchSearch && matchFilter;
    })
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header Bar */}
      <header className="shrink-0 z-20 bg-white border-b border-slate-200/80 px-4 md:px-6 py-3.5 flex items-center gap-3 shadow-sm">
        <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5A83DB]/15 text-[#0A2578] border border-[#5A83DB]/25 text-xs font-bold rounded-full shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5A83DB] animate-pulse" />
          Halo, {profileName}! (Track A)
        </span>

        <div className="flex-1 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama anggota..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/30 focus:border-[#5A83DB] focus:bg-white transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            onClick={() => setBankModal(true)}
            className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-2 border rounded-xl hover:bg-slate-50 transition-colors text-slate-700"
          >
            <Building2 className="w-4 h-4 text-[#0A2578]" /> Rekening Bank
          </button>
          <div className="hidden sm:flex items-center gap-2 bg-[#0A2578]/6 border border-[#0A2578]/15 rounded-xl px-3 py-2">
            <code className="text-xs font-black text-[#0A2578] font-mono tracking-widest">ARK-8891</code>
            <button onClick={handleCopy} className="text-[#5A83DB] hover:text-[#0A2578] transition-colors">
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button className="relative w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F84A4D] rounded-full ring-1 ring-white" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 pb-28 lg:pb-10 flex flex-col gap-6">

        {/* ROW 1: KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1 — Saldo Dompet */}
          <div className="bg-[#0A2578] text-white rounded-2xl p-5 flex flex-col gap-4 shadow-lg shadow-[#0A2578]/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Saldo Dompet Real-Time</p>
                <p className="text-xs text-white/70 font-semibold mt-0.5">Database Supabase Active</p>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live API
              </span>
            </div>
            
            <p className="text-3xl font-extrabold text-white tracking-tight font-mono">
              {apiLoading ? 'Loading...' : `Rp ${walletBalance.toLocaleString('id-ID')}`}
            </p>

            <div className="flex gap-2 mt-auto">
              <button
                onClick={() => setPayModal(true)}
                className="flex-1 bg-[#F84A4D] hover:bg-[#e03a3d] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" /> Top-Up Sandbox
              </button>
              <button 
                onClick={fetchBackendData}
                className="border border-white/25 text-white text-xs font-bold py-2.5 px-3 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>

          {/* Card 2 — Target Iuran */}
          <div className="bg-white rounded-2xl p-5 flex flex-col gap-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Target Iuran Siklus 4</p>
                <p className="text-xl font-extrabold text-[#0A2578] mt-1">Rp 1.000.000</p>
                <p className="text-xs text-slate-400 font-medium">Per Anggota / Bulan</p>
              </div>
              <div className="w-10 h-10 bg-[#5A83DB]/10 rounded-xl flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-[#5A83DB]" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">{lunasCount} dari {members.length} Anggota Lunas</span>
                <span className="text-[#0A2578]">{Math.round((lunasCount / members.length) * 100)}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#5A83DB] to-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${(lunasCount / members.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 3 — Reputasi & Room Lelang */}
          <div className="bg-white rounded-2xl p-5 flex flex-col gap-4 border border-slate-200/80 shadow-sm sm:col-span-2 lg:col-span-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Skor Reputasi Saya</p>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="w-5 h-5 text-emerald-500 fill-emerald-500" />
                  <span className="text-2xl font-extrabold text-[#0A2578] font-mono">{reputationScore}/100</span>
                </div>
              </div>
              <div className="w-10 h-10 bg-[#5A83DB]/10 rounded-xl flex items-center justify-center shrink-0">
                <Gavel className="w-5 h-5 text-[#5A83DB]" />
              </div>
            </div>
            <button
              onClick={() => onNavigate?.('auction')}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-[#F84A4D] hover:bg-[#e03a3d] rounded-xl transition-all shadow-md active:scale-95"
            >
              <Zap className="w-4 h-4" /> Masuk Room Lelang
            </button>
          </div>
        </div>

        {/* ROW 2: Bento Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-8 flex flex-col gap-5">
            {/* Micro Chart */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-[#0A2578] text-sm">Analisis Arus Kas Iuran</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Persentase koleksi dues per siklus</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#5A83DB]">
                  <BarChart3 className="w-4 h-4" /> 6 Siklus Terakhir
                </div>
              </div>

              <div className="flex items-end gap-3 h-28 relative">
                {cashFlowData.map((d, i) => {
                  const isFuture = d.pct === 0;
                  const isHovered = hoveredBar === i;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-1.5 relative group"
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {isHovered && !isFuture && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0A2578] text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10 shadow-lg">
                          {d.pct}% · {d.collected}
                        </div>
                      )}
                      <div className="w-full flex flex-col justify-end" style={{ height: '96px' }}>
                        <div
                          className={`w-full rounded-t-lg transition-all duration-300 ${
                            isFuture
                              ? 'bg-slate-100 border-2 border-dashed border-slate-200'
                              : d.pct === 100
                              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                              : d.pct >= 80
                              ? 'bg-gradient-to-t from-[#5A83DB] to-[#7aa3e8]'
                              : 'bg-gradient-to-t from-amber-500 to-amber-400'
                          } ${isHovered && !isFuture ? 'opacity-100 scale-x-105' : 'opacity-90'}`}
                          style={{ height: isFuture ? '20%' : `${d.pct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-semibold whitespace-nowrap">{d.label.replace('Siklus ', 'S')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tabel Matriks */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-extrabold text-[#0A2578] text-sm">Matriks Pembayaran Anggota</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Siklus 4 — Jatuh tempo 25 Okt 2026</p>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  {(
                    [
                      ['all', `Semua (${members.length})`],
                      ['lunas', `Lunas (${lunasCount})`],
                      ['unpaid', `Belum Bayar (${pendingCount + overdueCount})`],
                    ] as [Filter, string][]
                  ).map(([f, label]) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                        filter === f ? 'bg-white text-[#0A2578] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Anggota</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal Bayar</th>
                      <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredMembers.map((m) => (
                      <tr key={m.id} className={`hover:bg-slate-50/60 transition-colors ${m.status === 'overdue' ? 'bg-red-50/40' : ''}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar initials={m.initials} color={m.color} />
                            <span className="font-semibold text-slate-800 text-sm">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><StatusBadge status={m.status} /></td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs font-medium">{m.date}</td>
                        <td className="px-5 py-3.5 text-right">
                          {m.status === 'pending' && (
                            <button
                              onClick={() => setReminded((p) => ({ ...p, [m.id]: true }))}
                              disabled={reminded[m.id]}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                reminded[m.id]
                                  ? 'bg-emerald-500 text-white cursor-default opacity-80'
                                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                              }`}
                            >
                              {reminded[m.id] ? <><Check className="w-3 h-3" />Terkirim</> : <><MessageCircle className="w-3 h-3" />Ingatkan WA</>}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 flex flex-col gap-5">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-[#0A2578] text-sm">Papan Giliran & Pemenang</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Historis SPSB Auction</p>
                </div>
                <TrendingUp className="w-4 h-4 text-[#5A83DB]" />
              </div>

              <div className="px-5 py-4 flex flex-col gap-3">
                {pastWinners.map((w) => (
                  <div key={w.cycle} className="flex items-center gap-3">
                    <Avatar initials={w.initials} color={w.color} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{w.name}</p>
                      <p className="text-[10px] text-slate-400">Siklus {w.cycle} · Menang Lelang</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL TOP-UP SANDBOX */}
      {showPayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-[#0A2578] text-lg">Top-Up Saldo Sandbox (Database Go)</h3>
              <button onClick={() => setPayModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-500">Uji coba <code>POST /api/v1/wallet/topup</code>. Saldo akan diperbarui instan di Supabase.</p>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700">Nominal Top-Up (Rp)</label>
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl font-mono text-lg font-bold text-[#0A2578]"
                placeholder="100000"
              />
            </div>
            <button
              onClick={handleSandboxTopUp}
              disabled={topUpLoading}
              className="w-full bg-[#0A2578] hover:bg-[#081d60] text-white font-bold py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {topUpLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Kirim Request Top-Up'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL REKENING BANK */}
      {showBankModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-[#0A2578] text-lg">Kelola Rekening Bank</h3>
              <button onClick={() => setBankModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddBank} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600">Nama Bank</label>
                <select 
                  value={newBankName} 
                  onChange={(e) => setNewBankName(e.target.value)}
                  className="w-full p-2.5 border rounded-xl text-sm font-semibold bg-slate-50"
                >
                  <option value="BCA">Bank BCA</option>
                  <option value="Mandiri">Bank Mandiri</option>
                  <option value="BNI">Bank BNI</option>
                  <option value="BRI">Bank BRI</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Nomor Rekening</label>
                <input 
                  type="text" 
                  value={newAccNo} 
                  onChange={(e) => setNewAccNo(e.target.value)}
                  placeholder="1234567890" 
                  className="w-full p-2.5 border rounded-xl text-sm font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Nama Pemilik Rekening</label>
                <input 
                  type="text" 
                  value={newAccHolder} 
                  onChange={(e) => setNewAccHolder(e.target.value)}
                  placeholder="Farrel Abda" 
                  className="w-full p-2.5 border rounded-xl text-sm font-semibold"
                />
              </div>
              <button type="submit" className="bg-[#0A2578] text-white font-bold py-2.5 rounded-xl text-sm hover:bg-[#081d60] transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" /> Simpan Rekening Baru
              </button>
            </form>

            <div className="border-t pt-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
              <p className="text-xs font-bold text-slate-400 uppercase">Rekening Saya di Database:</p>
              {bankAccounts.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Belum ada rekening tersimpan.</p>
              ) : (
                bankAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border text-xs">
                    <div>
                      <p className="font-bold text-[#0A2578]">{acc.bank_name} - {acc.account_number}</p>
                      <p className="text-slate-500">{acc.account_holder}</p>
                    </div>
                    <button onClick={() => handleDeleteBank(acc.id)} className="text-red-500 font-bold hover:underline flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}