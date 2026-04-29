import { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, Building2, ArrowRight, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { AnimatedBackground } from './AnimatedBackground';
import { useAuth } from '@/contexts/AuthContext';

interface AuthScreenProps {
  mode: 'signin' | 'signup';
  onToggleMode: () => void;
}

export function AuthScreen({ mode, onToggleMode }: AuthScreenProps) {
  const { signUp, signIn, error, clearError, loading } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmationMessage, setShowConfirmationMessage] = useState(false);
  const [confirmationSentEmail, setConfirmationSentEmail] = useState('');
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    let strength = 0;
    if (value.length > 6) strength += 25;
    if (value.length > 10) strength += 25;
    if (/[A-Z]/.test(value)) strength += 25;
    if (/[0-9]/.test(value)) strength += 25;
    setPasswordStrength(strength);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const { emailConfirmationSent } = await signUp({
          email,
          password,
          firstName,
          lastName,
          companyName,
        });
        if (emailConfirmationSent) {
          setConfirmationSentEmail(email);
          setPendingCredentials({ email, password });
          setShowConfirmationMessage(true);
        }
      } else {
        await signIn(email, password);
      }
    } catch {
      // Error is set in AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueToSignIn = () => {
    if (pendingCredentials) {
      setEmail(pendingCredentials.email);
      setPassword(pendingCredentials.password);
      setPendingCredentials(null);
    }
    setShowConfirmationMessage(false);
    onToggleMode();
  };

  const getStrengthColor = () => {
    if (passwordStrength < 25) return '#FF3D00';
    if (passwordStrength < 50) return '#FFB300';
    if (passwordStrength < 75) return '#00D9FF';
    return '#00E676';
  };

  const getStrengthLabel = () => {
    if (passwordStrength < 25) return 'Weak';
    if (passwordStrength < 50) return 'Fair';
    if (passwordStrength < 75) return 'Good';
    return 'Strong';
  };

  return (
    <div className="min-h-screen flex bg-[#0A1628] overflow-hidden">
      {/* Left Side - Animated Visual */}
      <motion.div
        className="hidden lg:flex lg:w-[60%] relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <AnimatedBackground />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <h1 className="text-6xl font-bold mb-6 leading-tight">
              Close <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D9FF] to-[#0066FF]">3X</span> More Deals
            </h1>
            <p className="text-xl text-[#B0BEC5] mb-12 max-w-lg">
              Power dialing platform trusted by high-velocity sales teams to crush quota every month
            </p>

            <div className="flex gap-12">
              <div>
                <div className="text-5xl font-bold text-[#00D9FF] mb-2">2,000+</div>
                <div className="text-[#B0BEC5]">Active Teams</div>
              </div>
              <div>
                <div className="text-5xl font-bold text-[#00E676] mb-2">10M+</div>
                <div className="text-[#B0BEC5]">Calls Connected</div>
              </div>
              <div>
                <div className="text-5xl font-bold text-[#0066FF] mb-2">38%</div>
                <div className="text-[#B0BEC5]">Avg Connect Rate</div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0A1628] to-transparent" />
      </motion.div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-[40%] flex items-center justify-center p-8 relative">
        <motion.div
          className="w-full max-w-[440px]"
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          {/* Logo */}
          <div className="mb-12 text-center lg:text-left">
            <div className="inline-flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00D9FF] to-[#0066FF] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white rounded-full" />
              </div>
              <span className="text-2xl font-bold text-white">Softdial</span>
            </div>
          </div>

          {/* Card */}
          <div className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,102,255,0.15)] border border-white/5">
            {showConfirmationMessage ? (
              <>
                <div className="flex justify-center mb-6">
                  <div className="w-14 h-14 rounded-full bg-[#00E676]/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-[#00E676]" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 text-center">
                  Check your email
                </h2>
                <p className="text-sm text-[#B0BEC5] mb-8 text-center">
                  A confirmation email has been sent to <span className="text-white font-medium">{confirmationSentEmail}</span>. Please check your inbox and click the confirmation link to activate your account.
                </p>
                <motion.button
                  type="button"
                  onClick={handleContinueToSignIn}
                  className="w-full h-12 bg-gradient-to-r from-[#00D9FF] to-[#0066FF] rounded-xl text-white font-semibold flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(0,217,255,0.3)] hover:shadow-[0_6px_32px_rgba(0,217,255,0.4)] transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span>Continue to Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </>
            ) : (
              <>
            <h2 className="text-3xl font-bold text-white mb-2">
              {mode === 'signup' ? 'Start Crushing Quota' : 'Welcome Back'}
            </h2>
            <p className="text-sm text-[#B0BEC5] mb-8">
              {mode === 'signup' ? 'Join 2,000+ teams closing faster' : 'Sign in to continue dialing'}
            </p>

            {error && (
              <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'signup' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#B0BEC5] mb-2 ml-1">
                        First name
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B0BEC5]" />
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-[#B0BEC5]/50 focus:outline-none focus:border-[#00D9FF] transition-colors"
                          placeholder="John"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-[#B0BEC5] mb-2 ml-1">
                        Last name
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B0BEC5]" />
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-[#B0BEC5]/50 focus:outline-none focus:border-[#00D9FF] transition-colors"
                          placeholder="Doe"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#B0BEC5] mb-2 ml-1">
                      Company name
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B0BEC5]" />
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-[#B0BEC5]/50 focus:outline-none focus:border-[#00D9FF] transition-colors"
                        placeholder="Acme Inc."
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs text-[#B0BEC5] mb-2 ml-1">
                  {mode === 'signup' ? 'Company email' : 'Email'}
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B0BEC5]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-[#B0BEC5]/50 focus:outline-none focus:border-[#00D9FF] transition-colors"
                    placeholder="you@company.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#B0BEC5] mb-2 ml-1">
                  {mode === 'signup' ? 'Account password' : 'Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B0BEC5]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl pl-12 pr-12 py-3.5 text-white placeholder-[#B0BEC5]/50 focus:outline-none focus:border-[#00D9FF] transition-colors"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#B0BEC5] hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {mode === 'signup' && password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#B0BEC5]">Password strength</span>
                      <span className="text-xs" style={{ color: getStrengthColor() }}>
                        {getStrengthLabel()}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#1E2A3A] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: getStrengthColor() }}
                        initial={{ width: 0 }}
                        animate={{ width: `${passwordStrength}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {mode === 'signin' && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-[#1E2A3A] text-[#00D9FF] focus:ring-[#00D9FF] focus:ring-offset-0" />
                    <span className="text-sm text-[#B0BEC5] group-hover:text-white transition-colors">Remember me</span>
                  </label>
                  <a href="#" className="text-sm text-[#00D9FF] hover:underline">Forgot password?</a>
                </div>
              )}

              <motion.button
                type="submit"
                disabled={loading || submitting}
                className="w-full h-12 bg-gradient-to-r from-[#00D9FF] to-[#0066FF] rounded-xl text-white font-semibold flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(0,217,255,0.3)] hover:shadow-[0_6px_32px_rgba(0,217,255,0.4)] transition-all relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed"
                whileHover={!(loading || submitting) ? { scale: 1.02 } : undefined}
                whileTap={!(loading || submitting) ? { scale: 0.98 } : undefined}
              >
                <span>
                  {submitting ? 'Please wait…' : mode === 'signup' ? 'Get Started Free' : 'Sign In'}
                </span>
                {!submitting && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </motion.button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-sm text-[#B0BEC5]">
                {mode === 'signup' ? 'Already have an account?' : 'New here?'}
              </span>{' '}
              <button
                type="button"
                onClick={onToggleMode}
                className="text-sm text-[#00D9FF] hover:underline font-semibold"
              >
                {mode === 'signup' ? 'Sign In' : 'Create Account'}
              </button>
            </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
