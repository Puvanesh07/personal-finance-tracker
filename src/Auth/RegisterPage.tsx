// src/Auth/RegisterPage.tsx
//
// Email/Password registration page.
// Collects: name, phone number, email, password
// On success: creates Firebase Auth user + saves profile to Firestore users/{uid}

import {
  FiArrowLeft,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiLoader,
  FiLock,
  FiMail,
  FiPhone,
  FiTrendingUp,
  FiUser,
} from 'react-icons/fi';
import { auth, db } from '../services/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ensureAuthPersistence } from './authBootstrap';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useState } from 'react';

interface RegisterPageProps {
  onBack: () => void;
  onSwitchToLogin?: () => void;
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

export default function RegisterPage({
  onBack,
  onSwitchToLogin,
}: RegisterPageProps) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.phone.trim()) {
      e.phone = 'Phone number is required';
    } else if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\s+/g, ''))) {
      e.phone = 'Enter a valid 10-digit Indian mobile number';
    }
    if (!form.email.trim()) {
      e.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Enter a valid email address';
    }
    if (!form.password) {
      e.password = 'Password is required';
    } else if (form.password.length < 6) {
      e.password = 'Password must be at least 6 characters';
    }
    if (!form.confirmPassword) {
      e.confirmPassword = 'Please confirm your password';
    } else if (form.password !== form.confirmPassword) {
      e.confirmPassword = 'Passwords do not match';
    }
    return e;
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      await ensureAuthPersistence();
      const credential = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password,
      );
      const user = credential.user;

      // 2. Update display name in Firebase Auth profile
      await updateProfile(user, { displayName: form.name.trim() });

      // 3. Save full profile to Firestore users/{uid}
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        authProvider: 'email',
      });

      toast.success(`Welcome, ${form.name.split(' ')[0]}! 🎉`, {
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
        error?.code === 'auth/email-already-in-use'
          ? 'This email is already registered. Try signing in.'
          : error?.code === 'auth/invalid-email'
            ? 'Invalid email address.'
            : error?.code === 'auth/weak-password'
              ? 'Password is too weak. Use at least 6 characters.'
              : error?.code === 'auth/network-request-failed'
                ? 'Network error. Check your connection and try again.'
                : 'Registration failed. Please try again.';

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

  const inputBase: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '11px 12px 11px 40px',
    color: '#f8fafc',
    fontSize: 14,
    outline: 'none',
    transition: 'border 0.2s',
  };

  const fields = [
    {
      key: 'name',
      label: 'Full Name',
      placeholder: 'Rajesh Kumar',
      icon: <FiUser />,
      type: 'text',
    },
    {
      key: 'phone',
      label: 'Phone Number',
      placeholder: '9876543210',
      icon: <FiPhone />,
      type: 'tel',
    },
    {
      key: 'email',
      label: 'Email Address',
      placeholder: 'you@example.com',
      icon: <FiMail />,
      type: 'email',
    },
  ];

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
        style={{ maxWidth: 440, zIndex: 1 }}
        initial='hidden'
        animate='show'
        variants={stagger}
      >
        {/* Back button */}
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
          <FiArrowLeft className='h-4 w-4' />
          Back to sign in
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
            <FiTrendingUp className='text-white h-4.5 w-4.5' />
          </div>
          <span className='text-lg font-bold tracking-tight text-white'>
            FinTrackly
          </span>
        </motion.div>

        {/* Card */}
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
            Create your account
          </h1>
          <p
            className='text-sm mb-7'
            style={{ color: 'rgba(226,232,240,0.48)' }}
          >
            Start tracking your finances for free
          </p>

          <div className='flex flex-col gap-4'>
            {/* Name, Phone, Email */}
            {fields.map((f) => (
              <div key={f.key}>
                <label
                  className='block text-xs font-semibold mb-1.5'
                  style={{ color: 'rgba(226,232,240,0.6)' }}
                >
                  {f.label}
                </label>
                <div className='relative'>
                  <span
                    className='absolute left-3 top-1/2 -translate-y-1/2'
                    style={{
                      color: errors[f.key]
                        ? '#f87171'
                        : 'rgba(226,232,240,0.3)',
                      pointerEvents: 'none',
                    }}
                  >
                    {f.icon}
                  </span>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(form as any)[f.key]}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    style={{
                      ...inputBase,
                      borderColor: errors[f.key]
                        ? 'rgba(248,113,113,0.5)'
                        : 'rgba(255,255,255,0.1)',
                    }}
                    onFocus={(e) => {
                      if (!errors[f.key])
                        e.target.style.borderColor = 'rgba(16,185,129,0.5)';
                    }}
                    onBlur={(e) => {
                      if (!errors[f.key])
                        e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                    }}
                  />
                </div>
                {errors[f.key] && (
                  <p className='text-xs mt-1' style={{ color: '#f87171' }}>
                    {errors[f.key]}
                  </p>
                )}
              </div>
            ))}

            {/* Password */}
            <div>
              <label
                className='block text-xs font-semibold mb-1.5'
                style={{ color: 'rgba(226,232,240,0.6)' }}
              >
                Password
              </label>
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
                  placeholder='Min. 6 characters'
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
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

            {/* Confirm Password */}
            <div>
              <label
                className='block text-xs font-semibold mb-1.5'
                style={{ color: 'rgba(226,232,240,0.6)' }}
              >
                Confirm Password
              </label>
              <div className='relative'>
                <span
                  className='absolute left-3 top-1/2 -translate-y-1/2'
                  style={{
                    color: errors.confirmPassword
                      ? '#f87171'
                      : 'rgba(226,232,240,0.3)',
                    pointerEvents: 'none',
                  }}
                >
                  <FiLock />
                </span>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder='Re-enter your password'
                  value={form.confirmPassword}
                  onChange={(e) =>
                    handleChange('confirmPassword', e.target.value)
                  }
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  style={{
                    ...inputBase,
                    paddingRight: 40,
                    borderColor: errors.confirmPassword
                      ? 'rgba(248,113,113,0.5)'
                      : 'rgba(255,255,255,0.1)',
                  }}
                  onFocus={(e) => {
                    if (!errors.confirmPassword)
                      e.target.style.borderColor = 'rgba(16,185,129,0.5)';
                  }}
                  onBlur={(e) => {
                    if (!errors.confirmPassword)
                      e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                />
                <button
                  type='button'
                  onClick={() => setShowConfirm(!showConfirm)}
                  className='absolute right-3 top-1/2 -translate-y-1/2'
                  style={{
                    color: 'rgba(226,232,240,0.35)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {showConfirm ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className='text-xs mt-1' style={{ color: '#f87171' }}>
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              onClick={handleSubmit}
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
                  <FiLoader className='animate-spin' />
                  Creating account…
                </>
              ) : (
                <>
                  Create Account
                  <FiArrowRight />
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
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin || onBack}
              style={{
                color: '#10b981',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Sign in
            </button>
          </p>
        </motion.div>

        {/* Privacy note */}
        <motion.p
          variants={fadeUp}
          className='text-center text-xs mt-5'
          style={{ color: 'rgba(148,163,184,0.4)' }}
        >
          Your data is stored securely in Firebase. We never share or sell your
          information.
        </motion.p>
      </motion.div>
    </div>
  );
}
