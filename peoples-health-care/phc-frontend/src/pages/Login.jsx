import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../services/authService';

export default function Login() {
  const navigate    = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPw, setShowPw]         = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim())
      return setError('Please enter your email');
    if (!password)
      return setError('Please enter your password.');

    setLoading(true);
    try {
      const result = await authService.login(identifier.trim(), password);
      if (result.success) {
        const { role } = result.user;
        switch (role) {
          case 'doctor':   navigate('/doctor/dashboard');   break;
          case 'patient':  navigate('/patient/dashboard');  break;
          case 'lab':      navigate('/lab/dashboard');      break;
          case 'pharmacy': navigate('/pharmacy/dashboard'); break;
          case 'cashier':  navigate('/cashier/dashboard');  break;
          case 'admin':    navigate('/admin/dashboard');    break;
          default:         navigate('/');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">

      {/* ── Left Panel ── */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-950
                      via-blue-900 to-cyan-900 relative overflow-hidden
                      flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/3 left-1/3 w-80 h-80 rounded-full
                          bg-cyan-300 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-60 h-60 rounded-full
                          bg-blue-300 blur-3xl" />
        </div>

        <Link to="/" className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden">
            <img src="/Logo.png" alt="PHC" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">
              People's Health Care
            </p>
            <p className="text-cyan-300 text-xs">Medical Center Management</p>
          </div>
        </Link>

        <div className="relative">
          <h2 className="text-4xl font-black text-white mb-5 leading-tight">
            Your health,<br />
            <span className="text-cyan-300">our priority.</span>
          </h2>
          <p className="text-blue-200 text-sm leading-relaxed mb-10 max-w-sm">
            Access your personalized healthcare portal. Manage appointments,
            prescriptions, and lab results seamlessly.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: '📅', title: 'Easy Booking',  sub: 'Schedule appointments online'   },
              { icon: '💊', title: 'Digital Rx',    sub: 'Prescriptions sent instantly'   },
              { icon: '🧪', title: 'Lab Reports',   sub: 'Results at your fingertips'     },
              { icon: '🔒', title: 'Secure',        sub: 'Private & encrypted records'    },
            ].map((f) => (
              <div key={f.title}
                className="bg-white/10 backdrop-blur-sm border border-white/15
                           rounded-2xl p-4">
                <p className="text-xl mb-1.5">{f.icon}</p>
                <p className="text-white text-xs font-bold">{f.title}</p>
                <p className="text-blue-300 text-xs">{f.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative border-t border-white/15 pt-6">
          <p className="text-blue-200 text-xs italic">
            "Compassionate care backed by intelligent technology."
          </p>
          <p className="text-blue-400 text-xs mt-1">
            — Dr. M.T.D. Jayaweera, Medical Director
          </p>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden">
              <img src="/Logo.png" alt="PHC" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-blue-950 text-sm">People's Health Care</span>
          </Link>

          <h1 className="text-2xl font-black text-blue-950 mb-1">Welcome back</h1>
          <p className="text-slate-500 text-sm mb-8">
            Sign in with your email address
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3
                            rounded-xl mb-5 text-sm flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                  <path fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
              <button onClick={() => setError('')}
                className="text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Identifier — email or username */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Email Address
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white
                           text-slate-800 text-sm placeholder-slate-400 focus:outline-none
                           focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white
                             text-slate-800 text-sm placeholder-slate-400 focus:outline-none
                             focus:ring-2 focus:ring-blue-500 transition-all pr-11"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-slate-400 hover:text-slate-600">
                  {showPw ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-blue-900 hover:bg-blue-800 text-white
                         font-bold rounded-xl transition-all text-sm
                         shadow-lg shadow-blue-900/20 disabled:opacity-70
                         flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">New patient?</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <Link to="/register"
            className="w-full block text-center py-3.5 border-2 border-slate-200
                       text-slate-700 font-bold rounded-xl hover:border-blue-300
                       hover:bg-blue-50 transition-all text-sm">
            Create Patient Account
          </Link>

          <p className="text-center text-slate-400 text-xs mt-6">
            Staff members: Contact administrator for account access
          </p>
          <p className="text-center text-slate-400 text-xs mt-2">
            © {new Date().getFullYear()} People's Health Care — Matara, Sri Lanka
          </p>
        </div>
      </div>
    </div>
  );
}