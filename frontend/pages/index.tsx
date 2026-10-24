export default function Page() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A2578] to-[#0f172a] text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-[#F84A4D]">ArisanKita</h1>
        
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/5">
          <p className="text-slate-300 mb-6 leading-relaxed">
            Selamat datang di ArisanKita - platform masyarakat untuk berpartisipasi dalam kegiatan arisan bersama.
          </p>
          
          <div className="flex gap-3">
            <a href="/auth/otp/request" className="flex-1 bg-[#F84A4D] hover:bg-[#e03a3d] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg text-sm">
              <svg className="mr-2 w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M2.1 2.1l4.2 4.2L12 3.9l8.1 8.2-4.2 4.2L12 15.8 3.9 7.9 2.1 2.1zm11.9 3.9l-5.5 5.5L12 10l7.1 7.2-5.5 5.5L12 18l7.1-7.2 5.5 5.5L12 6z"/></svg>
              Masuk dengan Email OTP
            </a>
            <a href="/auth/login" className="flex-1 bg-[#0A2578] hover:bg-[#0a4aae] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg text-sm">
              <svg className="mr-2 w-4 h-4" viewBox="0 0 24 20"><path fill="currentColor" d="M2.1 1.4l4.5 4.6L6.7 9.9L12 15.5l5.3-5.4L17.9 9.9l4.5 4.6L21.9 6L12 1.4 2.1 1.4zM12 4l-2.7 2.9L15.5 15H8.5l7.4-12.1L12 4z"/></svg>
              Masuk dengan Password
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}