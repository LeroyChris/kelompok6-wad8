import { useState, useEffect } from 'react';
import PaymentModal from "../components/PaymentModal";
import {
  Copy,
  Check,
  Bell,
  MessageCircle,
  TrendingUp,
  Users,
  Wallet,
  Calendar,
  Clock,
  AlertTriangle,
  Star,
  BarChart3,
  ArrowRight,
  Zap,
  X,
  CreditCard,
  QrCode,
  Search,
  Gavel,
  HandCoins,
  Filter,
  Smartphone,
} from 'lucide-react';

/* ─── Types ─── */
type StatusKey = 'lunas' | 'pending' | 'overdue';
type Filter = 'all' | 'lunas' | 'unpaid';

/* ─── Data ─── */
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

/* ─── Countdown Hook ─── */
function useCountdown(initial: number) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${h}j : ${m}m : ${s}d`;
}

/* ─── Props ─── */
export interface DashboardProps {
  onBack:         () => void;
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
  const [showAuction, setAuction]     = useState(false);
  const [joined, setJoined]           = useState(false);
  const [searchQuery, setSearch]      = useState('');
  const [hoveredBar, setHoveredBar]   = useState<number | null>(null);
  const countdown = useCountdown(9912); // ~2h 45m 12s

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

      {/* Top App Header Bar */}
      <header className="shrink-0 z-20 bg-white border-b border-slate-200/80 px-4 md:px-6 py-3.5 flex items-center gap-3 shadow-sm">

          {/* Track Badge */}
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5A83DB]/15 text-[#0A2578] border border-[#5A83DB]/25 text-xs font-bold rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5A83DB] animate-pulse" />
            Mode Aktif: Track A (Lelang SPSB)
          </span>

          {/* Search */}
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
            {/* Invite Code Pill */}
            <div className="hidden sm:flex items-center gap-2 bg-[#0A2578]/6 border border-[#0A2578]/15 rounded-xl px-3 py-2">
              <code className="text-xs font-black text-[#0A2578] font-mono tracking-widest">ARK-8891</code>
              <button onClick={handleCopy} className="text-[#5A83DB] hover:text-[#0A2578] transition-colors" title="Salin kode">
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            {/* Bell */}
            <button className="relative w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F84A4D] rounded-full ring-1 ring-white" />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 pb-28 lg:pb-10 flex flex-col gap-6">

          {/* ── ROW 1: KPI Overview Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* Card 1 — Total Pot (Navy) */}
            <div className="bg-[#0A2578] text-white rounded-2xl p-5 flex flex-col gap-4 shadow-lg shadow-[#0A2578]/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Total Pot</p>
                  <p className="text-xs text-white/70 font-semibold mt-0.5">Siklus 4 dari 15</p>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Aktif
                </span>
              </div>
              <p className="text-3xl font-extrabold text-white tracking-tight">Rp 15.000.000</p>
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => setPayModal(true)}
                  className="flex-1 bg-[#F84A4D] hover:bg-[#e03a3d] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all shadow-md shadow-[#F84A4D]/30 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" /> Bayar Iuran
                </button>
                <button className="flex-1 border border-white/25 text-white text-xs font-bold py-2.5 px-3 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" /> Tarik Dana
                </button>
              </div>
            </div>

            {/* Card 2 — Dues Progress (White) */}
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
                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium mt-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Lunas: {lunasCount}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Pending: {pendingCount}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#9E002D]" /> Menunggak: {overdueCount}</span>
                </div>
              </div>
            </div>

            {/* Card 3 — Auction Status (White) */}
            <div className="bg-white rounded-2xl p-5 flex flex-col gap-4 border border-slate-200/80 shadow-sm sm:col-span-2 lg:col-span-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status Lelang SPSB</p>
                  <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-bold bg-[#5A83DB]/15 text-[#0A2578] border border-[#5A83DB]/25 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5A83DB] animate-pulse" />
                    BIDDING OPEN
                  </span>
                </div>
                <div className="w-10 h-10 bg-[#5A83DB]/10 rounded-xl flex items-center justify-center shrink-0">
                  <Gavel className="w-5 h-5 text-[#5A83DB]" />
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <Clock className="w-4 h-4 text-[#F84A4D] shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Sisa Waktu Bidding</p>
                  <p className="text-base font-extrabold text-[#0A2578] font-mono tracking-wide">{countdown}</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate?.('auction')}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-[#F84A4D] hover:bg-[#e03a3d] rounded-xl transition-all shadow-md shadow-[#F84A4D]/25 active:scale-95"
              >
                <Zap className="w-4 h-4" /> Masuk Room Lelang
              </button>
            </div>
          </div>

          {/* ── ROW 2: Bento Main Content Grid ── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

            {/* LEFT 8 COLS */}
            <div className="xl:col-span-8 flex flex-col gap-5">

              {/* Card A: Cash Flow Micro-Chart */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-[#0A2578] text-sm">Analisis Arus Kas Iuran</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Persentase koleksi dues per siklus</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#5A83DB]">
                    <BarChart3 className="w-4 h-4" />
                    6 Siklus Terakhir
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="flex items-end gap-3 h-28 relative">
                  {/* Y-axis lines */}
                  {[25, 50, 75, 100].map((line) => (
                    <div
                      key={line}
                      className="absolute left-0 right-0 border-t border-dashed border-slate-100"
                      style={{ bottom: `${line}%` }}
                    />
                  ))}
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
                        {/* Tooltip */}
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

                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-400 pt-1 border-t border-slate-100">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gradient-to-r from-emerald-600 to-emerald-400" /> 100% Koleksi</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gradient-to-r from-[#5A83DB] to-[#7aa3e8]" /> ≥ 80%</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-gradient-to-r from-amber-500 to-amber-400" /> &lt; 80%</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-slate-100 border border-dashed border-slate-200" /> Mendatang</span>
                </div>
              </div>

              {/* Card B: Payment Matrix */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                {/* Card Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-extrabold text-[#0A2578] text-sm">Matriks Pembayaran Anggota</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Siklus 4 — Jatuh tempo 25 Okt 2026</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    {([['all', `Semua (${members.length})`], ['lunas', `Lunas (${lunasCount})`], ['unpaid', `Belum Bayar (${pendingCount + overdueCount})`]] as [Filter, string][]).map(([f, label]) => (
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

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Anggota</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal Bayar</th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Metode</th>
                        <th className="text-right px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredMembers.map((m) => (
                        <tr
                          key={m.id}
                          className={`hover:bg-slate-50/60 transition-colors ${m.status === 'overdue' ? 'bg-red-50/40' : ''}`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar initials={m.initials} color={m.color} />
                              <span className="font-semibold text-slate-800 text-sm">{m.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5"><StatusBadge status={m.status} /></td>
                          <td className="px-4 py-3.5 text-slate-500 text-xs font-medium">{m.date}</td>
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            {m.method !== '—' ? (
                              <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                {m.method.includes('QRIS') ? <QrCode className="w-3.5 h-3.5" /> :
                                 m.method.includes('E-Wallet') ? <Smartphone className="w-3.5 h-3.5" /> :
                                 <CreditCard className="w-3.5 h-3.5" />}
                                {m.method}
                              </span>
                            ) : <span className="text-slate-300 text-sm">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {m.status === 'pending' && (
                              <button
                                onClick={() => setReminded((p) => ({ ...p, [m.id]: true }))}
                                disabled={reminded[m.id]}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                  reminded[m.id]
                                    ? 'bg-emerald-500 text-white cursor-default opacity-80'
                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/30 active:scale-95'
                                }`}
                              >
                                {reminded[m.id] ? <><Check className="w-3 h-3" />Terkirim</> : <><MessageCircle className="w-3 h-3" />Ingatkan WA</>}
                              </button>
                            )}
                            {m.status === 'overdue' && (
                              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/30 transition-all active:scale-95">
                                <AlertTriangle className="w-3 h-3" />Denda +1%
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredMembers.length === 0 && (
                    <div className="py-12 text-center text-slate-400 text-sm font-medium">
                      Tidak ada anggota yang cocok.
                    </div>
                  )}
                </div>

                {/* Table Footer */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>{lunasCount}/{members.length} anggota sudah bayar</span>
                  <button className="flex items-center gap-1.5 text-[#5A83DB] font-bold hover:text-[#0A2578] transition-colors">
                    <Filter className="w-3 h-3" /> Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT 4 COLS */}
            <div className="xl:col-span-4 flex flex-col gap-5">

              {/* Card C: Turn Board & Historical Winners */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-[#0A2578] text-sm">Papan Giliran & Pemenang</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Historis SPSB Auction</p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-[#5A83DB]" />
                </div>

                {/* Past Winners */}
                <div className="px-5 py-4 flex flex-col gap-3 border-b border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Riwayat Pemenang Lelang</p>
                  {pastWinners.map((w) => (
                    <div key={w.cycle} className="flex items-center gap-3">
                      <Avatar initials={w.initials} color={w.color} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{w.name}</p>
                        <p className="text-[10px] text-slate-400">Siklus {w.cycle} · Menang Lelang</p>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 bg-[#5A83DB]/10 text-[#0A2578] rounded-lg text-xs font-bold shrink-0">
                        <TrendingUp className="w-3 h-3 text-[#5A83DB]" />
                        {w.rate}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Eligible Queue */}
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Antrian Eligible Siklus 4</p>
                    <span className="text-[10px] font-bold text-[#0A2578] bg-[#0A2578]/8 px-2 py-0.5 rounded-full">11 anggota</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['Ahmad', 'Farrel', 'Budi', 'Deni', 'Santi', 'Hendra', 'Toni', 'Mega', 'Rudi', 'Lina', 'Yudi'].map((name) => (
                      <span key={name} className="text-[10px] font-semibold px-2 py-1 bg-slate-50 border border-slate-200 text-slate-500 rounded-full">
                        {name}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => onNavigate?.('auction')}
                    className="mt-3 flex items-center gap-1 text-xs font-bold text-[#5A83DB] hover:text-[#0A2578] transition-colors"
                  >
                    Lihat Detail Lelang
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Card D: Crowdfunding */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-[#0A2578] text-sm">Patungan Modal Internal</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Crowdfunding Komunitas</p>
                  </div>
                  <HandCoins className="w-4 h-4 text-[#5A83DB]" />
                </div>
                <div className="px-5 py-5 flex flex-col gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">Tambahan Modal Toko Budi</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Berakhir 30 Okt 2026
                        </p>
                      </div>
                      <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg shrink-0">75%</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-gradient-to-r from-[#5A83DB] to-emerald-500 rounded-full" />
                      </div>
                      <div className="flex justify-between text-[10px] font-semibold">
                        <span className="text-emerald-700">Rp 3.750.000</span>
                        <span className="text-slate-400">Target: Rp 5.000.000</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1.5">
                        {['AR', 'FA', 'SP'].map((ini, i) => (
                          <div key={i} className="w-5 h-5 rounded-full bg-gradient-to-br from-[#5A83DB] to-[#0A2578] border-2 border-white flex items-center justify-center text-[8px] font-bold text-white">
                            {ini}
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400">+9 kontributor</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setJoined((v) => !v)}
                    className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${
                      joined
                        ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200'
                        : 'bg-[#5A83DB] hover:bg-[#4a72ca] text-white shadow-md shadow-[#5A83DB]/25'
                    }`}
                  >
                    {joined ? <><Check className="w-4 h-4" />Sudah Bergabung!</> : <><Wallet className="w-4 h-4" />Ikut Patungan</>}
                  </button>
                </div>
              </div>

              {/* Stats Mini Card */}
              <div className="bg-[#0A2578] rounded-2xl p-5 text-white flex flex-col gap-3">
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Statistik Circle</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Total Anggota', value: '15', icon: <Users className="w-4 h-4" /> },
                    { label: 'Tingkat Lunas', value: '87%',  icon: <Check className="w-4 h-4" /> },
                    { label: 'Reputasi Circle', value: '94/100', icon: <Star className="w-4 h-4" /> },
                    { label: 'Sisa Siklus',  value: '11', icon: <Calendar className="w-4 h-4" /> },
                  ].map((s) => (
                    <div key={s.label} className="bg-white/10 rounded-xl p-3 flex flex-col gap-1.5">
                      <span className="text-white/50">{s.icon}</span>
                      <p className="text-lg font-extrabold leading-none">{s.value}</p>
                      <p className="text-[9px] text-white/40 font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

      {/* ── Mobile Fixed Dock ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#0A2578]/95 backdrop-blur-md text-white px-4 py-3 flex items-center justify-between gap-3 border-t border-white/10 shadow-2xl">
        <div className="min-w-0">
          <p className="text-[9px] text-white/50 font-bold uppercase tracking-wide">Status Anda</p>
          <p className="text-xs font-bold text-amber-300 truncate">Belum Bayar Iuran (Rp 1.000.000)</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate?.('auction')}
            className="text-xs font-bold text-white border border-white/25 hover:bg-white/10 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden xs:block">Lelang</span>
          </button>
          <button
            onClick={() => setPayModal(true)}
            className="bg-[#F84A4D] hover:bg-[#e03a3d] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-[#F84A4D]/30 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" /> Bayar Sekarang
          </button>
        </div>
      </div>

      {/* ── Pay Modal ── */}
      <PaymentModal
        isOpen={showPayModal}
        onClose={() => setPayModal(false)}
        amount={1_000_000}
        purpose="Iuran Bulanan Siklus 4"
      />

      {/* ── Auction Modal ── */}
      {showAuction && (
        <div
          className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/50 backdrop-blur-sm lg:p-4"
          onClick={(e) => e.target === e.currentTarget && setAuction(false)}
        >
          <div className="bg-white w-full lg:max-w-md rounded-t-[28px] lg:rounded-3xl shadow-2xl overflow-hidden">
            <div className="w-full flex justify-center pt-3 pb-1 lg:hidden"><div className="w-12 h-1.5 bg-slate-200 rounded-full" /></div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-extrabold text-lg text-[#0A2578]">Room Lelang SPSB — Siklus 4</h2>
                <p className="text-xs text-slate-400 mt-0.5">Sealed Price Second Bid Auction</p>
              </div>
              <button onClick={() => setAuction(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5 pb-10 lg:pb-6">
              <div className="p-4 bg-[#0A2578] rounded-2xl text-white flex flex-col gap-2">
                <p className="text-xs text-white/60 font-bold uppercase tracking-wider">Pot Siklus 4</p>
                <p className="text-3xl font-extrabold">Rp 15.000.000</p>
                <div className="flex items-center gap-2 mt-1 bg-white/10 rounded-xl px-3 py-2">
                  <Clock className="w-3.5 h-3.5 text-[#F84A4D]" />
                  <div>
                    <p className="text-[10px] text-white/50">Sisa Waktu Bidding</p>
                    <p className="text-sm font-extrabold font-mono tracking-wide">{countdown}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[#0A2578]">Tawaran Bunga Anda (%)</label>
                <input
                  type="number"
                  placeholder="Contoh: 2.5"
                  min="0" max="10" step="0.1"
                  className="w-full px-4 py-4 border-2 border-slate-200 rounded-xl text-2xl font-extrabold text-[#0A2578] text-center focus:border-[#5A83DB] focus:ring-2 focus:ring-[#5A83DB]/25 outline-none transition-all bg-slate-50 focus:bg-white font-mono"
                />
                <p className="text-xs text-slate-400 text-center">Tawaran terendah memenangkan lelang (SPSB rules)</p>
              </div>
              <button
                onClick={() => setAuction(false)}
                className="w-full bg-[#F84A4D] hover:bg-[#e03a3d] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-[#F84A4D]/25 active:scale-95 flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" /> Ajukan Tawaran Sealed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
