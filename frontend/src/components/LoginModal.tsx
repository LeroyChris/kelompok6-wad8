import React, { useState } from 'react';
import { Mail, KeyRound, Shield, ArrowLeft, RefreshCw } from 'lucide-react';
import apiClient from '../services/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Masukkan alamat email yang valid.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await apiClient.post('/auth/email/request-otp', { email });
      if (res.data?.status === 'success') {
        setStep('otp');
      } else {
        setErrorMsg(res.data?.message || 'Gagal mengirim kode OTP.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      setErrorMsg('Masukkan 6 digit kode OTP.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await apiClient.post('/auth/email/verify-otp', { email, otp_code: otpCode });
      
      const token = res.data?.data?.token || res.data?.token;
      if (token) {
        localStorage.setItem('auth_token', token);
        onSuccess();
      } else {
        setErrorMsg('Token tidak ditemukan dari respon server.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Kode OTP tidak valid.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('email');
    setEmail('');
    setOtpCode('');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#0A2578] rounded-xl flex items-center justify-center text-white">
              <Shield className="w-5 h-5 text-[#5A83DB]" />
            </div>
            <span className="font-black text-lg text-[#0A2578]">ArisanKita</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl">
            {errorMsg}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleRequestOTP} className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-black text-[#0A2578]">Masuk / Daftar Akun</h2>
              <p className="text-xs text-slate-500 mt-1">
                Masukkan email Anda untuk menerima kode verifikasi OTP.
              </p>
            </div>

            <div className="relative mt-2">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5A83DB]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#F84A4D] hover:bg-[#e03a3d] text-white font-bold rounded-2xl text-xs transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Kirim Kode OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-black text-[#0A2578]">Masukkan Kode OTP</h2>
              <p className="text-xs text-slate-500 mt-1">
                Kode dikirim ke <span className="font-bold text-slate-800">{email}</span>
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[11px] text-amber-800 font-medium">
              💡 <strong>Testing Mode:</strong> Gunakan kode OTP Sandbox <span className="font-mono font-bold bg-amber-200/80 px-1.5 py-0.5 rounded">123456</span> untuk verifikasi.
            </div>

            <div className="relative">
              <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-center text-lg font-mono font-bold text-slate-800 tracking-widest focus:outline-none focus:ring-2 focus:ring-[#5A83DB]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#0A2578] hover:bg-[#0A2578]/90 text-white font-bold rounded-2xl text-xs transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verifikasi & Masuk'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="w-full py-2 text-slate-500 hover:text-[#0A2578] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Ganti Email / Pindah Akun
            </button>
          </form>
        )}
      </div>
    </div>
  );
}