import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Shield, Copy, Check, QrCode, Wallet, CreditCard,
  Clock, Download, ExternalLink, RefreshCw,
  CheckCircle2, Zap,
} from 'lucide-react';

/* ─── Types ─── */
type Tab    = 'va' | 'qris' | 'ewallet';
type Bank   = 'bca' | 'mandiri' | 'bri' | 'bni';
type EWallet = 'gopay' | 'ovo' | 'shopeepay';

/* ─── Config ─── */
const VA_BANKS: Array<{ id: Bank; label: string; color: string; vaNumber: string }> = [
  { id: 'bca',     label: 'BCA',     color: '#0038a8', vaNumber: '88012-93810-29381' },
  { id: 'mandiri', label: 'Mandiri', color: '#003F88', vaNumber: '70020-93810-29381' },
  { id: 'bri',     label: 'BRI',     color: '#003087', vaNumber: '88888-12938-10293' },
  { id: 'bni',     label: 'BNI',     color: '#f26522', vaNumber: '98880-29381-02938' },
];

const EWALLETS: Array<{ id: EWallet; label: string; color: string; sub: string }> = [
  { id: 'gopay',     label: 'GoPay',     color: '#00AA13', sub: 'Bayar via aplikasi Gojek'    },
  { id: 'ovo',       label: 'OVO',       color: '#4c3494', sub: 'Bayar via aplikasi OVO'      },
  { id: 'shopeepay', label: 'ShopeePay', color: '#EE4D2D', sub: 'Bayar via Shopee / SeaMoney' },
];

/* ─── QR Code visual generator ─── */
function QRCodeVisual({ size = 160 }: { size?: number }) {
  const N = 21;
  const cs = size / N;

  const finderDark = (r: number, c: number, br: number, bc: number): boolean => {
    const dr = r - br, dc = c - bc;
    if (dr < 0 || dr > 6 || dc < 0 || dc > 6) return false;
    if (dr === 0 || dr === 6 || dc === 0 || dc === 6) return true;
    if (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4) return true;
    return false;
  };

  const cells: React.ReactNode[] = [];

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      let dark = false;
      // Finder patterns
      if (finderDark(r, c, 0, 0))       dark = true;
      else if (finderDark(r, c, 0, 14)) dark = true;
      else if (finderDark(r, c, 14, 0)) dark = true;
      // Timing patterns
      else if (r === 6 && c > 7 && c < 13) dark = c % 2 === 0;
      else if (c === 6 && r > 7 && r < 13) dark = r % 2 === 0;
      // Separators / format info area → light
      else if ((r === 7 || c === 7) && (r < 9 || c < 9)) dark = false;
      // Data modules (seeded deterministic)
      else if (r > 8 || c > 8) {
        dark = ((r * 31 + c * 17 + r ^ c) % 5) < 2;
      }

      if (dark) {
        cells.push(
          <rect
            key={`${r}-${c}`}
            x={+(c * cs).toFixed(2)}
            y={+(r * cs).toFixed(2)}
            width={+(cs + 0.5).toFixed(2)}
            height={+(cs + 0.5).toFixed(2)}
            fill="#0A2578"
          />
        );
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-xl bg-white"
      style={{ display: 'block' }}
    >
      {cells}
    </svg>
  );
}

