import React, { useState, useEffect, useCallback, Component, type ReactNode, type ErrorInfo } from 'react';
import {
  Shield, ShieldCheck, Zap, RefreshCw, Lock, X, Check, Scale,
  CheckCircle2, Users, Calendar, Wallet, LayoutDashboard, Table2,
  Gavel, HandCoins, FileCheck2, Disc, ChevronDown, Star, LogOut,
  Menu, Bell, CreditCard, ArrowRight, AlertCircle, ArrowLeft,
  Sparkles, Phone, AlertTriangle,
} from 'lucide-react';

import Dashboard     from './pages/Dashboard';
import AuctionRoom   from './pages/AuctionRoom';
import Crowdfunding  from './pages/Crowdfunding';
import AuditTrail    from './pages/AuditTrail';
import SpinWheel     from './components/SpinWheel';
import PaymentModal  from './components/PaymentModal';
import PaymentMatrix from './components/PaymentMatrix';

/* ══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════ */
type Screen    = 'landing' | 'dashboard' | 'spsb_auction' | 'spin_wheel' | 'crowdfunding' | 'audit_trail' | 'payment_matrix';
type TrackType = 'TRACK_A' | 'TRACK_B';

interface UserState   { isLoggedIn: boolean; role: 'LEADER' | 'MEMBER'; name: string; initials: string; reputation: number; }
interface CircleState { id: string; name: string; trackType: TrackType; }
interface Toast       { id: string; message: string; type: 'success' | 'info' | 'warning' | 'error'; }
interface PaymentCtx  { amount: number; purpose: string; }
interface NavItem     { id: string; icon: React.ReactNode; label: string; targetScreen: Screen; activeOn: Screen[]; }

/* ══════════════════════════════════════════════════════════
   ROUTING CONSTANTS
══════════════════════════════════════════════════════════ */
const HASH_TO_SCREEN: Record<string, Screen> = {
  '#/':               'landing',
  '#/dashboard':      'dashboard',
  '#/payment-matrix': 'payment_matrix',
  '#/spsb-auction':   'spsb_auction',
  '#/spin-wheel':     'spin_wheel',
  '#/crowdfunding':   'crowdfunding',
  '#/audit-trail':    'audit_trail',
};
const SCREEN_TO_HASH: Record<Screen, string> = {
  landing:        '#/',
  dashboard:      '#/dashboard',
  payment_matrix: '#/payment-matrix',
  spsb_auction:   '#/spsb-auction',
  spin_wheel:     '#/spin-wheel',
  crowdfunding:   '#/crowdfunding',
  audit_trail:    '#/audit-trail',
};

/* ══════════════════════════════════════════════════════════
   APP DATA
══════════════════════════════════════════════════════════ */
const INITIAL_CIRCLES: CircleState[] = [
  { id: 'ARK-8891', name: 'Arisan Alumni 2018',    trackType: 'TRACK_A' },
  { id: 'ARK-5024', name: 'Arisan Keluarga Besar', trackType: 'TRACK_B' },
];
const INITIAL_USER: UserState = {
  isLoggedIn: false, role: 'LEADER', name: 'Farrel Abda', initials: 'FA', reputation: 98,
};

export const DEFAULT_CIRCLE = {
  id:           'ARK-8891',
  name:         'Arisan Alumni 2018',
  trackType:    'TRACK_A' as TrackType,
  membersCount: 10,
  totalPot:     '15.000.000',
  duesAmount:   '1.000.000',
  currentCycle: 4,
  totalCycles:  15,
};
export const DEFAULT_USER = {
  name:       'Farrel Abda',
  role:       'LEADER' as const,
  reputation: 98,
  isLoggedIn: true,
};

const CATEGORIES = ['UMKM & Bisnis', 'Keluarga & Hobi', 'Komunitas / Alumni', 'Kantor'] as const;

/* ══════════════════════════════════════════════════════════
   ERROR BOUNDARY
══════════════════════════════════════════════════════════ */
interface EBProps  { children: ReactNode; fallbackLabel?: string; }
interface EBState  { hasError: boolean; message: string; }

