// src/Auth/GoogleProfileModal.tsx
//
// Shown after Google sign-in when the user's Firestore profile is missing.
// Pre-fills name & email from Google. Only asks for phone number.
// Saves { uid, name, email, phone, createdAt, updatedAt, authProvider } to users/{uid}.

import {
  FiArrowRight,
  FiCheck,
  FiLoader,
  FiMail,
  FiPhone,
  FiTrendingUp,
  FiUser,
} from 'react-icons/fi';
import { auth, db } from '../services/firebase';
import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { buildTrialFields } from '../utils/subscriptionUtils';

import { FcGoogle } from 'react-icons/fc';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useState } from 'react';

interface GoogleProfileModalProps {
  onComplete: () => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function GoogleProfileModal({
  onComplete,
}: GoogleProfileModalProps) {
  const user = auth.currentUser!;
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const cleaned = phone.replace(/\s+/g, '');
    if (!cleaned) {
      setPhoneError('Phone number is required');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      setPhoneError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setPhoneError('');
    setLoading(true);

    try {
      const trial = buildTrialFields();
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: user.displayName || '',
        email: user.email || '',
        phone: cleaned,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        authProvider: 'google',
        plan: trial.plan,
        subscriptionStatus: trial.subscriptionStatus,
        trialStart: Timestamp.fromDate(trial.trialStart),
        trialEnd: Timestamp.fromDate(trial.trialEnd),
        expiresAt: Timestamp.fromDate(trial.expiresAt),
        gracePeriodEnd: Timestamp.fromDate(trial.gracePeriodEnd),
        paymentId: trial.paymentId,
        premiumGranted: trial.premiumGranted,
      });

      toast.success('Profile saved! Welcome to FinTrackly 🎉', {
        duration: 3000,
        style: {
          background: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(16,185,129,0.4)',
        },
        iconTheme: { primary: '#10b981', secondary: '#f8fafc' },
      });

      onComplete();
    } catch {
      setLoading(false);
      toast.error('Could not save profile. Please try again.', {
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
  };

  const readonlyInput: React.CSSProperties = {
    ...inputBase,
    background: 'rgba(255,255,255,0.02)',
    color: 'rgba(226,232,240,0.45)',
    cursor: 'not-allowed',
  };

  return (
    // Full-screen overlay
    <div
      className='fixed inset-0 flex items-center justify-center px-4'
      style={{
        background: 'rgba(2,11,24,0.92)',
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
      }}
    >
      <motion.div
        className='w-full'
        style={{ maxWidth: 440 }}
        initial='hidden'
        animate='show'
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08 } },
        }}
      >
        {/* Logo */}
        <motion.div
          variants={fadeUp}
          className='flex items-center gap-2.5 mb-7 justify-center'
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

        {/* Card */}
        <motion.div
          variants={fadeUp}
          className='rounded-2xl p-8'
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          }}
        >
          {/* Header */}
          <div className='flex items-center gap-3 mb-2'>
            <div
              className='h-10 w-10 rounded-xl flex items-center justify-center'
              style={{
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.25)',
              }}
            >
              <FcGoogle style={{ fontSize: 22 }} />
            </div>
            <div>
              <h1 className='text-xl font-black text-white leading-tight'>
                One last step!
              </h1>
              <p
                className='text-xs'
                style={{ color: 'rgba(226,232,240,0.45)' }}
              >
                Complete your profile to continue
              </p>
            </div>
          </div>

          {/* Progress dots */}
          <div className='flex items-center gap-2 my-5'>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className='rounded-full'
                style={{
                  height: 6,
                  width: i === 0 ? 20 : 8,
                  background: i === 2 ? 'rgba(255,255,255,0.12)' : '#10b981',
                  transition: 'all 0.3s',
                }}
              />
            ))}
            <span
              className='text-xs ml-1'
              style={{ color: 'rgba(226,232,240,0.35)' }}
            >
              Step 3 of 3
            </span>
          </div>

          <div className='flex flex-col gap-4'>
            {/* Name — pre-filled from Google, read-only */}
            <div>
              <label
                className='block text-xs font-semibold mb-1.5'
                style={{ color: 'rgba(226,232,240,0.6)' }}
              >
                Full Name
                <span
                  className='ml-2 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full'
                  style={{
                    background: 'rgba(16,185,129,0.12)',
                    color: '#10b981',
                    border: '1px solid rgba(16,185,129,0.25)',
                  }}
                >
                  <FiCheck style={{ height: 10 }} /> From Google
                </span>
              </label>
              <div className='relative'>
                <span
                  className='absolute left-3 top-1/2 -translate-y-1/2'
                  style={{
                    color: 'rgba(226,232,240,0.2)',
                    pointerEvents: 'none',
                  }}
                >
                  <FiUser />
                </span>
                <input
                  type='text'
                  value={user.displayName || ''}
                  readOnly
                  style={readonlyInput}
                />
              </div>
            </div>

            {/* Email — pre-filled from Google, read-only */}
            <div>
              <label
                className='block text-xs font-semibold mb-1.5'
                style={{ color: 'rgba(226,232,240,0.6)' }}
              >
                Email Address
                <span
                  className='ml-2 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full'
                  style={{
                    background: 'rgba(16,185,129,0.12)',
                    color: '#10b981',
                    border: '1px solid rgba(16,185,129,0.25)',
                  }}
                >
                  <FiCheck style={{ height: 10 }} /> From Google
                </span>
              </label>
              <div className='relative'>
                <span
                  className='absolute left-3 top-1/2 -translate-y-1/2'
                  style={{
                    color: 'rgba(226,232,240,0.2)',
                    pointerEvents: 'none',
                  }}
                >
                  <FiMail />
                </span>
                <input
                  type='email'
                  value={user.email || ''}
                  readOnly
                  style={readonlyInput}
                />
              </div>
            </div>

            {/* Phone — user must enter */}
            <div>
              <label
                className='block text-xs font-semibold mb-1.5'
                style={{ color: 'rgba(226,232,240,0.6)' }}
              >
                Phone Number
                <span
                  className='ml-2 text-[10px] font-medium'
                  style={{ color: 'rgba(248,113,113,0.8)' }}
                >
                  * Required
                </span>
              </label>
              <div className='relative'>
                <span
                  className='absolute left-3 top-1/2 -translate-y-1/2'
                  style={{
                    color: phoneError ? '#f87171' : 'rgba(226,232,240,0.3)',
                    pointerEvents: 'none',
                  }}
                >
                  <FiPhone />
                </span>
                <input
                  type='tel'
                  placeholder='9876543210'
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneError) setPhoneError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                  style={{
                    ...inputBase,
                    borderColor: phoneError
                      ? 'rgba(248,113,113,0.5)'
                      : 'rgba(255,255,255,0.1)',
                  }}
                  onFocus={(e) => {
                    if (!phoneError)
                      e.target.style.borderColor = 'rgba(16,185,129,0.5)';
                  }}
                  onBlur={(e) => {
                    if (!phoneError)
                      e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                />
              </div>
              {phoneError && (
                <p className='text-xs mt-1' style={{ color: '#f87171' }}>
                  {phoneError}
                </p>
              )}
            </div>

            {/* Submit */}
            <motion.button
              onClick={handleSave}
              disabled={loading}
              className='flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl font-bold text-sm text-white mt-1 disabled:opacity-60'
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
                  <FiLoader className='animate-spin' /> Saving…
                </>
              ) : (
                <>
                  Complete Setup <FiArrowRight />
                </>
              )}
            </motion.button>
          </div>

          <p
            className='text-xs text-center mt-5'
            style={{ color: 'rgba(226,232,240,0.25)' }}
          >
            Your phone number is stored securely and never shared.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