/* ─── Countdown hook ─── */
function useCountdown(active: boolean, initialSeconds = 86385) {
  const [secs, setSecs] = useState(initialSeconds);
  const targetTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setSecs(initialSeconds);
      targetTimeRef.current = null;
      return;
    }

    if (!targetTimeRef.current) {
      targetTimeRef.current = Date.now() + initialSeconds * 1000;
    }

    const t = setInterval(() => {
      const remaining = Math.max(0, Math.round((targetTimeRef.current! - Date.now()) / 1000));
      setSecs(remaining);
    }, 1000);

    return () => clearInterval(t);
  }, [active, initialSeconds]);

  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${h}j : ${m}m : ${s}d`;
}

/* ─── Copy hook ─── */
function useCopy(timeout = 2000) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    const t = setTimeout(() => setCopied(false), timeout);
    return () => clearTimeout(t);
  }, [timeout]);
  return { copied, copy };
}

/* ─── Helpers ─── */
const fmtRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

/* ─── Props ─── */
export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  purpose: string;
  txRef?: string;
}

/* ─── Main Component ─── */
export default function PaymentModal({
  isOpen,
  onClose,
  amount,
  purpose,
  txRef,
}: PaymentModalProps) {
  const [tab, setTab]           = useState<Tab>('va');
  const [bank, setBank]         = useState<Bank>('bca');
  const [ewallet, setEwallet]   = useState<EWallet>('gopay');
  const [checkLoading, setLoad] = useState(false);
  const [checkDone, setDone]    = useState(false);

  const countdown              = useCountdown(isOpen);
  const { copied: refCopied,  copy: copyRef  } = useCopy();
  const { copied: vaCopied,   copy: copyVA   } = useCopy();

  const ref = txRef ?? `REF-ARK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0921`;
  const activeBank = VA_BANKS.find((b) => b.id === bank)!;

  const handleCheckStatus = useCallback(() => {
    setLoad(true);
    setTimeout(() => { setLoad(false); setDone(true); }, 1800);
  }, []);

  // Reset on close
  useEffect(() => {
    if (!isOpen) { setTab('va'); setDone(false); setLoad(false); }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end lg:items-center justify-center bg-slate-900/65 backdrop-blur-sm lg:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full lg:max-w-lg rounded-t-[32px] lg:rounded-3xl shadow-2xl overflow-hidden max-h-[95dvh] flex flex-col">

        {/* Mobile drag handle */}
        <div className="w-full flex justify-center pt-3 pb-1 lg:hidden shrink-0">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        {/* ── Header ── */}
        <div className="px-6 py-5 border-b border-slate-100 shrink-0 bg-[#0A2578] text-white">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-white/60 font-bold uppercase tracking-wider mb-1">Instruksi Pembayaran</p>
              <h2 className="font-black text-xl leading-none">{purpose}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0 ml-3"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-2.5">
            <p className="text-4xl font-black font-mono tracking-tight">{fmtRp(amount)}</p>

            {/* TX ref */}
            <button
              onClick={() => copyRef(ref)}
              className="flex items-center gap-2 bg-white/10 border border-white/20 hover:bg-white/15 rounded-xl px-3.5 py-2.5 transition-all w-fit"
            >
              <span className="font-mono text-xs font-bold text-white/80 tracking-wide">{ref}</span>
              {refCopied
                ? <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                : <Copy className="w-3.5 h-3.5 text-white/50 shrink-0" />}
            </button>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2 mt-4 bg-white/10 border border-white/15 rounded-xl px-3.5 py-2.5 w-fit">
            <Clock className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
            <span className="text-xs font-bold text-white/80">Selesaikan dalam</span>
            <span className="font-mono text-sm font-black text-amber-300">{countdown}</span>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1">
          <div className="p-5 flex flex-col gap-5">

            {/* ── Tab selector ── */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {([
                { id: 'va' as Tab,      label: 'Virtual Account', icon: <CreditCard className="w-3.5 h-3.5" /> },
                { id: 'qris' as Tab,    label: 'QRIS',            icon: <QrCode className="w-3.5 h-3.5" />    },
                { id: 'ewallet' as Tab, label: 'E-Wallet',        icon: <Wallet className="w-3.5 h-3.5" />    },
              ] as Array<{ id: Tab; label: string; icon: React.ReactNode }>).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-bold rounded-lg transition-all ${
                    tab === t.id
                      ? 'bg-white text-[#0A2578] shadow-sm ring-1 ring-slate-200/50'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className={tab === t.id ? 'text-[#5A83DB]' : ''}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Tab A: Virtual Account ── */}
            {tab === 'va' && (
              <div className="flex flex-col gap-4">
                {/* Bank selector pills */}
                <div className="grid grid-cols-4 gap-2">
                  {VA_BANKS.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBank(b.id)}
                      className={`py-2.5 px-1 text-xs font-black rounded-xl border-2 transition-all ${
                        bank === b.id
                          ? 'border-[#0A2578] text-[#0A2578] bg-[#0A2578]/6'
                          : 'border-slate-200 text-slate-500 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                {/* VA Number display */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 flex flex-col gap-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Nomor Virtual Account {activeBank.label}
                  </p>
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-2xl font-black text-[#0A2578] flex-1 tracking-widest">
                      {activeBank.vaNumber}
                    </p>
                    <button
                      onClick={() => copyVA(activeBank.vaNumber.replace(/-/g, ''))}
                      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                        vaCopied
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-[#0A2578] text-white hover:bg-[#0A2578]/90'
                      }`}
                    >
                      {vaCopied ? <><Check className="w-3.5 h-3.5" /> Tersalin</> : <><Copy className="w-3.5 h-3.5" /> Salin VA</>}
                    </button>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">Atas nama:</span>
                    <span className="text-xs font-black text-slate-700">ARISAN ALUMNI 2018</span>
                  </div>
                </div>

                {/* Steps */}
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-black text-[#0A2578]">Cara Pembayaran</p>
                  {[
                    `Buka m-${activeBank.label.toUpperCase()} / ATM ${activeBank.label}`,
                    `Pilih menu Transfer → Virtual Account`,
                    `Masukkan nomor VA: ${activeBank.vaNumber}`,
                    `Konfirmasi nominal ${fmtRp(amount)} dan selesaikan`,
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#0A2578]/10 text-[#0A2578] flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{i + 1}</span>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tab B: QRIS ── */}
            {tab === 'qris' && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-xs font-bold text-slate-500 text-center leading-relaxed">
                  Scan QR Code berikut menggunakan aplikasi bank atau e-wallet manapun yang mendukung QRIS Nasional.
                </p>

                {/* QR Code */}
                <div className="flex flex-col items-center gap-3 p-5 bg-white border-2 border-[#0A2578]/15 rounded-2xl shadow-sm">
                  <QRCodeVisual size={180} />
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    QR aktif · Berlaku {countdown}
                  </div>
                </div>

                {/* Amount pill */}
                <div className="w-full bg-[#0A2578]/5 border border-[#0A2578]/12 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Total dibayar via QRIS</span>
                  <span className="font-black text-[#0A2578] font-mono">{fmtRp(amount)}</span>
                </div>

                <button className="flex items-center gap-2 text-xs font-bold text-[#5A83DB] hover:text-[#0A2578] transition-colors py-1">
                  <Download className="w-3.5 h-3.5" />
                  Unduh QRIS sebagai PNG
                </button>
              </div>
            )}

            {/* ── Tab C: E-Wallet ── */}
            {tab === 'ewallet' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-slate-500 leading-relaxed">
                  Pilih e-wallet untuk pembayaran instan. Kamu akan diarahkan langsung ke aplikasi.
                </p>

                {EWALLETS.map((ew) => (
                  <button
                    key={ew.id}
                    onClick={() => setEwallet(ew.id)}
                    className={`flex items-center gap-3.5 p-4 rounded-2xl border-2 transition-all text-left ${
                      ewallet === ew.id
                        ? 'border-[#0A2578] bg-[#0A2578]/4'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      ewallet === ew.id ? 'border-[#0A2578] bg-[#0A2578]' : 'border-slate-300'
                    }`}>
                      {ewallet === ew.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${ew.color}18` }}
                    >
                      <Wallet className="w-4 h-4" style={{ color: ew.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-black ${ewallet === ew.id ? 'text-[#0A2578]' : 'text-slate-700'}`}>{ew.label}</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{ew.sub}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                ))}

                <button className="w-full mt-1 flex items-center justify-center gap-2 py-4 font-extrabold text-white rounded-xl transition-all active:scale-[0.97] shadow-md"
                  style={{ background: EWALLETS.find((e) => e.id === ewallet)!.color }}
                >
                  <Zap className="w-5 h-5" />
                  Bayar Instan di App {EWALLETS.find((e) => e.id === ewallet)!.label}
                </button>
              </div>
            )}

            {/* ── Security badge ── */}
            <div className="flex items-start gap-3 bg-[#0A2578]/4 border border-[#0A2578]/12 rounded-xl px-4 py-3">
              <Shield className="w-4 h-4 text-[#5A83DB] shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                <span className="font-bold text-[#0A2578]">Non-Custodial Payment.</span>{' '}
                Diproses langsung oleh Payment Gateway resmi Bank Indonesia. ArisanKita tidak menyimpan dana atau data kartu Anda.
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer CTA ── */}
        <div className="px-5 pb-10 lg:pb-5 pt-4 border-t border-slate-100 shrink-0">
          {checkDone ? (
            <div className="w-full flex items-center justify-center gap-2.5 py-4 bg-emerald-500 text-white font-black rounded-xl shadow-md shadow-emerald-500/25">
              <CheckCircle2 className="w-5 h-5" />
              Pembayaran Terverifikasi!
            </div>
          ) : (
            <button
              onClick={handleCheckStatus}
              disabled={checkLoading}
              className="w-full flex items-center justify-center gap-2.5 py-4 font-extrabold text-white rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-[#F84A4D]/25 bg-[#F84A4D] hover:bg-[#e03a3d] disabled:opacity-70"
            >
              {checkLoading
                ? <><RefreshCw className="w-5 h-5 animate-spin" /> Mengecek Status...</>
                : <><CheckCircle2 className="w-5 h-5" /> Cek Status Pembayaran</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
