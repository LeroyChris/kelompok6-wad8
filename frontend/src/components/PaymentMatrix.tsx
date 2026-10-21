import { useState, useMemo, useEffect } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { circleService } from '../services/circleService';

type Status = 'lunas' | 'pending' | 'belum_bayar';

interface Member {
  id: string;
  name: string;
  status: Status;
  amount: number;
  date: string | null;
  method: string | null;
}

const fmtRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

export default function PaymentMatrix({ circleId }: { circleId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 5;

  useEffect(() => {
    let isMounted = true;

    const fetchMatrix = async () => {
      if (!circleId) return;
      try {
        setLoading(true);
        const res = await circleService.getPaymentMatrix(circleId);
        
        // Ekstraksi array data yang tangguh terhadap struktur response API Supabase / Gin
        const raw = res.data;
        const dataList = Array.isArray(raw?.data?.items)
          ? raw.data.items
          : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw)
          ? raw
          : [];

        if (isMounted) setMembers(dataList);
      } catch {
        console.warn('Gagal memuat Payment Matrix dari backend.');
        if (isMounted) setMembers([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMatrix();

    return () => {
      isMounted = false;
    };
  }, [circleId]); // Hanya dipanggil ulang saat ID Circle berubah

  const filtered = useMemo(() => {
    return members.filter((m) =>
      !search || (m.name && m.name.toLowerCase().includes(search.toLowerCase()))
    );
  }, [search, members]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-black text-base text-[#0A2578]">Matriks Status Pembayaran Real-Time</h2>
            <p className="text-xs text-slate-400">Circle UUID: {circleId}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari anggota..."
                className="pl-9 pr-3 py-2 border rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#5A83DB]"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-400 font-bold">
            <RefreshCw className="w-5 h-5 animate-spin mr-2 text-[#5A83DB]" /> Memuat Data Matriks Pembayaran...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b font-bold text-slate-400 uppercase text-[10px]">
                    <th className="py-3 px-4">Anggota</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Nominal</th>
                    <th className="py-3 px-4">Tanggal & Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedMembers.map((m) => (
                    <tr key={m.id || m.name}>
                      <td className="py-3 px-4 font-bold text-slate-800">{m.name || 'Anggota'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            m.status === 'lunas'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {(m.status || 'BELUM BAYAR').replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{fmtRp(m.amount)}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {m.date || '—'} · {m.method || '—'}
                      </td>
                    </tr>
                  ))}
                  {paginatedMembers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                        Tidak ada data anggota / pembayaran ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t text-xs text-slate-500">
                <span>
                  Halaman {currentPage} dari {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 border rounded-lg disabled:opacity-30 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 border rounded-lg disabled:opacity-30 hover:bg-slate-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}