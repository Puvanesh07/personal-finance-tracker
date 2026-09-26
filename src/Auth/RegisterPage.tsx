// src/Auth/RegisterPage.tsx
//
// Email/Password registration page.
// Collects: name, phone number, email, password
// On success: creates Firebase Auth user + saves profile to Firestore users/{uid}
// Theme: light lavender, matched to the marketing landing page.

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
import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { buildTrialFields } from '../utils/subscriptionUtils';

import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useState } from 'react';

interface RegisterPageProps {
  onBack: () => void;
  onSwitchToLogin?: () => void;
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
      const trial = buildTrialFields();
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        authProvider: 'email',
        plan: trial.plan,
        subscriptionStatus: trial.subscriptionStatus,
        trialStart: Timestamp.fromDate(trial.trialStart),
        trialEnd: Timestamp.fromDate(trial.trialEnd),
        expiresAt: Timestamp.fromDate(trial.expiresAt),
        gracePeriodEnd: Timestamp.fromDate(trial.gracePeriodEnd),
        paymentId: trial.paymentId,
        premiumGranted: trial.premiumGranted,
      });

      toast.success(`Welcome, ${form.name.split(' ')[0]}! 🎉`, {
        duration: 3000,
        style: {
          background: INK,
          color: '#ffffff',
          border: '1px solid rgba(124,58,237,0.4)',
        },
        iconTheme: { primary: VIOLET, secondary: '#ffffff' },
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
          background: INK,
          color: '#ffffff',
          border: '1px solid rgba(190,24,92,0.4)',
        },
      });
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
            color: BODY,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          whileHover={{ color: VIOLET } as any}
        >
          <FiArrowLeft className='h-4 w-4' />
          Back to sign in
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
            <FiTrendingUp className='text-white h-4.5 w-4.5' />
          </div>
          <span className='text-lg font-bold tracking-tight' style={{ color: INK }}>
            Fin<span style={{ color: VIOLET }}>Trackly</span>
          </span>
        </motion.div>

        {/* Card */}
        <motion.div
          variants={fadeUp}
          className='rounded-2xl p-8'
          style={{
            background: 'rgba(255,255,255,0.82)',
            border: '1px solid rgba(124,58,237,0.16)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 60px rgba(109,40,217,0.16)',
          }}
        >
          <h1 className='text-2xl font-black mb-1' style={{ color: INK }}>
            Create your account
          </h1>
          <p className='text-sm mb-7' style={{ color: BODY }}>
            Start tracking your finances for free
          </p>

          <div className='flex flex-col gap-4'>
            {/* Name, Phone, Email */}
            {fields.map((f) => (
              <div key={f.key}>
                <label
                  className='block text-xs font-semibold mb-1.5'
                  style={{ color: BODY }}
                >
                  {f.label}
                </label>
                <div className='relative'>
                  <span
                    className='absolute left-3 top-1/2 -translate-y-1/2'
                    style={{
                      color: errors[f.key] ? ERR : 'rgba(124,58,237,0.4)',
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
                        ? 'rgba(190,24,92,0.5)'
                        : 'rgba(124,58,237,0.16)',
                    }}
                    onFocus={(e) => {
                      if (!errors[f.key])
                        e.target.style.borderColor = 'rgba(124,58,237,0.5)';
                    }}
                    onBlur={(e) => {
                      if (!errors[f.key])
                        e.target.style.borderColor = 'rgba(124,58,237,0.16)';
                    }}
                  />
                </div>
                {errors[f.key] && (
                  <p className='text-xs mt-1' style={{ color: ERR }}>
                    {errors[f.key]}
                  </p>
                )}
              </div>
            ))}

            {/* Password */}
            <div>
              <label
                className='block text-xs font-semibold mb-1.5'
                style={{ color: BODY }}
              >
                Password
              </label>
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
                  placeholder='Min. 6 characters'
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
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

            {/* Confirm Password */}
            <div>
              <label
                className='block text-xs font-semibold mb-1.5'
                style={{ color: BODY }}
              >
                Confirm Password
              </label>
              <div className='relative'>
                <span
                  className='absolute left-3 top-1/2 -translate-y-1/2'
                  style={{
                    color: errors.confirmPassword ? ERR : 'rgba(124,58,237,0.4)',
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
                      ? 'rgba(190,24,92,0.5)'
                      : 'rgba(124,58,237,0.16)',
                  }}
                  onFocus={(e) => {
                    if (!errors.confirmPassword)
                      e.target.style.borderColor = 'rgba(124,58,237,0.5)';
                  }}
                  onBlur={(e) => {
                    if (!errors.confirmPassword)
                      e.target.style.borderColor = 'rgba(124,58,237,0.16)';
                  }}
                />
                <button
                  type='button'
                  onClick={() => setShowConfirm(!showConfirm)}
                  className='absolute right-3 top-1/2 -translate-y-1/2'
                  style={{
                    color: 'rgba(124,58,237,0.45)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {showConfirm ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className='text-xs mt-1' style={{ color: ERR }}>
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
            <div style={{ flex: 1, height: 1, background: 'rgba(124,58,237,0.14)' }} />
            <span className='text-xs' style={{ color: 'rgba(124,58,237,0.45)' }}>
              or
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(124,58,237,0.14)' }} />
          </div>

          <p className='text-xs text-center' style={{ color: BODY }}>
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin || onBack}
              style={{
                color: VIOLET,
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
          style={{ color: BODY }}
        >
          Your data is stored securely in Firebase. We never share or sell your
          information.
        </motion.p>
      </motion.div>
    </div>
  );
}
