// src/components/credentials/CredentialCard.tsx

import {
  FiCopy,
  FiCreditCard,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiLock,
  FiTrash2,
  FiUser,
} from 'react-icons/fi';

import type { Credential } from '../../types/investmentTypes';
import { Modal } from '../../components/ui/Modal';
import { UpsertCredentialModal } from './UpsertCredentialModal';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useState } from 'react';

export function CredentialCard({ credential }: { credential: Credential }) {
  const [showSecret, setShowSecret] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteCredential = usePortfolioStore((s) => s.deleteCredential);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleDelete = async () => {
    await deleteCredential(credential.id);
    setDeleteConfirm(false);
  };

  const getIcon = () => {
    switch (credential.category) {
      case 'identity':
        return <FiUser className='h-5 w-5 text-sky-400' />;
      case 'finance':
        return <FiCreditCard className='h-5 w-5 text-amber-400' />;
      case 'note':
        return <FiFileText className='h-5 w-5 text-emerald-400' />;
      case 'other':
        return <FiFileText className='h-5 w-5 text-slate-400' />;
      case 'login':
      default:
        return <FiLock className='h-5 w-5 text-fuchsia-400' />;
    }
  };

  return (
    <>
      <div className='flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm hover:border-slate-700 transition-colors'>
        <div className='flex items-start justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 border border-slate-700/50'>
              {getIcon()}
            </div>
            <div>
              <h3 className='text-sm font-bold text-slate-100 truncate'>
                {credential.title}
              </h3>
              <p className='text-[10px] font-bold uppercase tracking-widest text-slate-500'>
                {credential.category}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-1'>
            <button
              onClick={() => setIsEditOpen(true)}
              className='p-1.5 text-slate-500 hover:text-white transition-colors'
            >
              <FiEdit2 size={14} />
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className='p-1.5 text-slate-500 hover:text-rose-400 transition-colors'
            >
              <FiTrash2 size={14} />
            </button>
          </div>
        </div>

        <div className='flex flex-col gap-3 flex-1'>
          {credential.identifier && (
            <div className='rounded-xl bg-slate-800/40 border border-slate-700/30 p-3'>
              <p className='text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1'>
                {credential.category === 'identity'
                  ? 'ID Number'
                  : 'Identifier'}
              </p>
              <div className='flex items-center justify-between gap-2'>
                <span className='text-sm font-mono text-slate-200 truncate'>
                  {credential.identifier}
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(credential.identifier!, 'Identifier')
                  }
                  className='text-slate-500 hover:text-emerald-400'
                >
                  <FiCopy size={14} />
                </button>
              </div>
            </div>
          )}

          {credential.secret && (
            <div className='rounded-xl bg-slate-800/40 border border-slate-700/30 p-3'>
              <p className='text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1'>
                Secret / Password
              </p>
              <div className='flex items-center justify-between gap-2'>
                <span className='text-sm font-mono text-slate-200 truncate'>
                  {showSecret ? credential.secret : '••••••••••••'}
                </span>
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className='text-slate-500 hover:text-white'
                  >
                    {showSecret ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                  </button>
                  <button
                    onClick={() =>
                      copyToClipboard(credential.secret!, 'Password')
                    }
                    className='text-slate-500 hover:text-emerald-400'
                  >
                    <FiCopy size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {credential.notes && (
            <div className='mt-2'>
              <p className='text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1'>
                Notes
              </p>
              <p className='text-xs text-slate-400 whitespace-pre-wrap leading-relaxed'>
                {credential.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {isEditOpen && (
        <UpsertCredentialModal
          open={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          mode='edit'
          credential={credential}
        />
      )}

      <Modal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title='Delete Credential?'
      >
        <div className='space-y-4'>
          <p className='text-sm text-slate-400'>
            Are you sure you want to delete{' '}
            <strong className='text-white'>{credential.title}</strong>?
          </p>
          <div className='flex justify-end gap-3 pt-4 border-t border-slate-800'>
            <button
              onClick={() => setDeleteConfirm(false)}
              className='px-4 py-2 text-sm font-bold text-slate-400 hover:text-white'
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className='px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm'
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
