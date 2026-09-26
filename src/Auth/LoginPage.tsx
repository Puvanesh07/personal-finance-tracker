// src/Auth/LoginPage.tsx
//
// Email/Password sign-in page.
// Also provides "Forgot Password" flow via Firebase sendPasswordResetEmail.
// Theme: light lavender, matched to the marketing landing page.

import {
  FiArrowLeft,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiLoader,
  FiLock,
  FiMail,
  FiTrendingUp,
} from 'react-icons/fi';
import { auth } from '../services/firebase';
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { ensureAuthPersistence } from './authBootstrap';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useState } from 'react';

interface LoginPageProps {
  onBack: () => void;
  onSwitchToRegister: () => void;
}

const VIOLET = '#7c3aed';
const VIOLET_DEEP = '#6d28d9';
const INK = '#241a3d';
const BODY = '#5b4b7f';
const ERR = '#be185c';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export default function LoginPage({
  onBack,
  onSwitchToRegister,
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const validate = () => {
    const e: { email?: string; password?: string } = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    return e;
  };

  const handleSignIn = async () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      await ensureAuthPersistence();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success('Welcome back! 👋', {
        duration: 3000,
        style: {
          background: INK,
          color: '#ffffff',
          border: '1px solid rgba(124,58,237,0.4)',
        },
        iconTheme: { primary: VIOLET, secondary: '#ffffff' },
      });
    } catch (error: unknown) {
      setLoading(false);
      const code = (error as { code?: string })?.code;
      const msg =
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
          ? 'Invalid email or password.'
          : code === 'auth/too-many-requests'
            ? 'Too many failed attempts. Try again later or reset your password.'
            : code === 'auth/network-request-failed'
              ? 'Network error. Check your connection.'
              : code === 'auth/app-check-token-fetch-failed'
                ? 'Security check failed. Try disabling blockers or use another browser.'
                : 'Sign-in failed. Please try again.';
      toast.error(msg, {
        duration: 4500,
        style: {
          background: INK,
          color: '#ffffff',
          border: '1px solid rgba(190,24,92,0.4)',
        },
      });
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      toast.error('Enter a valid email address.', {
        style: {
          background: INK,
          color: '#ffffff',
          border: '1px solid rgba(190,24,92,0.4)',
        },
      });
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      toast.success('Reset link sent! Check your inbox.', {
        duration: 5000,
        style: {
          background: INK,
          color: '#ffffff',
          border: '1px solid rgba(124,58,237,0.4)',
        },
        iconTheme: { primary: VIOLET, secondary: '#ffffff' },
      });
      setShowForgot(false);
      setResetEmail('');
    } catch {
      toast.error(
        'Could not send reset email. Check the address and try again.',
        {
          style: {
            background: INK,
            color: '#ffffff',
            border: '1px solid rgba(190,24,92,0.4)',
          },
        },
      );
    } finally {
      setResetLoading(false);
    }
  };

  const inputBase: React.CSSProperties = {
    width: '100%',
    background: 'rgba(124,58,237,0.04)',
    border: '1px solid rgba(124,58,237,0.16)',
    borderRadius: 10,
    padding: '11px 12px 11px 40px',
    color: INK,
    fontSize: 14,
    outline: 'none',
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.82)',
    border: '1px solid rgba(124,58,237,0.16)',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 24px 60px rgba(109,40,217,0.16)',
  };

  return (
    <div
      className='min-h-screen flex flex-col items-center justify-center px-4 py-10'
      style={{
        background:
          'linear-gradient(180deg, #faf7ff 0%, #f2e9ff 55%, #eaddff 100%)',
        color: INK,
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
      }}
    >
      {/* Background glows */}
      <div className='fixed inset-0 pointer-events-none' style={{ zIndex: 0 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(124,58,237,0.16) 0%, transparent 60%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 55% 40% at 95% 80%, rgba(168,85,247,0.12) 0%, transparent 55%)',
          }}
        />
      </div>

      <motion.div
        className='relative w-full'
        style={{ maxWidth: 420, zIndex: 1 }}
        initial='hidden'
        animate='show'
        variants={stagger}
      >
        {/* Back */}
        <motion.button
          variants={fadeUp}
          onClick={onBack}
          className='flex items-center gap-2 mb-8 text-sm font-medium'
          style={{
            color: BODY,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          whileHover={{ color: VIOLET } as any}
        >
          <FiArrowLeft className='h-4 w-4' /> Back
        </motion.button>

        {/* Logo */}
        <motion.div variants={fadeUp} className='flex items-center gap-2.5 mb-8'>
          <div
            className='h-9 w-9 rounded-xl flex items-center justify-center'
            style={{
              background: `linear-gradient(135deg, ${VIOLET}, ${VIOLET_DEEP})`,
              boxShadow: '0 8px 20px rgba(124,58,237,0.35)',
            }}
          >
            <FiTrendingUp
              className='text-white'
              style={{ height: 18, width: 18 }}
            />
          </div>
          <span className='text-lg font-bold tracking-tight' style={{ color: INK }}>
            Fin<span style={{ color: VIOLET }}>Trackly</span>
          </span>
        </motion.div>

        {/* Forgot Password modal */}
        {showForgot ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className='rounded-2xl p-8'
            style={cardStyle}
          >
            <h2 className='text-xl font-black mb-1' style={{ color: INK }}>
              Reset your password
            </h2>
            <p className='text-sm mb-6' style={{ color: BODY }}>
              Enter your email and we'll send a reset link.
            </p>
            <div className='relative mb-4'>
              <span
                className='absolute left-3 top-1/2 -translate-y-1/2'
                style={{ color: 'rgba(124,58,237,0.4)', pointerEvents: 'none' }}
              >
                <FiMail />
              </span>
              <input
                type='email'
                placeholder='you@example.com'
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                style={inputBase}
                onFocus={(e) =>
                  (e.target.style.borderColor = 'rgba(124,58,237,0.5)')
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = 'rgba(124,58,237,0.16)')
                }
              />
            </div>
            <div className='flex gap-3'>
              <button
                onClick={() => setShowForgot(false)}
                className='flex-1 py-3 rounded-xl text-sm font-semibold'
                style={{
                  pointerEvents: 'auto',
                  background: 'rgba(124,58,237,0.06)',
                  border: '1px solid rgba(124,58,237,0.16)',
                  color: BODY,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <motion.button
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className='flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60'
                style={{
                  background: `linear-gradient(135deg, ${VIOLET}, ${VIOLET_DEEP})`,
                  border: 'none',
                  cursor: resetLoading ? 'not-allowed' : 'pointer',
                }}
                whileHover={!resetLoading ? ({ scale: 1.02 } as any) : {}}
                whileTap={!resetLoading ? { scale: 0.98 } : {}}
              >
                {resetLoading ? (
                  <FiLoader className='animate-spin' />
                ) : (
                  'Send Reset Link'
                )}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          /* Sign-in card */
          <motion.div variants={fadeUp} className='rounded-2xl p-8' style={cardStyle}>
            <h1 className='text-2xl font-black mb-1' style={{ color: INK }}>
              Welcome back
            </h1>
            <p className='text-sm mb-7' style={{ color: BODY }}>
              Sign in to your FinTrackly account
            </p>

            <div className='flex flex-col gap-4'>
              {/* Email */}
              <div>
                <label
                  className='block text-xs font-semibold mb-1.5'
                  style={{ color: BODY }}
                >
                  Email Address
                </label>
                <div className='relative'>
                  <span
                    className='absolute left-3 top-1/2 -translate-y-1/2'
                    style={{
                      color: errors.email ? ERR : 'rgba(124,58,237,0.4)',
                      pointerEvents: 'none',
                    }}
                  >
                    <FiMail />
                  </span>
                  <input
                    type='email'
                    placeholder='you@example.com'
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((p) => ({ ...p, email: '' }));
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                    style={{
                      ...inputBase,
                      borderColor: errors.email
                        ? 'rgba(190,24,92,0.5)'
                        : 'rgba(124,58,237,0.16)',
                    }}
                    onFocus={(e) => {
                      if (!errors.email)
                        e.target.style.borderColor = 'rgba(124,58,237,0.5)';
                    }}
                    onBlur={(e) => {
                      if (!errors.email)
                        e.target.style.borderColor = 'rgba(124,58,237,0.16)';
                    }}
                  />
                </div>
                {errors.email && (
                  <p className='text-xs mt-1' style={{ color: ERR }}>
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className='flex items-center justify-between mb-1.5'>
                  <label className='text-xs font-semibold' style={{ color: BODY }}>
                    Password
                  </label>
                  <button
                    onClick={() => {
                      setShowForgot(true);
                      setResetEmail(email);
                    }}
                    className='text-xs font-medium'
                    style={{
                      color: VIOLET,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className='relative'>
                  <span
                    className='absolute left-3 top-1/2 -translate-y-1/2'
                    style={{
                      color: errors.password ? ERR : 'rgba(124,58,237,0.4)',
                      pointerEvents: 'none',
                    }}
                  >
                    <FiLock />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder='Your password'
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password)
                        setErrors((p) => ({ ...p, password: '' }));
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                    style={{
                      ...inputBase,
                      paddingRight: 40,
                      borderColor: errors.password
                        ? 'rgba(190,24,92,0.5)'
                        : 'rgba(124,58,237,0.16)',
                    }}
                    onFocus={(e) => {
                      if (!errors.password)
                        e.target.style.borderColor = 'rgba(124,58,237,0.5)';
                    }}
                    onBlur={(e) => {
                      if (!errors.password)
                        e.target.style.borderColor = 'rgba(124,58,237,0.16)';
                    }}
                  />
                  <button
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='absolute right-3 top-1/2 -translate-y-1/2'
                    style={{
                      color: 'rgba(124,58,237,0.45)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                {errors.password && (
                  <p className='text-xs mt-1' style={{ color: ERR }}>
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Submit */}
              <motion.button
                onClick={handleSignIn}
                disabled={loading}
                className='flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl font-bold text-sm text-white mt-2 disabled:opacity-60'
                style={{
                  background: `linear-gradient(135deg, ${VIOLET}, ${VIOLET_DEEP})`,
                  boxShadow: '0 12px 28px rgba(124,58,237,0.32)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  border: 'none',
                }}
                whileHover={!loading ? ({ scale: 1.02 } as any) : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
              >
                {loading ? (
                  <>
                    <FiLoader className='animate-spin' /> Signing in…
                  </>
                ) : (
                  <>
                    Sign In <FiArrowRight />
                  </>
                )}
              </motion.button>
            </div>

            {/* Divider */}
            <div className='flex items-center gap-3 my-5'>
              <div style={{ flex: 1, height: 1, background: 'rgba(124,58,237,0.14)' }} />
              <span className='text-xs' style={{ color: 'rgba(124,58,237,0.45)' }}>
                or
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(124,58,237,0.14)' }} />
            </div>

            <p className='text-xs text-center' style={{ color: BODY }}>
              Don't have an account?{' '}
              <button
                onClick={onSwitchToRegister}
                style={{
                  color: VIOLET,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Create one free
              </button>
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