class ErrorBoundary extends Component<EBProps, EBState> {
  constructor(props: EBProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(err: Error): EBState {
    return { hasError: true, message: err.message };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[ArisanKita Error Boundary]', err, info.componentStack);
  }
  reset = () => this.setState({ hasError: false, message: '' });
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 bg-[#FFF6ED] text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-[#9E002D]" />
          </div>
          <div>
            <p className="text-lg font-black text-[#0A2578]">{this.props.fallbackLabel ?? 'Terjadi Kesalahan'}</p>
            <p className="text-sm text-slate-500 mt-1.5 max-w-xs leading-relaxed">Layar ini mengalami error tak terduga dan diisolasi agar tidak memengaruhi bagian lain aplikasi.</p>
            {this.state.message && (
              <code className="mt-3 block text-[10px] font-mono text-slate-400 bg-slate-100 px-3 py-2 rounded-lg max-w-xs mx-auto break-all text-left">
                {this.state.message}
              </code>
            )}
          </div>
          <button
            onClick={this.reset}
            className="px-5 py-2.5 bg-[#0A2578] text-white font-bold text-sm rounded-xl hover:bg-[#0A2578]/90 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ══════════════════════════════════════════════════════════
   NAV FACTORY
══════════════════════════════════════════════════════════ */
const buildNavItems = (trackType: TrackType): NavItem[] => [
  { id: 'overview',    icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard Overview',  targetScreen: 'dashboard',      activeOn: ['dashboard'] },
  { id: 'matrix',     icon: <Table2 className="w-4 h-4" />,          label: 'Matriks Pembayaran',  targetScreen: 'payment_matrix', activeOn: ['payment_matrix'] },
  {
    id: 'auction',
    icon:         trackType === 'TRACK_A' ? <Gavel className="w-4 h-4" /> : <Disc className="w-4 h-4" />,
    label:        trackType === 'TRACK_A' ? 'Room Lelang SPSB' : 'Roda Pengocokan',
    targetScreen: trackType === 'TRACK_A' ? 'spsb_auction' : 'spin_wheel',
    activeOn:     ['spsb_auction', 'spin_wheel'],
  },
  { id: 'crowdfunding', icon: <HandCoins className="w-4 h-4" />,  label: 'Patungan Internal',   targetScreen: 'crowdfunding', activeOn: ['crowdfunding'] },
  { id: 'audit_trail',  icon: <FileCheck2 className="w-4 h-4" />, label: 'Audit Trail SHA-256', targetScreen: 'audit_trail',  activeOn: ['audit_trail'] },
];

/* ══════════════════════════════════════════════════════════
   TOAST CONTAINER
══════════════════════════════════════════════════════════ */
const TOAST_STYLE: Record<Toast['type'], { bg: string; icon: React.ReactNode }> = {
  success: { bg: 'bg-emerald-600', icon: <CheckCircle2 className="w-4 h-4" /> },
  info:    { bg: 'bg-[#5A83DB]',   icon: <Bell className="w-4 h-4" /> },
  warning: { bg: 'bg-amber-500',   icon: <AlertCircle className="w-4 h-4" /> },
  error:   { bg: 'bg-[#9E002D]',   icon: <AlertCircle className="w-4 h-4" /> },
};

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-4 z-[300] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => {
        const s = TOAST_STYLE[t.type];
        return (
          <div key={t.id} className={`${s.bg} text-white pl-3.5 pr-3 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 pointer-events-auto max-w-[320px] text-sm font-semibold animate-in slide-in-from-right-4 duration-300`}>
            <span className="shrink-0">{s.icon}</span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => onDismiss(t.id)} className="shrink-0 ml-1 opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SIDEBAR CONTENT
══════════════════════════════════════════════════════════ */
interface SidebarContentProps {
  screen:         Screen;
  user:           UserState;
  circle:         CircleState;
  circles:        CircleState[];
  onNavigate:     (s: Screen) => void;
  onCircleChange: (c: CircleState) => void;
  onLogout:       () => void;
  onOpenPayment:  () => void;
  onClose?:       () => void;
  onDemoSwitch:   (track: TrackType) => void;
}

function SidebarContent({
  screen, user, circle, circles,
  onNavigate, onCircleChange, onLogout, onOpenPayment, onClose, onDemoSwitch,
}: SidebarContentProps) {
  const [circleDropOpen, setCircleDropOpen] = useState(false);
  const navItems = buildNavItems(circle.trackType);
  const isActive = (item: NavItem) => item.activeOn.includes(screen);

  return (
    <>
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#5A83DB]" />
          <span className="font-black text-base tracking-tight">ArisanKita</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="relative shrink-0">
        <button
          onClick={() => setCircleDropOpen((v) => !v)}
          className="w-full flex items-center justify-between bg-white/10 border border-white/15 rounded-xl px-3.5 py-3 hover:bg-white/15 transition-colors"
        >
          <div className="min-w-0 text-left">
            <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wider mb-0.5">Circle Aktif</p>
            <p className="text-sm font-bold text-white truncate">{circle.name}</p>
            <p className={`text-[10px] font-semibold mt-0.5 ${circle.trackType === 'TRACK_A' ? 'text-[#5A83DB]' : 'text-emerald-400'}`}>
              {circle.trackType === 'TRACK_A' ? 'Track A · SPSB' : 'Track B · Sosial'}
            </p>
          </div>
          <ChevronDown className={`w-4 h-4 text-white/40 shrink-0 ml-2 transition-transform duration-200 ${circleDropOpen ? 'rotate-180' : ''}`} />
        </button>
        {circleDropOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0d2d8a] border border-white/15 rounded-xl overflow-hidden shadow-2xl z-20">
            {circles.map((c) => (
              <button
                key={c.id}
                onClick={() => { onCircleChange(c); setCircleDropOpen(false); onClose?.(); }}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/10 transition-colors ${c.id === circle.id ? 'bg-white/10' : ''}`}
              >
                <div>
                  <p className="text-sm font-bold text-white leading-none">{c.name}</p>
                  <p className={`text-[10px] font-semibold mt-1 ${c.trackType === 'TRACK_A' ? 'text-[#5A83DB]' : 'text-emerald-400'}`}>
                    {c.id} · {c.trackType === 'TRACK_A' ? 'Track A' : 'Track B'}
                  </p>
                </div>
                {c.id === circle.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 bg-white/5 border border-white/10 rounded-xl px-3.5 py-3">
        <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-2">Demo Mode</p>
        <div className="flex gap-1.5">
          <button
            onClick={() => { onDemoSwitch('TRACK_A'); onClose?.(); }}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-black rounded-lg transition-all ${
              circle.trackType === 'TRACK_A'
                ? 'bg-[#5A83DB] text-white shadow-md'
                : 'bg-white/10 text-white/50 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Gavel className="w-3.5 h-3.5" />
            Track A
          </button>
          <button
            onClick={() => { onDemoSwitch('TRACK_B'); onClose?.(); }}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-black rounded-lg transition-all ${
              circle.trackType === 'TRACK_B'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-white/10 text-white/50 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            Track B
          </button>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.targetScreen); onClose?.(); }}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all text-left w-full ${
                active ? 'bg-white/15 text-white ring-1 ring-white/20' : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className={active ? 'text-[#5A83DB]' : ''}>{item.icon}</span>
              {item.label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#5A83DB]" />}
            </button>
          );
        })}
      </nav>

      <button
        onClick={() => { onOpenPayment(); onClose?.(); }}
        className="shrink-0 flex items-center gap-2.5 bg-[#F84A4D]/15 border border-[#F84A4D]/30 hover:bg-[#F84A4D]/25 text-white px-3.5 py-3 rounded-xl transition-all text-sm font-bold"
      >
        <CreditCard className="w-4 h-4 text-[#F84A4D] shrink-0" />
        Bayar Iuran Siklus 4
        <span className="ml-auto text-[9px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">PENDING</span>
      </button>

      <div className="shrink-0 bg-white/10 border border-white/15 rounded-xl p-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5A83DB] to-[#0A2578] ring-2 ring-white/20 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {user.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{user.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[9px] font-black text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded uppercase tracking-wide">{user.role}</span>
            <Star className="w-3 h-3 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">{user.reputation}/100</span>
          </div>
        </div>
        <button onClick={onLogout} className="text-white/40 hover:text-white transition-colors shrink-0" title="Logout">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   AUTH CARD
══════════════════════════════════════════════════════════ */
interface AuthCardProps {
  activeTab:    'invite' | 'new';
  setActiveTab: (t: 'invite' | 'new') => void;
  inviteCode:   string;
  setInviteCode:(v: string) => void;
  phone:        string;
  setPhone:     (v: string) => void;
  loginLoading: boolean;
  onOTPRequest: (e: React.FormEvent) => void;
  onOpenWizard: () => void;
}

function AuthCard({
  activeTab, setActiveTab, inviteCode, setInviteCode,
  phone, setPhone, loginLoading, onOTPRequest, onOpenWizard,
}: AuthCardProps) {
  return (
    <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
      <div className="flex bg-slate-100 p-1 rounded-xl">
        {(['invite', 'new'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 px-3 text-sm font-semibold rounded-lg transition-all ${
              activeTab === tab ? 'bg-white text-[#0A2578] shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'invite' ? 'Punya Kode Invitation' : 'Buat Circle Baru'}
          </button>
        ))}
      </div>

      {activeTab === 'invite' ? (
        <form onSubmit={onOTPRequest} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-[#0A2578]">Kode Undangan Circle</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Contoh: ARK-8891"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base font-bold uppercase tracking-widest font-mono placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/40 focus:border-[#5A83DB] transition-all bg-slate-50"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-[#0A2578]">Nomor WhatsApp</label>
            <div className="flex border border-slate-200 rounded-xl bg-slate-50 focus-within:ring-2 focus-within:ring-[#5A83DB]/40 focus-within:border-[#5A83DB] transition-all overflow-hidden shadow-sm">
              <div className="bg-slate-100 px-4 border-r border-slate-200 text-sm font-bold text-slate-600 flex items-center select-none shrink-0">+62</div>
              <input
                type="tel" inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="8123456789"
                className="w-full px-4 py-3 text-sm font-medium focus:outline-none bg-transparent placeholder:text-slate-400"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full mt-1 bg-[#F84A4D] hover:bg-[#e03a3d] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-[#F84A4D]/30 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2 text-base"
          >
            {loginLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Lanjutkan via WhatsApp OTP'}
          </button>
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Sesuai KBLI 63122 SaaS. Platform Non-Custodial.</span>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-500 leading-relaxed">Pilih jenis komunitas dan sistem track yang sesuai kebutuhan Anda.</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { emoji: '🏪', label: 'UMKM & Bisnis',     sub: 'Track A Lelang', cls: 'bg-blue-50 border-blue-100' },
              { emoji: '🏠', label: 'Keluarga & Hobi',    sub: 'Track B Sosial', cls: 'bg-emerald-50 border-emerald-100' },
              { emoji: '🎓', label: 'Komunitas / Alumni', sub: 'Track A atau B', cls: 'bg-purple-50 border-purple-100' },
              { emoji: '💼', label: 'Kantor',             sub: 'Track A atau B', cls: 'bg-amber-50 border-amber-100' },
            ].map((c) => (
              <div key={c.label} className={`p-3 rounded-xl border ${c.cls} flex flex-col gap-0.5`}>
                <span className="text-lg">{c.emoji}</span>
                <p className="text-xs font-bold text-slate-700 leading-tight">{c.label}</p>
                <p className="text-[10px] text-slate-400">{c.sub}</p>
              </div>
            ))}
          </div>
          <button
            onClick={onOpenWizard}
            className="w-full py-3.5 bg-[#0A2578] text-white font-bold rounded-xl hover:bg-[#0A2578]/90 transition-all shadow-md flex items-center justify-center gap-2 text-sm"
          >
            <Users className="w-4 h-4 shrink-0" />
            Mulai Bikin Circle
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
          <p className="text-center text-xs text-slate-400">Gratis selamanya untuk komunitas arisan</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   CIRCLE CREATION WIZARD MODAL
══════════════════════════════════════════════════════════ */
interface WizardProps {
  isOpen:     boolean;
  onClose:    () => void;
  onComplete: (name: string, track: TrackType) => void;
}

function CircleWizardModal({ isOpen, onClose, onComplete }: WizardProps) {
  const [step,      setStep]      = useState(1);
  const [wName,     setWName]     = useState('');
  const [wCategory, setWCategory] = useState<string>(CATEGORIES[0]);
  const [wTrack,    setWTrack]    = useState<TrackType>('TRACK_A');
  const [wDues,     setWDues]     = useState('');
  const [wMembers,  setWMembers]  = useState('');
  const [wPhone,    setWPhone]    = useState('');
  const [wOtp,      setWOtp]      = useState(['', '', '', '']);
  const [wLoading,  setWLoading]  = useState(false);
  const [wComplete, setWComplete] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setStep(1); setWName(''); setWCategory(CATEGORIES[0]);
        setWTrack('TRACK_A'); setWDues(''); setWMembers('');
        setWPhone(''); setWOtp(['', '', '', '']);
        setWLoading(false); setWComplete(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleWOtpInput = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    setWOtp((prev) => { const n = [...prev]; n[i] = v.slice(-1); return n; });
    if (v && i < 3) document.getElementById(`wotp-${i + 1}`)?.focus();
  };

  const handleWOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !wOtp[i] && i > 0) document.getElementById(`wotp-${i - 1}`)?.focus();
  };

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setWLoading(true);
    setTimeout(() => { setWLoading(false); setStep(4); }, 1200);
  };

  const handleVerify = () => {
    if (wOtp.join('').length < 4) return;
    setWLoading(true);
    setTimeout(() => {
      setWLoading(false);
      setWComplete(true);
      setTimeout(() => onComplete(wName.trim() || 'Circle Baru', wTrack), 1600);
    }, 1200);
  };

  const STEP_LABELS = ['Identitas', 'Sistem Track', 'Parameter', 'Verifikasi'];
  const potTotal = wDues && wMembers ? (parseInt(wDues) || 0) * (parseInt(wMembers) || 0) : 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end lg:items-center justify-center bg-slate-900/60 backdrop-blur-sm lg:p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !wLoading) onClose(); }}
    >
      <div className="bg-white w-full lg:max-w-lg rounded-t-[28px] lg:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="w-full flex justify-center pt-3 lg:hidden shrink-0">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        <div className="bg-[#0A2578] px-6 pt-4 pb-5 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#5A83DB]" />
              <span className="font-black text-base text-white tracking-tight">Buat Circle Baru</span>
            </div>
            <button
              onClick={onClose}
              disabled={wLoading}
              className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors disabled:opacity-30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex-1 flex flex-col gap-1">
                <div className={`h-1 rounded-full transition-all duration-500 ${i + 1 <= step ? 'bg-[#5A83DB]' : 'bg-white/20'}`} />
                <span className={`text-[9px] font-bold text-center transition-colors ${
                  i + 1 === step ? 'text-white' : i + 1 < step ? 'text-[#5A83DB]' : 'text-white/30'
                }`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 flex flex-col gap-5">
            {step === 1 && (
              <>
                <div>
                  <h3 className="text-lg font-black text-[#0A2578]">Identitas Komunitas</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Isi detail dasar komunitas Anda.</p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#0A2578]">Nama Circle / Komunitas</label>
                    <input
                      type="text"
                      value={wName}
                      onChange={(e) => setWName(e.target.value)}
                      placeholder="misal: Arisan Alumni 2018"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/40 focus:border-[#5A83DB] transition-all bg-slate-50 placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#0A2578]">Kategori Bidang</label>
                    <div className="relative">
                      <select
                        value={wCategory}
                        onChange={(e) => setWCategory(e.target.value)}
                        className="w-full px-4 py-3 pr-10 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/40 focus:border-[#5A83DB] transition-all bg-slate-50 appearance-none cursor-pointer"
                      >
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <h3 className="text-lg font-black text-[#0A2578]">Pilih Sistem Track</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Pilih model arisan yang sesuai kebutuhan komunitas Anda.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setWTrack('TRACK_A')}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                      wTrack === 'TRACK_A' ? 'border-[#5A83DB] bg-[#5A83DB]/5' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${wTrack === 'TRACK_A' ? 'bg-[#5A83DB]' : 'bg-slate-200'}`}>
                        <Gavel className={`w-5 h-5 ${wTrack === 'TRACK_A' ? 'text-white' : 'text-slate-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-sm font-black ${wTrack === 'TRACK_A' ? 'text-[#0A2578]' : 'text-slate-700'}`}>Track A — Lelang SPSB</span>
                          <span className="text-[9px] font-black text-[#5A83DB] bg-[#5A83DB]/10 px-2 py-0.5 rounded-full border border-[#5A83DB]/20 uppercase tracking-wider">Komersial</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">Sistem lelang bunga rahasia. Cocok untuk tambahan modal usaha UMKM & bisnis.</p>
                      </div>
                      {wTrack === 'TRACK_A' && <Check className="w-5 h-5 text-[#5A83DB] shrink-0 mt-0.5" />}
                    </div>
                  </button>
                  <button
                    onClick={() => setWTrack('TRACK_B')}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                      wTrack === 'TRACK_B' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${wTrack === 'TRACK_B' ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                        <Disc className={`w-5 h-5 ${wTrack === 'TRACK_B' ? 'text-white' : 'text-slate-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-sm font-black ${wTrack === 'TRACK_B' ? 'text-emerald-800' : 'text-slate-700'}`}>Track B — Roda Pengocokan</span>
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">Sosial</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">Sistem pengocokan acak transparan tanpa bunga. Cocok untuk arisan keluarga & hobi.</p>
                      </div>
                      {wTrack === 'TRACK_B' && <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
                    </div>
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <h3 className="text-lg font-black text-[#0A2578]">Parameter Finansial</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Atur nominal dan data admin Circle Anda.</p>
                </div>
                <form id="step3-form" onSubmit={handleStep3Submit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#0A2578]">Nominal Iuran Per Anggota (Rp)</label>
                    <input
                      type="text" inputMode="numeric"
                      value={wDues}
                      onChange={(e) => setWDues(e.target.value.replace(/\D/g, ''))}
                      placeholder="1000000"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/40 focus:border-[#5A83DB] transition-all bg-slate-50 placeholder:font-normal placeholder:text-slate-400"
                      required
                    />
                    {wDues && (
                      <p className="text-xs text-[#5A83DB] font-semibold pl-1">= Rp {parseInt(wDues).toLocaleString('id-ID')}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#0A2578]">Target Jumlah Anggota</label>
                    <input
                      type="text" inputMode="numeric"
                      value={wMembers}
                      onChange={(e) => setWMembers(e.target.value.replace(/\D/g, ''))}
                      placeholder="10"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#5A83DB]/40 focus:border-[#5A83DB] transition-all bg-slate-50 placeholder:font-normal placeholder:text-slate-400"
                      required
                    />
                    {potTotal > 0 && (
                      <p className="text-xs text-slate-500 pl-1">Total Pot = <span className="font-black text-[#0A2578]">Rp {potTotal.toLocaleString('id-ID')}</span></p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-[#0A2578]">Nomor WhatsApp Ketua Circle</label>
                    <div className="flex border border-slate-200 rounded-xl bg-slate-50 focus-within:ring-2 focus-within:ring-[#5A83DB]/40 focus-within:border-[#5A83DB] transition-all overflow-hidden">
                      <div className="bg-slate-100 px-4 border-r border-slate-200 text-sm font-bold text-slate-600 flex items-center select-none shrink-0">+62</div>
                      <input
                        type="tel" inputMode="tel"
                        value={wPhone}
                        onChange={(e) => setWPhone(e.target.value)}
                        placeholder="8123456789"
                        className="w-full px-4 py-3 text-sm font-medium focus:outline-none bg-transparent placeholder:text-slate-400"
                        required
                      />
                    </div>
                  </div>
                </form>
              </>
            )}

            {step === 4 && (
              wComplete ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-5">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#0A2578]">Circle Berhasil Dibuat!</h3>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-xs mx-auto">
                      <span className="font-bold text-[#0A2578]">{wName.trim() || 'Circle Baru'}</span>{' '}dengan{' '}
                      <span className={`font-bold ${wTrack === 'TRACK_A' ? 'text-[#5A83DB]' : 'text-emerald-600'}`}>
                        {wTrack === 'TRACK_A' ? 'Track A · SPSB' : 'Track B · Roda Pengocokan'}
                      </span>{' '}siap digunakan.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mengalihkan ke {wTrack === 'TRACK_A' ? 'Dashboard' : 'Roda Pengocokan'}…</span>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-black text-[#0A2578]">Verifikasi WhatsApp OTP</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Kode 4-digit dikirim ke{' '}
                      <span className="font-bold text-[#0A2578]">+62 {wPhone.slice(0, 3)}****{wPhone.slice(-2) || '89'}</span>
                    </p>
                  </div>
                  <div className="flex justify-center gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <input
                        key={i} id={`wotp-${i}`}
                        type="text" inputMode="numeric" maxLength={1}
                        value={wOtp[i]}
                        onChange={(e) => handleWOtpInput(i, e.target.value)}
                        onKeyDown={(e) => handleWOtpKeyDown(i, e)}
                        className="w-14 h-16 text-center text-2xl font-black text-[#0A2578] border-2 border-slate-200 bg-slate-50 rounded-2xl focus:border-[#5A83DB] focus:ring-2 focus:ring-[#5A83DB]/25 focus:bg-white outline-none transition-all shadow-sm"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                  <div className="text-center text-sm text-slate-400 flex items-center justify-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Kirim ulang dalam <span className="font-bold text-[#0A2578]">00:45</span></span>
                  </div>
                </>
              )
            )}
          </div>
        </div>

        {!wComplete && (
          <div className="shrink-0 px-6 py-4 border-t border-slate-100 flex gap-3 bg-white">
            {step > 1 ? (
              <button onClick={() => setStep((s) => s - 1)} disabled={wLoading}
                className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-40">
                <ArrowLeft className="w-4 h-4" />Kembali
              </button>
            ) : (
              <button onClick={onClose}
                className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                Batal
              </button>
            )}
            {step === 1 && (
              <button onClick={() => setStep(2)} disabled={!wName.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-[#0A2578] text-white font-bold py-3 rounded-xl hover:bg-[#0A2578]/90 transition-all shadow-md disabled:opacity-40 disabled:pointer-events-none text-sm">
                Selanjutnya <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 2 && (
              <button onClick={() => setStep(3)}
                className="flex-1 flex items-center justify-center gap-2 bg-[#0A2578] text-white font-bold py-3 rounded-xl hover:bg-[#0A2578]/90 transition-all shadow-md text-sm">
                Selanjutnya <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && (
              <button form="step3-form" type="submit" disabled={wLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-[#F84A4D] text-white font-bold py-3 rounded-xl hover:bg-[#e03a3d] transition-all shadow-md disabled:opacity-70 text-sm">
                {wLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Phone className="w-4 h-4" />Lanjutkan via WhatsApp OTP</>}
              </button>
            )}
            {step === 4 && (
              <button onClick={handleVerify} disabled={wOtp.join('').length < 4 || wLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-[#F84A4D] text-white font-bold py-3 rounded-xl hover:bg-[#e03a3d] transition-all shadow-md disabled:opacity-50 disabled:pointer-events-none text-sm">
                {wLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Verifikasi & Buat Circle</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   APP COMPONENT
══════════════════════════════════════════════════════════ */
export default function App() {
  /* ── Core state ── */
  const [screen,  setScreenState] = useState<Screen>(() => {
    const s = HASH_TO_SCREEN[window.location.hash];
    return s ?? 'landing';
  });
  const [user,        setUser]      = useState<UserState>(INITIAL_USER);
  const [circles,     setCircles]   = useState<CircleState[]>(INITIAL_CIRCLES);
  const [circle,      setCircle]    = useState<CircleState>(INITIAL_CIRCLES[0]);
  const [sidebarOpen, setSidebar]   = useState(false);
  const [payCtx,      setPayCtx]    = useState<PaymentCtx>({ amount: 1_000_000, purpose: 'Iuran Bulanan Siklus 4' });
  const [payOpen,     setPayOpen]   = useState(false);
  const [toasts,      setToasts]    = useState<Toast[]>([]);

  /* Landing form */
  const [activeTab,    setActiveTab]  = useState<'invite' | 'new'>('invite');
  const [phone,        setPhone]      = useState('');
  const [inviteCode,   setInviteCode] = useState('');
  const [otpValues,    setOtpValues]  = useState(['', '', '', '']);
  const [otpOpen,      setOtpOpen]    = useState(false);
  const [loginLoading, setLoading]    = useState(false);
  const [wizardOpen,   setWizardOpen] = useState(false);

  /* ── Toast Methods ── */
  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((p) => [...p, { id, message, type }]);

    const timer = setTimeout(() => {
      setToasts((p) => p.filter((t) => t.id !== id));
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((p) => p.filter((t) => t.id !== id));
  }, []);

  /* ── FSM Navigate ── */
  const navigate = useCallback((target: Screen, currentCircle?: CircleState) => {
    const activeCircle = currentCircle ?? circle;

    if (target === 'spsb_auction' && activeCircle.trackType === 'TRACK_B') {
      setScreenState('spin_wheel');
      window.location.hash = SCREEN_TO_HASH['spin_wheel'];
      setSidebar(false);
      setTimeout(() => addToast('Circle Track B hanya menggunakan Roda Pengocokan.', 'warning'), 0);
      return;
    }

    if (target === 'spin_wheel' && activeCircle.trackType === 'TRACK_A') {
      setScreenState('spsb_auction');
      window.location.hash = SCREEN_TO_HASH['spsb_auction'];
      setSidebar(false);
      setTimeout(() => addToast('Circle Track A menggunakan Room Lelang SPSB.', 'info'), 0);
      return;
    }

    setScreenState(target);
    window.location.hash = SCREEN_TO_HASH[target];
    setSidebar(false);
  }, [circle, addToast]);

  /* Sync hash → screen */
  useEffect(() => {
    const handler = () => {
      const s = HASH_TO_SCREEN[window.location.hash];
      if (!s || s === 'landing') return;
      if (!user.isLoggedIn) {
        window.location.hash = '#/';
        return;
      }
      if (s === 'spsb_auction' && circle.trackType === 'TRACK_B') {
        window.location.hash = SCREEN_TO_HASH['spin_wheel'];
        setScreenState('spin_wheel');
        setTimeout(() => addToast('Circle Track B hanya menggunakan Roda Pengocokan.', 'warning'), 0);
        return;
      }
      if (s === 'spin_wheel' && circle.trackType === 'TRACK_A') {
        window.location.hash = SCREEN_TO_HASH['spsb_auction'];
        setScreenState('spsb_auction');
        setTimeout(() => addToast('Circle Track A menggunakan Room Lelang SPSB.', 'info'), 0);
        return;
      }
      setScreenState(s);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, [user.isLoggedIn, circle.trackType, addToast]);

  /* ── Payment ── */
  const openPayment = useCallback((amount: number, purpose: string) => {
    setPayCtx({ amount, purpose });
    setPayOpen(true);
  }, []);

  /* ── Auth ── */
  const handleLogin = useCallback(() => {
    setUser((u) => ({ ...u, isLoggedIn: true }));
    setOtpOpen(false);
    setScreenState('dashboard');
    window.location.hash = SCREEN_TO_HASH['dashboard'];
    setTimeout(() => addToast('Selamat datang, Farrel Abda!', 'success'), 300);
  }, [addToast]);

  const handleLogout = useCallback(() => {
    setUser((u) => ({ ...u, isLoggedIn: false }));
    setScreenState('landing');
    window.location.hash = '#/';
  }, []);

  const handleQuickLogin = useCallback(() => {
    setPhone('8123456789');
    setInviteCode('ARK-8891');
    setLoading(true);
    setTimeout(() => { setLoading(false); setOtpOpen(true); }, 900);
  }, []);

  /* ── Circle change ── */
  const handleCircleChange = useCallback((c: CircleState) => {
    setCircle(c);
    if (c.trackType === 'TRACK_B' && screen === 'spsb_auction') navigate('spin_wheel', c);
    else if (c.trackType === 'TRACK_A' && screen === 'spin_wheel') navigate('spsb_auction', c);
    addToast(`Circle "${c.name}" aktif.`, 'info');
  }, [screen, navigate, addToast]);

  /* ── Demo Track Switcher ── */
  const handleDemoSwitch = useCallback((track: TrackType) => {
    const target = circles.find((c) => c.trackType === track) ?? circles[0];
    setCircle(target);
    const dest: Screen = track === 'TRACK_A' ? 'spsb_auction' : 'spin_wheel';
    setScreenState(dest);
    window.location.hash = SCREEN_TO_HASH[dest];
    setSidebar(false);
    addToast(`Demo: ${track === 'TRACK_A' ? 'Track A · Room Lelang SPSB' : 'Track B · Roda Pengocokan'}`, 'info');
  }, [circles, addToast]);

  /* ── OTP handlers ── */
  const handleOTPRequest = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setOtpOpen(true); }, 1200);
  }, []);

  const handleOtpInput = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setOtpValues((p) => { const n = [...p]; n[index] = value.slice(-1); return n; });
    if (value && index < 3) document.getElementById(`otp-${index + 1}`)?.focus();
  }, []);

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) document.getElementById(`otp-${index - 1}`)?.focus();
  }, [otpValues]);

  /* ── Wizard complete ── */
  const handleWizardComplete = useCallback((name: string, track: TrackType) => {
    const newCircle: CircleState = {
      id: 'ARK-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      name,
      trackType: track,
    };
    setCircles((p) => [...p, newCircle]);
    setCircle(newCircle);
    setUser((u) => ({ ...u, isLoggedIn: true }));
    setWizardOpen(false);
    const dest: Screen = track === 'TRACK_A' ? 'dashboard' : 'spin_wheel';
    setScreenState(dest);
    window.location.hash = SCREEN_TO_HASH[dest];
    setTimeout(() => addToast(`Circle "${name}" berhasil dibuat! Selamat datang, Admin.`, 'success'), 400);
  }, [addToast]);

  /* ── Dashboard nav adapter ── */
  const handleDashboardNav = useCallback((s: string) => {
    if      (s === 'auction')   navigate(circle.trackType === 'TRACK_A' ? 'spsb_auction' : 'spin_wheel');
    else if (s === 'spin')      navigate('spin_wheel');
    else if (s === 'matrix')    navigate('payment_matrix');
    else if (s === 'crowdfund') navigate('crowdfunding');
    else if (s === 'audit')     navigate('audit_trail');
    else navigate('dashboard');
  }, [circle.trackType, navigate]);

  /* ── Screen renderer ── */
  const renderScreen = (): React.ReactNode => {
    if (!user.isLoggedIn) return null;

    const toDash = () => navigate('dashboard');

    switch (screen) {
      case 'dashboard':
        return (
          <ErrorBoundary fallbackLabel="Dashboard Error">
            <Dashboard
              embedded
              onBack={handleLogout}
              onNavigate={handleDashboardNav}
              onOpenPayment={() => openPayment(1_000_000, 'Iuran Bulanan Siklus 4')}
            />
          </ErrorBoundary>
        );
      case 'spsb_auction':
        return (
          <ErrorBoundary fallbackLabel="Room Lelang Error">
            <AuctionRoom embedded onBack={toDash} trackType="A" />
          </ErrorBoundary>
        );
      case 'spin_wheel':
        return (
          <ErrorBoundary fallbackLabel="Roda Pengocokan Error">
            <SpinWheel
              embedded onBack={toDash}
              trackType={circle.trackType === 'TRACK_B' ? 'B' : 'A'}
              userRole={user.role === 'LEADER' ? 'leader' : 'member'}
              duesPct={100}
              onNavigateToAuction={() => navigate('spsb_auction')}
            />
          </ErrorBoundary>
        );
      case 'crowdfunding':
        return (
          <ErrorBoundary fallbackLabel="Patungan Internal Error">
            <Crowdfunding
              embedded onBack={toDash}
              onNavigateToAuction={() => navigate('spsb_auction')}
              onNavigateToSpin={() => navigate('spin_wheel')}
            />
          </ErrorBoundary>
        );
      case 'payment_matrix':
        return (
          <ErrorBoundary fallbackLabel="Matriks Pembayaran Error">
            <PaymentMatrix
              embedded onBack={toDash}
              trackType={circle.trackType}
              userRole={user.role === 'LEADER' ? 'leader' : 'member'}
              onOpenPayment={() => openPayment(1_000_000, 'Iuran Bulanan Siklus 4')}
            />
          </ErrorBoundary>
        );
      case 'audit_trail':
        return (
          <ErrorBoundary fallbackLabel="Audit Trail Error">
            <AuditTrail
              embedded onBack={toDash}
              onNavigateToAuction={() => navigate('spsb_auction')}
              onNavigateToCrowdfund={() => navigate('crowdfunding')}
            />
          </ErrorBoundary>
        );
      default:
        return (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Layar tidak ditemukan.
          </div>
        );
    }
  };

  /* ── Shared sidebar props ── */
  const sidebarProps: SidebarContentProps = {
    screen, user, circle, circles,
    onNavigate:     navigate,
    onCircleChange: handleCircleChange,
    onLogout:       handleLogout,
    onOpenPayment:  () => openPayment(1_000_000, 'Iuran Bulanan Siklus 4'),
    onDemoSwitch:   handleDemoSwitch,
  };

  /* ══════════════════════════════════════════════════════
     LANDING PAGE (unauthenticated)
  ══════════════════════════════════════════════════════ */
  if (!user.isLoggedIn) {
    const authProps: AuthCardProps = {
      activeTab, setActiveTab, inviteCode, setInviteCode,
      phone, setPhone, loginLoading,
      onOTPRequest: handleOTPRequest,
      onOpenWizard: () => setWizardOpen(true),
    };

    return (
      <div className="min-h-screen bg-[#FFF6ED] text-slate-800 antialiased font-sans selection:bg-[#5A83DB]/30">
        <header className="sticky top-0 z-50 w-full bg-[#0A2578]/90 backdrop-blur-md border-b border-white/10 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#5A83DB]" />
            <span className="text-white font-bold text-xl tracking-tight">ArisanKita</span>
          </div>
          <button
            onClick={handleQuickLogin}
            disabled={loginLoading}
            className="text-sm font-semibold px-5 py-2 text-white border border-white/20 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {loginLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            Masuk
          </button>
        </header>

        <section className="w-full bg-[#0A2578] text-white pt-8 pb-16 px-4 md:px-8 rounded-b-[40px] shadow-2xl">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#5A83DB]/20 text-[#5A83DB] text-xs font-semibold rounded-full w-fit border border-[#5A83DB]/30">
                <Shield className="w-3.5 h-3.5" />
                Pure Closed-Loop Community SaaS
              </div>
              <h1 className="text-[28px] leading-tight lg:text-[44px] font-black text-white tracking-tight">
                Tabungan & Arisan Komunitas,<br className="hidden lg:block" /> Lebih Transparan & Adil
              </h1>
              <p className="text-slate-300 text-base lg:text-lg leading-relaxed max-w-xl">
                Platform privat tanpa deposit uang untuk arisan keluarga, kantor, dan UMKM. Dikelola mandiri secara profesional.
              </p>
              <div className="lg:hidden">
                <AuthCard {...authProps} />
              </div>
              <div className="mt-2 p-5 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/15 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Circle Aktif</p>
                    <h3 className="font-bold text-white text-base">Arisan Keluarga Besar</h3>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Siklus 3/10 Active
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: <Wallet className="w-3 h-3" />,      label: 'Total Pot',    value: 'Rp 12,5 Jt' },
                    { icon: <Calendar className="w-3 h-3" />,    label: 'Jatuh Tempo',  value: '15 Okt 2026' },
                    { icon: <CheckCircle2 className="w-3 h-3" />, label: 'Status',       value: '8/10 Lunas' },
                  ].map((s) => (
                    <div key={s.label} className="bg-white/8 rounded-xl p-3 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs">{s.icon}<span>{s.label}</span></div>
                      <p className="font-black text-white text-sm leading-tight">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="hidden lg:block lg:col-span-5 lg:sticky lg:top-28">
              <AuthCard {...authProps} />
            </div>
          </div>
        </section>

        <section className="w-full bg-[#FFF6ED] py-12 px-4 md:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-[#0A2578] text-sm font-bold uppercase tracking-widest mb-2">Kenapa ArisanKita?</p>
              <h2 className="text-2xl lg:text-3xl font-black text-[#0A2578] tracking-tight">Dirancang untuk Kepercayaan Komunitas</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                { icon: <ShieldCheck className="w-6 h-6 text-[#0A2578]" />, title: '100% Non-Custodial',  desc: 'Uang mengalir langsung antar rekening anggota via Payment Gateway resmi BI. Zero endapan dana.' },
                { icon: <Scale className="w-6 h-6 text-[#0A2578]" />,       title: 'Sistem Dual-Track',   desc: 'Dukung Mode Lelang SPSB (Bisnis/Modal) & Mode Roda Pengocokan (Sosial/Hobi).' },
                { icon: <Zap className="w-6 h-6 text-[#0A2578]" />,         title: 'Registrasi Ringan',   desc: 'Cukup Nomor WhatsApp. Tanpa syarat upload KTP di awal. Siap dalam 30 detik.' },
              ].map((f) => (
                <div key={f.title} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md hover:shadow-xl transition-shadow flex flex-col gap-4 group">
                  <div className="w-12 h-12 bg-[#0A2578]/8 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0A2578] mb-1.5">{f.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 py-4 px-5 bg-white rounded-2xl border border-slate-200/60 flex items-center justify-center gap-2.5 text-sm text-slate-500 font-medium shadow-sm">
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>100% Bebas Risiko Deposit • Sesuai Legalitas KBLI 63122 SaaS</span>
            </div>
          </div>
        </section>

        <footer className="w-full py-6 text-center text-xs text-slate-400 font-medium border-t border-slate-200/60 bg-[#FFF6ED]">
          © 2026 ArisanKita. Closed-Loop Community SaaS Platform.
        </footer>

        <CircleWizardModal isOpen={wizardOpen} onClose={() => setWizardOpen(false)} onComplete={handleWizardComplete} />

        {otpOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center bg-slate-900/50 backdrop-blur-sm lg:p-4"
            onClick={(e) => e.target === e.currentTarget && setOtpOpen(false)}
          >
            <div className="bg-white w-full lg:max-w-md rounded-t-[28px] lg:rounded-3xl shadow-2xl overflow-hidden">
              <div className="w-full flex justify-center pt-3 pb-1 lg:hidden">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-6 py-4 lg:py-5 border-b border-slate-100">
                <div>
                  <h2 className="font-bold text-lg text-[#0A2578]">Verifikasi WhatsApp OTP</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Kode 4-digit dikirim ke WhatsApp Anda</p>
                </div>
                <button onClick={() => setOtpOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 flex flex-col gap-8 pb-10 lg:pb-6">
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-6">
                    Kode dikirim ke{' '}
                    <span className="font-bold text-[#0A2578] bg-[#0A2578]/5 px-2.5 py-1 rounded-lg inline-block mt-1">
                      +62 {phone.slice(0, 3)}****{phone.slice(-2) || '89'}
                    </span>
                  </p>
                  <div className="flex justify-center gap-3 lg:gap-4">
                    {[0, 1, 2, 3].map((i) => (
                      <input
                        key={i} id={`otp-${i}`}
                        type="text" inputMode="numeric" maxLength={1}
                        value={otpValues[i]}
                        onChange={(e) => handleOtpInput(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-14 h-16 lg:w-16 lg:h-[72px] text-center text-2xl font-black text-[#0A2578] border-2 border-slate-200 bg-slate-50 rounded-2xl focus:border-[#5A83DB] focus:ring-2 focus:ring-[#5A83DB]/25 focus:bg-white outline-none transition-all shadow-sm"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                  <div className="mt-5 text-sm font-medium text-slate-400">
                    Kirim ulang dalam <span className="text-[#0A2578] font-bold">00:45</span>
                  </div>
                </div>
                <button
                  onClick={handleLogin}
                  className="w-full bg-[#F84A4D] hover:bg-[#e03a3d] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-[#F84A4D]/25 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Verifikasi & Masuk
                </button>
              </div>
            </div>
          </div>
        )}

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════
     APP SHELL (authenticated)
  ══════════════════════════════════════════════════════ */
  return (
    <div className="w-full min-h-screen bg-[#FFF6ED] flex flex-col lg:flex-row font-sans antialiased selection:bg-[#F84A4D]/20">
      <aside className="hidden lg:flex w-[280px] shrink-0 bg-[#0A2578] text-white flex-col gap-4 p-5 sticky top-0 h-screen overflow-y-auto">
        <SidebarContent {...sidebarProps} />
      </aside>

      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-[190] bg-slate-900/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebar(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-[200] w-[280px] bg-[#0A2578] text-white flex flex-col gap-4 p-5 overflow-y-auto lg:hidden">
            <SidebarContent {...sidebarProps} onClose={() => setSidebar(false)} />
          </aside>
        </>
      )}

      <div className="lg:hidden fixed top-0 left-0 right-0 z-[100] bg-[#0A2578] text-white px-4 py-3 flex items-center gap-3 border-b border-white/10 shadow-lg">
        <button
          onClick={() => setSidebar(true)}
          className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Shield className="w-4 h-4 text-[#5A83DB] shrink-0" />
          <span className="font-black text-sm truncate">ArisanKita</span>
          <span className="text-white/40 mx-1 hidden sm:block">·</span>
          <span className="text-xs text-white/60 font-medium truncate hidden sm:block">{circle.name}</span>
        </div>
        <div className="flex gap-1 bg-white/10 p-0.5 rounded-lg shrink-0">
          <button
            onClick={() => handleDemoSwitch('TRACK_A')}
            className={`text-[10px] font-black px-2.5 py-1.5 rounded-md transition-all ${
              circle.trackType === 'TRACK_A' ? 'bg-[#5A83DB] text-white' : 'text-white/50 hover:text-white'
            }`}
          >A</button>
          <button
            onClick={() => handleDemoSwitch('TRACK_B')}
            className={`text-[10px] font-black px-2.5 py-1.5 rounded-md transition-all ${
              circle.trackType === 'TRACK_B' ? 'bg-emerald-500 text-white' : 'text-white/50 hover:text-white'
            }`}
          >B</button>
        </div>
      </div>

      <main className="flex-1 min-w-0 min-h-screen flex flex-col overflow-hidden pt-[52px] lg:pt-0">
        {renderScreen()}
      </main>

      <PaymentModal
        isOpen={payOpen}
        onClose={() => setPayOpen(false)}
        amount={payCtx.amount}
        purpose={payCtx.purpose}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}