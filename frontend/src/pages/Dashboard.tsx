import { useState, useEffect } from 'react';
import { userWalletService } from '../services/userWalletService';
import { circleService } from '../services/circleService';
import { Gavel, Disc, Copy, Check, Users, KeyRound } from 'lucide-react';

export default function Dashboard({ 
  circleId, 
  onNavigate 
}: { 
  circleId: string; 
  onNavigate?: (screen: string) => void;
}) {
  const [members, setMembers] = useState<any[]>([]);
  const [circleDetail, setCircleDetail] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [reputationScore, setReputationScore] = useState<number>(100);
  const [profileName, setProfileName] = useState<string>('Pengguna');
  const [apiLoading, setApiLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchBackendData = async () => {
    if (!circleId) return;
    try {
      setApiLoading(true);
      const [resWallet, resProfile, resRep, resMembers, resDetail] = await Promise.allSettled([
        userWalletService.getWalletBalance(),
        userWalletService.getProfile(),
        userWalletService.getReputation(),
        circleService.getCircleMembers(circleId),
        circleService.getCircleDetail(circleId),
      ]);

      if (resWallet.status === 'fulfilled' && resWallet.value.data?.data) {
        setWalletBalance(resWallet.value.data.data.balance || 0);
      }
      if (resProfile.status === 'fulfilled' && resProfile.value.data?.data) {
        setProfileName(resProfile.value.data.data.full_name || 'Pengguna');
      }
      if (resRep.status === 'fulfilled' && resRep.value.data?.data) {
        setReputationScore(resRep.value.data.data.reputation_score || 100);
      }
      if (resDetail.status === 'fulfilled' && resDetail.value.data?.data) {
        setCircleDetail(resDetail.value.data.data);
      }

      if (resMembers.status === 'fulfilled') {
        const rawRes = resMembers.value.data;
        const memberList = Array.isArray(rawRes?.data?.items)
          ? rawRes.data.items
          : Array.isArray(rawRes?.data)
          ? rawRes.data
          : Array.isArray(rawRes)
          ? rawRes
          : [];

        setMembers(
          memberList.map((m: any, idx: number) => ({
            id: m.user_id || m.circle_membership_id || idx,
            fullName: m.full_name || m.name || 'Member',
            role: m.membership_role || 'MEMBER',
            status: (m.membership_status || 'active').toLowerCase(),
            email: m.email || '',
          }))
        );
      }
    } catch (err) {
      console.warn('Gagal memuat data dashboard:', err);
    } finally {
      setApiLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendData();
  }, [circleId]);

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSPSB = circleDetail?.track_type === 'SPSB';
  const inviteCode = circleDetail?.invite_code || 'ARK-8891X';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="shrink-0 bg-white border-b px-6 py-3.5 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-black text-[#0A2578]">Halo, {profileName}!</h1>
          <p className="text-[11px] text-slate-400 font-semibold">
            Active Circle: <span className="text-[#0A2578] font-bold">{circleDetail?.circle_name || 'Arisan'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* TAMPILAN KODE UNDANGAN */}
          <button
            onClick={() => copyInviteCode(inviteCode)}
            className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all"
            title="Klik untuk salin Kode Undangan"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#0A2578]" />
            <span className="text-xs font-mono font-bold text-[#0A2578]">{inviteCode}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {isSPSB ? (
            <button
              onClick={() => onNavigate?.('spsb_auction')}
              className="text-xs bg-[#F84A4D] hover:bg-[#e03a3d] text-white px-3.5 py-2 font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Gavel className="w-3.5 h-3.5" /> Room Lelang SPSB
            </button>
          ) : (
            <button
              onClick={() => onNavigate?.('spin_wheel')}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Disc className="w-3.5 h-3.5" /> Roda Pengocokan
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-[#0A2578] text-white rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] text-white/60 font-bold uppercase">Saldo Dompet Real-Time</p>
            <p className="text-2xl font-bold font-mono mt-2">
              {apiLoading ? 'Loading...' : `Rp ${walletBalance.toLocaleString('id-ID')}`}
            </p>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Skor Reputasi Saya</p>
            <p className="text-2xl font-bold text-[#0A2578] mt-2 font-mono">{reputationScore}/100</p>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Anggota Circle Aktif</p>
            <p className="text-2xl font-bold text-[#0A2578] mt-2 font-mono">{members.length} Orang</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-[#0A2578] text-sm mb-4">Daftar Anggota Circle Real-Time</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b font-bold text-slate-400">
                  <th className="p-3">Nama Lengkap</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="p-3 font-bold text-slate-800">{m.fullName}</td>
                    <td className="p-3 text-slate-500 font-mono">{m.email || '—'}</td>
                    <td className="p-3 font-semibold text-[#0A2578]">{m.role}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        AKTIF
                      </span>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && !apiLoading && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400">
                      Belum ada anggota terdaftar di Circle ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}