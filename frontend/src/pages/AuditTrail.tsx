import React, { useState, useCallback, useMemo } from 'react';
import {
  HandCoins, CheckCircle2, AlertCircle,
  ArrowLeft, Disc, Search, Lock, TrendingUp, CreditCard,
  Download, Copy, Check, Filter, ExternalLink, ShieldCheck,
  Activity, Hash,
} from 'lucide-react';

/* ─── Types ─── */
type TxType  = 'disbursement' | 'dues' | 'crowdfund' | 'spin' | 'penalty' | 'refund';
type TxStatus = 'validated' | 'pending';
type FilterKey = 'all' | TxType;

/* ─── Helpers ─── */
const fmtRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

/* ─── Audit log data ─── */
interface AuditLog {
  id: string;
  ts: string;
  type: TxType;
  label: string;
  member: string;
  amount: number;
  hash: string;
  status: TxStatus;
}

const AUDIT_LOGS: AuditLog[] = [
  {
    id: 'txn-001',
    ts: '18 Sep 2026 20:45',
    type: 'disbursement',
    label: 'Pencairan SPSB Siklus 3',
    member: 'Budi Santoso',
    amount: 15_000_000,
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'validated',
  },
  {
    id: 'txn-002',
    ts: '18 Sep 2026 19:12',
    type: 'dues',
    label: 'Iuran Bulanan Ahmad',
    member: 'Ahmad Rizky',
    amount: 1_000_000,
    hash: 'a8f5f167f44f4964e6c998dee827110c9a41b48d834cb4c1c1b2d4b07b1fa62c',
    status: 'validated',
  },
  {
    id: 'txn-003',
    ts: '17 Sep 2026 14:30',
    type: 'crowdfund',
    label: 'Patungan Modal Toko Budi',
    member: 'Farrel Abda',
    amount: 500_000,
    hash: 'c4ca4238a0b923820dcc509a6f75849b1ce3f9d67598f0e4d34e49b0c33b0f3e',
    status: 'validated',
  },
  {
    id: 'txn-004',
    ts: '17 Sep 2026 11:05',
    type: 'dues',
    label: 'Iuran Bulanan Siti',
    member: 'Siti Rahma',
    amount: 1_000_000,
    hash: 'd41d8cd98f00b204e9800998ecf8427e3f8a41b99f5af4d5e1a2b3c4d5e6f700',
    status: 'validated',
  },
  {
    id: 'txn-005',
    ts: '16 Sep 2026 09:45',
    type: 'spin',
    label: 'Pengocokan Roda Siklus 3',
    member: 'Sistem',
    amount: 0,
    hash: 'f1d2e3c4b5a6978869504132281718095867342578291019283746556473829102',
    status: 'validated',
  },
  {
    id: 'txn-006',
    ts: '15 Sep 2026 18:22',
    type: 'dues',
    label: 'Iuran Bulanan Eko',
    member: 'Eko Prasetyo',
    amount: 1_000_000,
    hash: '2f6a4d8e0c1b3a5f7e9d2b4c6a8f0e1d3c5b7a9e0f2d4b6c8a1e3f5d7b9c2a4',
    status: 'validated',
  },
  {
    id: 'txn-007',
    ts: '15 Sep 2026 16:07',
    type: 'penalty',
    label: 'Denda Keterlambatan Deni',
    member: 'Deni Setiawan',
    amount: 50_000,
    hash: '9b74e4b2d1c3f5e7a9b0c2d4f6e8a0b1c3d5e7f9a1b3c5d7e9f0a2b4c6d8e0f1',
    status: 'validated',
  },
  {
    id: 'txn-008',
    ts: '14 Sep 2026 10:30',
    type: 'disbursement',
    label: 'Pencairan Patungan Futsal',
    member: 'Komunitas',
    amount: 1_500_000,
    hash: '3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b',
    status: 'validated',
  },
  {
    id: 'txn-009',
    ts: '13 Sep 2026 14:15',
    type: 'dues',
    label: 'Iuran Bulanan Rina',
    member: 'Rina Wijaya',
    amount: 1_000_000,
    hash: '4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c',
    status: 'validated',
  },
  {
    id: 'txn-010',
    ts: '12 Sep 2026 09:00',
    type: 'refund',
    label: 'Refund Bid Batal Siklus 2',
    member: 'Farrel Abda',
    amount: 250_000,
    hash: '5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d',
    status: 'validated',
  },
  {
    id: 'txn-011',
    ts: '11 Sep 2026 17:45',
    type: 'crowdfund',
    label: 'Patungan Modal Toko Budi',
    member: 'Santi Putri',
    amount: 250_000,
    hash: '6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e',
    status: 'validated',
  },
  {
    id: 'txn-012',
    ts: '10 Sep 2026 11:20',
    type: 'dues',
    label: 'Iuran Bulanan Budi',
    member: 'Budi Santoso',
    amount: 1_000_000,
    hash: '7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f',
    status: 'validated',
  },
];

