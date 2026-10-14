import { useState, useMemo, useEffect } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { circleService } from '../services/circleService';

type TrackType = 'TRACK_A' | 'TRACK_B';
type Status    = 'lunas' | 'pending' | 'belum_bayar';
type FilterKey = 'all' | Status;

interface Member {
  id:       string;
  name:     string;
  initials: string;
  color:    string;
  status:   Status;
  amount:   number;
  date:     string | null;
  method:   string | null;
  hash:     string | null;
}

const fmtRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export default function PaymentMatrix({
  circleId = 'ARK-8891',
}: {
  onBack?:         () => void;
  trackType?:     TrackType;
  userRole?:      'leader' | 'member';
  circleId?:      string;
  embedded?:      boolean;
  onOpenPayment?: () => void;
}) {
  const [members, setMembers]         = useState<Member[]>([]);
  const [loading, setLoading]         = useState<boolean>(true);
  const [filter, setFilter]           = useState<FilterKey>('all');
  const [search, setSearch]           = useState<string>('');

  /* ── State Pagination ── */
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 5;

  useEffect(() => {
    let isMounted = true;
    const fetchMatrix = async () => {
      try {
        setLoading(true);
        const res = await circleService.getPaymentMatrix(circleId);
        if (res.data?.data && isMounted) {
          setMembers(res.data.data);
        }
      } catch {
        console.warn('Gagal memuat Payment Matrix dari backend.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchMatrix();
    return () => { isMounted = false; };
  }, [circleId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  const filtered = useMemo(() => members.filter((m) => {
    const matchFilter = filter === 'all' || m.status === filter;
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  }), [filter, search, members]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 pb-24">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-black text-base text-[#0A2578]">Matriks Status Pembayaran Real-Time</h2>
            <p className="text-xs text-slate-400 mt-0.5">Circle: {circleId} · {members.length} anggota total</p>
          </div>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari anggota..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/30 bg-slate-50"
            />
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'lunas', 'pending', 'belum_bayar'] as FilterKey[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all border ${
                filter === f
                  ? 'bg-[#0A2578] text-white border-[#0A2578]'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-[#0A2578]/30'
              }`}
            >
              {f === 'all' ? `Semua (${members.length})` : f.toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-400 font-bold animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Memuat Data Matriks Pembayaran...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left">
                <thead>
                  <tr className="border-b text-xs font-bold text-slate-400 uppercase bg-slate-50">
                    <th className="py-3 px-4">Anggota</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Nominal</th>
                    <th className="py-3 px-4">Tanggal & Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {paginatedMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800">{m.name}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                          m.status === 'lunas'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-red-100 text-red-800 border-red-200'
                        }`}>
                          {m.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold">{fmtRp(m.amount)}</td>
                      <td className="py-3 px-4 text-xs text-slate-500">{m.date || '—'} · {m.method || '—'}</td>
                    </tr>
                  ))}
                  {paginatedMembers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                        Tidak ada data anggota ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4 px-2">
              <span className="text-xs text-slate-500 font-medium">
                Menampilkan <span className="font-bold text-[#0A2578]">{paginatedMembers.length}</span> dari <span className="font-bold text-[#0A2578]">{filtered.length}</span> anggota
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-[#0A2578] px-2">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}