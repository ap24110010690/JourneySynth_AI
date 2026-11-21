import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthPageProps {
  notify?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ notify }) => {
  const { login, register, demoLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(true);

  // Status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const calculatePasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const passwordStrength = calculatePasswordStrength(password);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login(cleanEmail, password);
      notify?.('success', `Welcome back, ${user.full_name}!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid email or password.';
      setErrorMessage(message);
      notify?.('error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify and try again.');
      return;
    }
    if (!acceptTerms) {
      setErrorMessage('You must accept the terms of service to create an account.');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await register(cleanEmail, cleanName, password);
      notify?.('success', `Account created successfully! Welcome, ${user.full_name}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to register account.';
      setErrorMessage(message);
      notify?.('error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoSignIn = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const user = await demoLogin();
      notify?.('success', `Signed in as Demo User: ${user.full_name}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Demo login failed.';
      setErrorMessage(message);
      notify?.('error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('demo@journeysynth.ai');
    setPassword('demo123');
    setMode('login');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#070D19] text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Background glowing ambient orbs */}
      <div className="absolute top-[-150px] left-[-100px] w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-150px] right-[-100px] w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-5xl bg-[#091020]/90 border border-slate-800/80 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10">
        
        {/* Left Side: Product Showcase & Brand Info */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#0c162e] to-[#091020] p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col justify-between">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center border border-blue-400/25 shadow-lg shadow-blue-500/20">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display font-bold text-xl text-white tracking-tight">
                  JourneySynth AI
                </h1>
                <p className="text-xs text-blue-400 font-medium">Enterprise Synthetic Omnichannel Platform</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-8">
              Generate, validate, and explore enterprise-grade synthetic customer journeys with mathematically verified privacy and behavioral fidelity.
            </p>

            {/* Feature Highlights */}
            <div className="space-y-4">
              <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0">
                  <Cpu className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-slate-200">SDV CTGAN & Copula Generators</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Multi-modal generative models learning conditional channel transitions and journey timelines.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-slate-200">SDMetrics Quality Verification</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Rigorous statistical evaluation ensuring 100% anonymization without data leakage.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 shrink-0">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-slate-200">Full Omnichannel Analytics</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Explore customer timelines, conversion paths, channel drop-offs, and ML conversion models.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Demo Credentials Footer Note */}
          <div className="mt-8 pt-6 border-t border-slate-800/60">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Demo Account
              </span>
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium underline transition-colors"
              >
                Auto-fill
              </button>
            </div>
            <div className="bg-[#050b14] border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono text-slate-300 flex items-center justify-between">
              <div>
                <span className="text-slate-500">Email: </span>demo@journeysynth.ai
                <br />
                <span className="text-slate-500">Pass: </span>demo123
              </div>
              <button
                type="button"
                onClick={handleDemoSignIn}
                disabled={isSubmitting}
                className="px-2.5 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 text-[10px] font-sans font-semibold transition-colors disabled:opacity-50"
              >
                Instant In
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="lg:col-span-7 p-8 lg:p-10 flex flex-col justify-center">
          {/* Tab selector */}
          <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In to Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register New User
            </button>
          </div>

          {/* Form Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-display font-bold text-white tracking-tight">
              {mode === 'login' ? 'Welcome Back' : 'Create Your Account'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {mode === 'login'
                ? 'Enter your credentials to access JourneySynth AI omnichannel tools.'
                : 'Register as a new user to start generating and validating synthetic journeys.'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={fillDemoCredentials}
                    className="text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    Forgot or need demo?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 p-0.5"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Stay signed in for 30 days</span>
                </label>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDemoSignIn}
                  disabled={isSubmitting}
                  className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 text-xs font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>One-Click Demo Login</span>
                </button>
              </div>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Maya Chen"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full pl-9 pr-8 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className={`w-full pl-9 pr-8 py-2 bg-slate-900/90 border rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors ${
                        confirmPassword && confirmPassword !== password
                          ? 'border-rose-500/80 focus:ring-1 focus:ring-rose-500'
                          : 'border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Strength indicator */}
              {password && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Password Strength</span>
                    <span className={
                      passwordStrength >= 4
                        ? 'text-emerald-400 font-semibold'
                        : passwordStrength >= 2
                        ? 'text-amber-400 font-semibold'
                        : 'text-rose-400 font-semibold'
                    }>
                      {passwordStrength >= 4 ? 'Strong' : passwordStrength >= 2 ? 'Fair' : 'Weak'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-full flex-1 rounded-full transition-all ${
                          passwordStrength >= level
                            ? passwordStrength >= 4
                              ? 'bg-emerald-500'
                              : passwordStrength >= 2
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                            : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-1">
                <label className="flex items-start gap-2 cursor-pointer text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    I accept the{' '}
                    <span className="text-blue-400 hover:underline">Terms of Service</span> and{' '}
                    <span className="text-blue-400 hover:underline">Privacy Policy</span>.
                  </span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Registration</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer switch */}
          <div className="mt-6 text-center text-xs text-slate-400">
            {mode === 'login' ? (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMessage(null);
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                >
                  Register here
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-[11px] text-slate-500">
        JourneySynth AI © 2026 • Synthetic Data Vault (SDV) • Pandas • SDMetrics • FastAPI
      </div>
    </div>
  );
};