/* ─── Tx type config ─── */
const TX_TYPE_CONFIG: Record<TxType, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  disbursement: { label: 'Pencairan',  bg: 'bg-indigo-100',  text: 'text-indigo-800',  icon: <TrendingUp className="w-3 h-3" />  },
  dues:         { label: 'Iuran',      bg: 'bg-[#5A83DB]/12',text: 'text-[#0A2578]',   icon: <CreditCard className="w-3 h-3" /> },
  crowdfund:    { label: 'Patungan',   bg: 'bg-amber-100',   text: 'text-amber-800',   icon: <HandCoins className="w-3 h-3" />  },
  spin:         { label: 'Pengocokan', bg: 'bg-pink-100',    text: 'text-pink-800',    icon: <Disc className="w-3 h-3" />       },
  penalty:      { label: 'Denda',      bg: 'bg-red-100',     text: 'text-red-800',     icon: <AlertCircle className="w-3 h-3" />},
  refund:       { label: 'Refund',     bg: 'bg-teal-100',    text: 'text-teal-800',    icon: <ExternalLink className="w-3 h-3" />},
};


/* ─── Hash verifier state ─── */
type VerifyResult = 'valid' | 'invalid' | null;

/* ─── Props ─── */
export interface AuditTrailProps {
  onBack:                  () => void;
  onNavigateToAuction?:    () => void;
  onNavigateToCrowdfund?:  () => void;
  embedded?:               boolean;
}

