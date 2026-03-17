// src/Auth/LoginPage.tsx
//
// Email/Password sign-in page.
// Also provides "Forgot Password" flow via Firebase sendPasswordResetEmail.

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
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { auth } from '../services/firebase';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useState } from 'react';

interface LoginPageProps {
  onBack: () => void;
  onSwitchToRegister: () => void;
}

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
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success('Welcome back! 👋', {
        duration: 3000,
        style: {
          background: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(16,185,129,0.4)',
        },
        iconTheme: { primary: '#10b981', secondary: '#f8fafc' },
      });
    } catch (error: any) {
      setLoading(false);
      const msg =
        error?.code === 'auth/user-not-found' ||
        error?.code === 'auth/wrong-password' ||
        error?.code === 'auth/invalid-credential'
          ? 'Invalid email or password.'
          : error?.code === 'auth/too-many-requests'
            ? 'Too many failed attempts. Try again later or reset your password.'
            : error?.code === 'auth/network-request-failed'
              ? 'Network error. Check your connection.'
              : 'Sign-in failed. Please try again.';
      toast.error(msg, {
        duration: 4500,
        style: {
          background: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(248,113,113,0.4)',
        },
      });
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      toast.error('Enter a valid email address.', {
        style: {
          background: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(248,113,113,0.4)',
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
          background: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(16,185,129,0.4)',
        },
        iconTheme: { primary: '#10b981', secondary: '#f8fafc' },
      });
      setShowForgot(false);
      setResetEmail('');
    } catch {
      toast.error(
        'Could not send reset email. Check the address and try again.',
        {
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid rgba(248,113,113,0.4)',
          },
        },
      );
    } finally {
      setResetLoading(false);
    }
  };

  const inputBase: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '11px 12px 11px 40px',
    color: '#f8fafc',
    fontSize: 14,
    outline: 'none',
  };

  return (
    <div
      className='min-h-screen flex flex-col items-center justify-center px-4 py-10'
      style={{
        background: '#020b18',
        color: '#e2e8f0',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Background glows */}
      <div className='fixed inset-0 pointer-events-none' style={{ zIndex: 0 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(16,185,129,0.14) 0%, transparent 65%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 55% 40% at 95% 80%, rgba(59,130,246,0.09) 0%, transparent 55%)',
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
            color: 'rgba(226,232,240,0.5)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          whileHover={{ color: '#e2e8f0' } as any}
        >
          <FiArrowLeft className='h-4 w-4' /> Back
        </motion.button>

        {/* Logo */}
        <motion.div
          variants={fadeUp}
          className='flex items-center gap-2.5 mb-8'
        >
          <div
            className='h-9 w-9 rounded-xl flex items-center justify-center'
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              boxShadow: '0 0 18px rgba(16,185,129,0.45)',
            }}
          >
            <FiTrendingUp
              className='text-white'
              style={{ height: 18, width: 18 }}
            />
          </div>
          <span className='text-lg font-bold tracking-tight text-white'>
            FinTrackly
          </span>
        </motion.div>

        {/* Forgot Password modal */}
        {showForgot ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className='rounded-2xl p-8'
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
            }}
          >
            <h2 className='text-xl font-black text-white mb-1'>
              Reset your password
            </h2>
            <p
              className='text-sm mb-6'
              style={{ color: 'rgba(226,232,240,0.48)' }}
            >
              Enter your email and we'll send a reset link.
            </p>
            <div className='relative mb-4'>
              <span
                className='absolute left-3 top-1/2 -translate-y-1/2'
                style={{
                  color: 'rgba(226,232,240,0.3)',
                  pointerEvents: 'none',
                }}
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
                  (e.target.style.borderColor = 'rgba(16,185,129,0.5)')
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = 'rgba(255,255,255,0.1)')
                }
              />
            </div>
            <div className='flex gap-3'>
              <button
                onClick={() => setShowForgot(false)}
                className='flex-1 py-3 rounded-xl text-sm font-semibold'
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0',
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
                  background: 'linear-gradient(135deg, #10b981, #059669)',
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
          <motion.div
            variants={fadeUp}
            className='rounded-2xl p-8'
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
            }}
          >
            <h1 className='text-2xl font-black text-white mb-1'>
              Welcome back
            </h1>
            <p
              className='text-sm mb-7'
              style={{ color: 'rgba(226,232,240,0.48)' }}
            >
              Sign in to your FinTrackly account
            </p>

            <div className='flex flex-col gap-4'>
              {/* Email */}
              <div>
                <label
                  className='block text-xs font-semibold mb-1.5'
                  style={{ color: 'rgba(226,232,240,0.6)' }}
                >
                  Email Address
                </label>
                <div className='relative'>
                  <span
                    className='absolute left-3 top-1/2 -translate-y-1/2'
                    style={{
                      color: errors.email ? '#f87171' : 'rgba(226,232,240,0.3)',
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
                        ? 'rgba(248,113,113,0.5)'
                        : 'rgba(255,255,255,0.1)',
                    }}
                    onFocus={(e) => {
                      if (!errors.email)
                        e.target.style.borderColor = 'rgba(16,185,129,0.5)';
                    }}
                    onBlur={(e) => {
                      if (!errors.email)
                        e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                    }}
                  />
                </div>
                {errors.email && (
                  <p className='text-xs mt-1' style={{ color: '#f87171' }}>
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className='flex items-center justify-between mb-1.5'>
                  <label
                    className='text-xs font-semibold'
                    style={{ color: 'rgba(226,232,240,0.6)' }}
                  >
                    Password
                  </label>
                  <button
                    onClick={() => {
                      setShowForgot(true);
                      setResetEmail(email);
                    }}
                    className='text-xs font-medium'
                    style={{
                      color: '#10b981',
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
                      color: errors.password
                        ? '#f87171'
                        : 'rgba(226,232,240,0.3)',
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
                        ? 'rgba(248,113,113,0.5)'
                        : 'rgba(255,255,255,0.1)',
                    }}
                    onFocus={(e) => {
                      if (!errors.password)
                        e.target.style.borderColor = 'rgba(16,185,129,0.5)';
                    }}
                    onBlur={(e) => {
                      if (!errors.password)
                        e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                    }}
                  />
                  <button
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='absolute right-3 top-1/2 -translate-y-1/2'
                    style={{
                      color: 'rgba(226,232,240,0.35)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                {errors.password && (
                  <p className='text-xs mt-1' style={{ color: '#f87171' }}>
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
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow:
                    '0 0 28px rgba(16,185,129,0.3), 0 4px 16px rgba(0,0,0,0.3)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  border: 'none',
                }}
                whileHover={
                  !loading
                    ? ({
                        scale: 1.02,
                        boxShadow: '0 0 42px rgba(16,185,129,0.45)',
                      } as any)
                    : {}
                }
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
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'rgba(255,255,255,0.07)',
                }}
              />
              <span
                className='text-xs'
                style={{ color: 'rgba(226,232,240,0.3)' }}
              >
                or
              </span>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'rgba(255,255,255,0.07)',
                }}
              />
            </div>

            <p
              className='text-xs text-center'
              style={{ color: 'rgba(226,232,240,0.35)' }}
            >
              Don't have an account?{' '}
              <button
                onClick={onSwitchToRegister}
                style={{
                  color: '#10b981',
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
