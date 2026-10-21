import React, { useState, useEffect } from 'react';
import {
  Shield,
  LayoutDashboard,
  Table2,
  Disc,
  HandCoins,
  FileCheck2,
  LogOut,
  Gavel,
  PlusCircle,
  KeyRound,
  LogOut as LeaveIcon,
  Sparkles,
  Users,
  ArrowRight,
  UserCheck
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import AuctionRoom from './pages/AuctionRoom';
import Crowdfunding from './pages/Crowdfunding';
import AuditTrail from './pages/AuditTrail';
import SpinWheel from './components/SpinWheel';
import PaymentMatrix from './components/PaymentMatrix';
import LoginModal from './components/LoginModal';
import CreateCircleModal from './components/CreateCircleModal';
import JoinCircleModal from './components/JoinCircleModal';

import { userWalletService } from './services/userWalletService';
import { circleService } from './services/circleService';

export default function App() {
  const [screen, setScreen] = useState<string>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [circles, setCircles] = useState<any[]>([]);
  const [activeCircle, setActiveCircle] = useState<any>(null);
  const [activeCycleId, setActiveCycleId] = useState<string>('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isCreateCircleOpen, setIsCreateCircleOpen] = useState<boolean>(false);
  const [isJoinCircleOpen, setIsJoinCircleOpen] = useState<boolean>(false);

  const initAppData = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setIsAuthenticated(true);

      const [resProfile, resCircles] = await Promise.allSettled([
        userWalletService.getProfile(),
        circleService.getUserCircles(),
      ]);

      if (resProfile.status === 'fulfilled' && resProfile.value.data?.data) {
        setUserProfile(resProfile.value.data.data);
      }

      if (resCircles.status === 'fulfilled') {
        const raw = resCircles.value.data;
        const list = Array.isArray(raw?.data?.items)
          ? raw.data.items
          : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw)
          ? raw
          : [];

        setCircles(list);
        if (list.length > 0) {
          setActiveCircle(list[0]);
        } else {
          setActiveCircle(null);
        }
      }
    } catch (err) {
      console.error('Gagal memuat data dari backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAppData();
  }, []);

  // Sync Cycle ID murni dari Database PostgreSQL
  useEffect(() => {
    const fetchRealCycleFromDB = async () => {
      if (!activeCircle) return;
      
      const realCircleId = activeCircle.circle_id || activeCircle.id;
      
      if (activeCircle.current_cycle_id) {
        setActiveCycleId(activeCircle.current_cycle_id);
        return;
      }

      try {
        const res = await circleService.getCircleCycles(realCircleId);
        const cycleList = res?.data?.data || res?.data || [];
        
        if (Array.isArray(cycleList) && cycleList.length > 0) {
          const latestCycle = cycleList[cycleList.length - 1];
          setActiveCycleId(latestCycle.cycle_id || latestCycle.id);
        } else {
          // Jika belum ada siklus di DB, buat Siklus 1 secara otomatis di PostgreSQL
          const createRes = await circleService.createCycle(realCircleId, {
            cycle_number: 1,
            due_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
          
          const newCycleId = createRes?.data?.data?.cycle_id || createRes?.data?.cycle_id;
          if (newCycleId) {
            setActiveCycleId(newCycleId);
          } else {
            // Fallback ke ID circle jika endpoint mengembalikan circle-level ID
            setActiveCycleId(realCircleId);
          }
        }
      } catch (err) {
        console.error("Gagal mengambil/membuat siklus riil dari DB:", err);
        // Fallback langsung menggunakan ID circle agar URL endpoint lelang tetap terpanggil
        setActiveCycleId(realCircleId);
      }
    };

    fetchRealCycleFromDB();
  }, [activeCircle]);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setUserProfile(null);
    setCircles([]);
    setActiveCircle(null);
    setActiveCycleId('');
  };

  const handleLeaveCircle = async () => {
    if (!activeCircle) return;
    const confirmLeave = window.confirm(`Apakah Anda yakin ingin keluar dari circle "${activeCircle.circle_name}"?`);
    if (!confirmLeave) return;

    try {
      await circleService.leaveCircle(activeCircle.circle_id || activeCircle.id);
      await initAppData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal keluar dari Circle.');
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#0A2578] flex flex-col items-center justify-center text-white font-bold text-sm gap-3">
        <Sparkles className="w-8 h-8 animate-spin text-[#5A83DB]" />
        <span>Memuat ArisanKita Platform...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full min-h-screen bg-[#0A2578] flex flex-col justify-between p-6 sm:p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#5A83DB]/20 rounded-full blur-3xl -z-0 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#F84A4D]/10 rounded-full blur-3xl -z-0 pointer-events-none" />

        <header className="flex items-center justify-between w-full max-w-6xl mx-auto z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <Shield className="w-6 h-6 text-[#5A83DB]" />
            </div>
            <span className="font-black text-xl tracking-tight">ArisanKita</span>
          </div>
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2"
          >
            <UserCheck className="w-4 h-4 text-emerald-400" /> Masuk Akun
          </button>
        </header>

        <main className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6 my-auto z-10 py-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/15 text-xs font-semibold text-emerald-300 backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-emerald-400" /> Platform Arisan Digital Terverifikasi
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            Transparansi Arisan Kelompok Tanpa Keraguan.
          </h1>
          <p className="text-base sm:text-lg text-white/75 leading-relaxed max-w-2xl">
            Sistem pengocokan otomatis dengan dukungan <span className="text-amber-300 font-bold">Lelang Suku Bunga SPSB</span> dan <span className="text-emerald-300 font-bold">Roda Pengocokan Acak</span> yang dicatat transparan di database.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mt-4">
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="w-full sm:w-auto px-8 py-4 bg-[#F84A4D] hover:bg-[#e03a3d] text-white font-bold rounded-2xl text-sm transition-all shadow-xl hover:shadow-red-500/30 flex items-center justify-center gap-2"
            >
              Mulai Sekarang <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </main>

        <footer className="text-center text-xs text-white/40 z-10">
          &copy; {new Date().getFullYear()} ArisanKita Platform. Hak Cipta Dilindungi.
        </footer>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onSuccess={() => {
            setIsLoginModalOpen(false);
            initAppData();
          }}
        />
      </div>
    );
  }

  if (circles.length === 0) {
    return (
      <div className="w-full min-h-screen bg-[#FFF6ED] flex flex-col">
        <header className="bg-[#0A2578] text-white px-8 py-4 flex items-center justify-between border-b border-white/10 shadow-md">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#5A83DB]" />
            <span className="font-black text-base tracking-tight">ArisanKita</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-white/80 hidden sm:inline">
              {userProfile?.email || userProfile?.full_name}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-xs font-bold border border-red-500/30 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto my-auto">
          <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/80 shadow-2xl flex flex-col items-center gap-6 w-full">
            <div className="w-16 h-16 bg-[#0A2578]/10 rounded-2xl flex items-center justify-center text-[#0A2578] font-bold">
              <Users className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-[#0A2578]">
                Selamat Datang, {userProfile?.full_name || 'Pengguna'}!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                Akun Anda telah terverifikasi. Saat ini Anda belum terdaftar di kelompok Arisan manapun.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-2">
              <button
                onClick={() => setIsCreateCircleOpen(true)}
                className="p-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all shadow-lg hover:shadow-emerald-600/20 group"
              >
                <PlusCircle className="w-7 h-7 transition-transform group-hover:scale-110" />
                <span className="text-sm">Buat Circle Baru</span>
                <span className="text-[10px] font-normal text-emerald-100">Sebagai Ketua Kelompok</span>
              </button>

              <button
                onClick={() => setIsJoinCircleOpen(true)}
                className="p-5 bg-[#0A2578] hover:bg-[#0A2578]/90 text-white font-bold text-xs rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all shadow-lg hover:shadow-[#0A2578]/20 group"
              >
                <KeyRound className="w-7 h-7 transition-transform group-hover:scale-110 text-[#5A83DB]" />
                <span className="text-sm">Gabung via Kode</span>
                <span className="text-[10px] font-normal text-white/70">Gunakan Kode Undangan</span>
              </button>
            </div>
          </div>
        </main>

        <CreateCircleModal isOpen={isCreateCircleOpen} onClose={() => setIsCreateCircleOpen(false)} onSuccess={() => initAppData()} />
        <JoinCircleModal isOpen={isJoinCircleOpen} onClose={() => setIsJoinCircleOpen(false)} onSuccess={() => initAppData()} />
      </div>
    );
  }

  const rawCircleId = activeCircle?.circle_id || activeCircle?.id || '';
  const trackType = activeCircle?.track_type || activeCircle?.trackType || 'RANDOM_DRAW';

  return (
    <div className="w-full min-h-screen bg-[#FFF6ED] flex flex-col lg:flex-row font-sans">
      <aside className="w-full lg:w-[280px] bg-[#0A2578] text-white p-5 flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#5A83DB]" />
            <span className="font-black text-base">ArisanKita</span>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white/10 rounded-xl p-3 border border-white/15 flex flex-col gap-2">
          <p className="text-[10px] text-white/50 font-bold uppercase">Circle Saya</p>
          <select
            value={rawCircleId}
            onChange={(e) => {
              const found = circles.find((c) => (c.circle_id || c.id) === e.target.value);
              if (found) {
                setActiveCircle(found);
                setScreen('dashboard');
              }
            }}
            className="w-full bg-[#0A2578] text-xs font-bold text-white outline-none cursor-pointer p-2 rounded-lg border border-white/20"
          >
            {circles.map((c: any) => {
              const cId = c.circle_id || c.id;
              const cName = c.circle_name || c.name || 'Circle';
              const cTrack = c.track_type || c.trackType || 'SPSB';
              return (
                <option key={cId} value={cId} className="bg-[#0A2578] text-white">
                  {cName} ({cTrack})
                </option>
              );
            })}
          </select>

          <div className="grid grid-cols-2 gap-1.5 mt-1">
            <button
              onClick={() => setIsCreateCircleOpen(true)}
              className="py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-bold text-white flex items-center justify-center gap-1 transition-colors border border-white/10"
            >
              <PlusCircle className="w-3 h-3" /> Buat
            </button>
            <button
              onClick={() => setIsJoinCircleOpen(true)}
              className="py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-bold text-white flex items-center justify-center gap-1 transition-colors border border-white/10"
            >
              <KeyRound className="w-3 h-3" /> Gabung
            </button>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          <button
            onClick={() => setScreen('dashboard')}
            className={`p-2.5 rounded-xl text-xs font-bold text-left flex items-center gap-2.5 ${
              screen === 'dashboard' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard Overview
          </button>

          <button
            onClick={() => setScreen('payment_matrix')}
            className={`p-2.5 rounded-xl text-xs font-bold text-left flex items-center gap-2.5 ${
              screen === 'payment_matrix' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            <Table2 className="w-4 h-4" /> Matriks Pembayaran
          </button>

          {trackType === 'SPSB' ? (
            <button
              onClick={() => setScreen('spsb_auction')}
              className={`p-2.5 rounded-xl text-xs font-bold text-left flex items-center gap-2.5 ${
                screen === 'spsb_auction' ? 'bg-[#F84A4D] text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              <Gavel className="w-4 h-4 text-amber-300" /> Room Lelang SPSB
            </button>
          ) : (
            <button
              onClick={() => setScreen('spin_wheel')}
              className={`p-2.5 rounded-xl text-xs font-bold text-left flex items-center gap-2.5 ${
                screen === 'spin_wheel' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              <Disc className="w-4 h-4 text-emerald-400" /> Roda Pengocokan
            </button>
          )}

          <button
            onClick={() => setScreen('crowdfunding')}
            className={`p-2.5 rounded-xl text-xs font-bold text-left flex items-center gap-2.5 ${
              screen === 'crowdfunding' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            <HandCoins className="w-4 h-4" /> Patungan Internal
          </button>

          <button
            onClick={() => setScreen('audit_trail')}
            className={`p-2.5 rounded-xl text-xs font-bold text-left flex items-center gap-2.5 ${
              screen === 'audit_trail' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            <FileCheck2 className="w-4 h-4" /> Audit Trail SHA-256
          </button>
        </nav>

        <button
          onClick={handleLeaveCircle}
          className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <LeaveIcon className="w-3.5 h-3.5" /> Keluar dari Circle
        </button>

        <div className="bg-white/10 p-3 rounded-xl flex items-center gap-3 border border-white/10">
          <div className="w-8 h-8 rounded-full bg-[#5A83DB] text-white font-black text-xs flex items-center justify-center shrink-0">
            {userProfile?.full_name ? userProfile.full_name.charAt(0) : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{userProfile?.full_name || 'Pengguna'}</p>
            <p className="text-[10px] text-emerald-400 font-bold truncate">{userProfile?.email || 'Terverifikasi'}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        {screen === 'dashboard' && <Dashboard circleId={rawCircleId} onNavigate={(s) => setScreen(s)} />}
        {screen === 'payment_matrix' && <PaymentMatrix circleId={rawCircleId} />}
        {screen === 'spin_wheel' && <SpinWheel circleId={activeCycleId} trackType="B" />}
        {screen === 'spsb_auction' && <AuctionRoom cycleId={activeCycleId} onBack={() => setScreen('dashboard')} />}
        {screen === 'crowdfunding' && <Crowdfunding circleId={activeCycleId} />}
        {screen === 'audit_trail' && <AuditTrail circleId={activeCycleId} />}
      </main>

      <CreateCircleModal isOpen={isCreateCircleOpen} onClose={() => setIsCreateCircleOpen(false)} onSuccess={() => initAppData()} />
      <JoinCircleModal isOpen={isJoinCircleOpen} onClose={() => setIsJoinCircleOpen(false)} onSuccess={() => initAppData()} />
    </div>
  );
}