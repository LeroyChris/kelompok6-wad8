import { useEffect, useState } from 'react';
import { circleService } from '../services/circleService';

type Row = { obligation_id: string; full_name: string; amount_due: number; obligation_status: string; payment_method?: string; paid_at?: string; cycle_number: number };
export default function PaymentMatrix({ circleId }: { circleId: string }) {
 const [rows, setRows] = useState<Row[]>([]); const [error, setError] = useState('');
 useEffect(() => { circleService.getPaymentMatrix(circleId).then((response) => setRows(response.data?.data?.items ?? [])).catch(() => setError('Matriks pembayaran tidak dapat dimuat.')); }, [circleId]);
 return <section className="p-4 sm:p-6"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-black text-slate-800">Matriks Pembayaran</h2>{error && <p className="mt-3 text-sm text-[#991B1B]">{error}</p>}<div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr><th>Cycle</th><th>Anggota</th><th>Nominal</th><th>Status</th><th>Metode</th></tr></thead><tbody>{rows.map((row) => <tr key={row.obligation_id} className="border-t"><td className="py-3">#{row.cycle_number}</td><td>{row.full_name}</td><td>Rp {row.amount_due.toLocaleString('id-ID')}</td><td><span className={row.obligation_status === 'PAID' ? 'font-bold text-[#065F46]' : 'font-bold text-[#991B1B]'}>{row.obligation_status}</span></td><td>{row.payment_method ?? '—'}</td></tr>)}{!error && rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Belum ada obligation.</td></tr>}</tbody></table></div></div></section>;
}