/* ─── Main Component ─── */
export default function AuditTrail({
  onBack                = () => {},
}: AuditTrailProps) {
  const [filter, setFilter]             = useState<FilterKey>('all');
  const [searchQ, setSearchQ]           = useState('');
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [copied, setCopied]             = useState<string | null>(null);
  const [verifyInput, setVerifyInput]   = useState('');
  const [verifyResult, setVerifyResult] = useState<VerifyResult>(null);
  const [verifyLoading, setVerifyLoad]  = useState(false);
  const [showAll, setShowAll]           = useState(false);

  const copyHash = useCallback((hash: string) => {
    navigator.clipboard.writeText(hash).catch(() => {});
    setCopied(hash);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleVerify = useCallback(() => {
    if (!verifyInput.trim()) return;
    setVerifyLoad(true);
    setTimeout(() => {
      const found = AUDIT_LOGS.some((l) => l.hash.startsWith(verifyInput.trim().toLowerCase().replace(/\./g, '')));
      setVerifyResult(found ? 'valid' : 'invalid');
      setVerifyLoad(false);
    }, 900);
  }, [verifyInput]);

  const filtered = useMemo(() => {
    return AUDIT_LOGS.filter((l) => {
      const matchType   = filter === 'all' || l.type === filter;
      const matchSearch = !searchQ || l.label.toLowerCase().includes(searchQ.toLowerCase()) || l.member.toLowerCase().includes(searchQ.toLowerCase());
      return matchType && matchSearch;
    });
  }, [filter, searchQ]);

  const displayed = showAll ? filtered : filtered.slice(0, 8);
  const totalValidated = AUDIT_LOGS.filter((l) => l.status === 'validated').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Top bar */}
      <header className="shrink-0 z-20 bg-white border-b border-slate-200/80 px-4 md:px-6 py-3.5 flex items-center gap-3 shadow-sm">
          <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-400 flex-1 min-w-0">
            <button onClick={onBack} className="flex items-center gap-1 hover:text-[#0A2578] transition-colors shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Dashboard</span>
            </button>
            <span className="mx-0.5 text-slate-300">›</span>
            <span className="font-bold text-[#0A2578] truncate">Audit Trail SHA-256</span>
          </nav>
          <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
            <Activity className="w-3 h-3" />
            {totalValidated} Valid
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 pb-24 flex flex-col gap-6">

          {/* ── Hero Bar ── */}
          <div className="bg-[#0A2578] rounded-2xl p-6 md:p-8 shadow-xl shadow-[#0A2578]/20">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/20 text-white/80 text-xs font-bold rounded-full">
                    <Hash className="w-3 h-3 text-[#5A83DB]" />
                    SHA-256 Immutable Log
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-full">
                    <ShieldCheck className="w-3 h-3" />
                    100% Terverifikasi
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
                  Transparansi Audit Trail & Log Terenkripsi
                </h1>
                <p className="text-sm text-white/60 max-w-xl leading-relaxed">
                  Seluruh alokasi iuran, pencairan lelang SPSB, dan pengocokan roda dicatat dalam Immutable SHA-256 Hash Log yang tidak dapat dimanipulasi.
                </p>
              </div>

              {/* Verified stat */}
              <div className="bg-white/10 border border-white/15 rounded-2xl p-5 min-w-[210px] shrink-0">
                <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-2">Total Resi Terverifikasi</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-extrabold text-white font-mono">{totalValidated}</span>
                  <span className="text-sm text-white/50 font-medium mb-1">transaksi</span>
                </div>
                <div className="h-1.5 bg-white/15 rounded-full mt-3 overflow-hidden">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
                </div>
                <p className="text-[10px] text-emerald-300 font-bold mt-1.5">100% Valid · 0 Anomali</p>
              </div>
            </div>

            {/* Stats strip */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Volume',       value: fmtRp(AUDIT_LOGS.reduce((s, l) => s + l.amount, 0)) },
                { label: 'Pencairan Pot',      value: fmtRp(AUDIT_LOGS.filter(l => l.type === 'disbursement').reduce((s, l) => s + l.amount, 0)) },
                { label: 'Iuran Dikumpulkan',  value: fmtRp(AUDIT_LOGS.filter(l => l.type === 'dues').reduce((s, l) => s + l.amount, 0)) },
                { label: 'Hash Anomali',       value: '0' },
              ].map((s) => (
                <div key={s.label} className="bg-white/10 border border-white/15 rounded-xl p-3.5">
                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-1">{s.label}</p>
                  <p className="text-base font-extrabold text-white font-mono leading-none">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bento Grid ── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

            {/* ── LEFT 8 COLS: Audit Log Table ── */}
            <div className="xl:col-span-8">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md overflow-hidden">

                {/* Table toolbar */}
                <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <h3 className="font-black text-[#0A2578] text-sm">Log Transaksi Teraudit</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{filtered.length} entri · terurut dari terbaru</p>
                  </div>

                  {/* Search */}
                  <div className="flex items-center gap-2 flex-1 sm:max-w-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-[#5A83DB] focus-within:ring-1 focus-within:ring-[#5A83DB]/20 transition-all">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                      placeholder="Cari transaksi..."
                      className="w-full text-xs font-medium bg-transparent focus:outline-none placeholder:text-slate-400 text-slate-700"
                    />
                  </div>

                  {/* Export */}
                  <button className="flex items-center gap-1.5 text-xs font-bold text-[#5A83DB] hover:text-[#0A2578] border border-[#5A83DB]/30 hover:border-[#0A2578]/30 px-3 py-2 rounded-xl transition-all whitespace-nowrap">
                    <Download className="w-3.5 h-3.5" />
                    Ekspor CSV
                  </button>
                </div>

                {/* Type filter pills */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {([
                    { id: 'all', label: 'Semua' },
                    { id: 'disbursement', label: 'Pencairan' },
                    { id: 'dues', label: 'Iuran' },
                    { id: 'crowdfund', label: 'Patungan' },
                    { id: 'spin', label: 'Pengocokan' },
                    { id: 'penalty', label: 'Denda' },
                  ] as Array<{ id: FilterKey; label: string }>).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`shrink-0 text-[10px] font-black px-3 py-1.5 rounded-lg transition-all ${
                        filter === f.id
                          ? 'bg-[#0A2578] text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['Waktu', 'Tipe Transaksi', 'Nominal', 'Hash SHA-256', 'Status'].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayed.map((log) => {
                        const tc = TX_TYPE_CONFIG[log.type];
                        const isExpanded = expandedHash === log.id;
                        const isCopied = copied === log.hash;
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Timestamp */}
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <p className="text-xs font-bold text-slate-700">{log.ts.split(' ').slice(0, 3).join(' ')}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{log.ts.split(' ').slice(3).join(' ')}</p>
                            </td>

                            {/* Type */}
                            <td className="px-5 py-3.5">
                              <div className="flex flex-col gap-1.5">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg w-fit ${tc.bg} ${tc.text}`}>
                                  {tc.icon}
                                  {tc.label}
                                </span>
                                <p className="text-xs font-semibold text-slate-700 max-w-[160px] truncate">{log.label}</p>
                                <p className="text-[10px] text-slate-400">{log.member}</p>
                              </div>
                            </td>

                            {/* Amount */}
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              {log.amount > 0
                                ? <p className="text-sm font-black text-[#0A2578] font-mono">{fmtRp(log.amount)}</p>
                                : <p className="text-xs text-slate-400 italic font-medium">Sistem</p>}
                            </td>

                            {/* Hash */}
                            <td className="px-5 py-3.5">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setExpandedHash(isExpanded ? null : log.id)}
                                    className="font-mono text-[10px] text-slate-500 hover:text-[#0A2578] transition-colors text-left"
                                  >
                                    {isExpanded
                                      ? <span className="break-all text-[#0A2578]">{log.hash}</span>
                                      : `${log.hash.slice(0, 16)}...`}
                                  </button>
                                  <button
                                    onClick={() => copyHash(log.hash)}
                                    className="shrink-0 text-slate-300 hover:text-[#5A83DB] transition-colors"
                                  >
                                    {isCopied
                                      ? <Check className="w-3 h-3 text-emerald-500" />
                                      : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                <CheckCircle2 className="w-3 h-3" />
                                VALIDATED
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Load more */}
                {filtered.length > 8 && (
                  <div className="px-5 py-4 border-t border-slate-100 flex justify-center">
                    <button
                      onClick={() => setShowAll((v) => !v)}
                      className="text-xs font-bold text-[#5A83DB] hover:text-[#0A2578] transition-colors flex items-center gap-1.5"
                    >
                      {showAll
                        ? 'Tampilkan lebih sedikit'
                        : `Muat ${filtered.length - 8} entri lainnya`}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT 4 COLS ── */}
            <div className="xl:col-span-4 flex flex-col gap-5">

              {/* Card 1: Hash Verifier */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-black text-[#0A2578] text-sm">Verifikasi Resi Mandiri</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Hash Inspector · Self-serve</p>
                </div>
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-600">SHA-256 Hash</label>
                    <div className="relative">
                      <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
                      <input
                        type="text"
                        value={verifyInput}
                        onChange={(e) => { setVerifyInput(e.target.value); setVerifyResult(null); }}
                        placeholder="Tempelkan SHA-256 Hash di sini..."
                        className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-xs font-mono placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/25 focus:border-[#5A83DB] bg-slate-50 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleVerify}
                    disabled={!verifyInput.trim() || verifyLoading}
                    className={`w-full py-3 font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 text-sm ${
                      !verifyInput.trim()
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-[#0A2578] hover:bg-[#0A2578]/90 text-white shadow-md shadow-[#0A2578]/20 active:scale-[0.97]'
                    }`}
                  >
                    {verifyLoading
                      ? <><ShieldCheck className="w-4 h-4 animate-pulse" />Memverifikasi...</>
                      : <><ShieldCheck className="w-4 h-4" />Verifikasi Keaslian Resi</>}
                  </button>

                  {verifyResult === 'valid' && (
                    <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black text-emerald-800">VALID — Hash Ditemukan</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5 leading-relaxed">Hash cocok 100% dengan database log terenkripsi Circle ini.</p>
                      </div>
                    </div>
                  )}

                  {verifyResult === 'invalid' && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black text-red-800">TIDAK VALID — Hash Tidak Dikenal</p>
                        <p className="text-[10px] text-red-700 mt-0.5 leading-relaxed">Hash tidak ditemukan dalam log Circle ini. Pastikan hash yang Anda tempel sudah benar.</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-900 rounded-xl px-3.5 py-3 flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 animate-pulse" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Sample Hash (Siklus 3)</p>
                      <p className="font-mono text-[9px] text-emerald-400 break-all leading-relaxed">
                        e3b0c44298fc1c149afbf4c8996fb924...
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Non-Custodial Certificate */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-black text-[#0A2578] text-sm">Sertifikat Non-Custodial SaaS</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Proof of clean architecture</p>
                </div>
                <div className="p-5 flex flex-col gap-4">
                  {/* Certificate badge */}
                  <div className="bg-[#0A2578] rounded-2xl p-5 flex flex-col items-center gap-3 text-center">
                    <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center">
                      <Lock className="w-7 h-7 text-emerald-300" />
                    </div>
                    <div>
                      <p className="font-black text-white text-sm">ArisanKita Certified</p>
                      <p className="text-[10px] text-emerald-300 font-bold mt-0.5">NON-CUSTODIAL PLATFORM</p>
                    </div>
                    <p className="text-[10px] text-white/60 leading-relaxed">
                      Platform ArisanKita terbebas dari penampungan dana publik. Data log cocok 100% dengan API Payment Gateway resmi BI.
                    </p>
                  </div>

                  {/* Verification checklist */}
                  <div className="flex flex-col gap-2">
                    {[
                      'Zero dana tersimpan di server ArisanKita',
                      'Transfer langsung via Midtrans / VA Bank',
                      'SHA-256 hash diverifikasi real-time',
                      'Log audit tersimpan immutable di cloud',
                      'Sesuai regulasi KBLI 63122 SaaS BI',
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>

                  {/* Last sync */}
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <p className="text-[10px] text-emerald-800 font-bold">Sinkronisasi API Terakhir: 18 Sep 2026 · 20:45 WIB</p>
                  </div>
                </div>
              </div>

              {/* Card 3: Quick stats by type */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-black text-[#0A2578] text-sm">Distribusi Log per Tipe</h3>
                </div>
                <div className="p-5 flex flex-col gap-2.5">
                  {(Object.entries(TX_TYPE_CONFIG) as Array<[TxType, typeof TX_TYPE_CONFIG[TxType]]>).map(([key, cfg]) => {
                    const count = AUDIT_LOGS.filter((l) => l.type === key).length;
                    const pct   = Math.round((count / AUDIT_LOGS.length) * 100);
                    if (count === 0) return null;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded shrink-0 ${cfg.bg} ${cfg.text}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#5A83DB] to-[#0A2578]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-black text-slate-600 shrink-0">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>
    </div>
  );
}
