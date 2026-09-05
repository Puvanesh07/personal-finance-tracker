// src/components/credentials/UpsertCredentialModal.tsx

import { FiPlus, FiSave } from 'react-icons/fi';
import { useMemo, useState } from 'react';

import type { Credential } from '../../types/investmentTypes';
import { Dropdown } from '../../components/ui/Dropdown';
import { Modal } from '../../components/ui/Modal';
import { usePortfolioStore } from '../../store/portfolioStore';

type Props =
  | {
      open: boolean;
      onClose: () => void;
      mode: 'create';
      credential?: undefined;
    }
  | {
      open: boolean;
      onClose: () => void;
      mode: 'edit';
      credential: Credential;
    };

type FormState = {
  title: string;
  category: Credential['category'];
  identifier: string;
  secret: string;
  notes: string;
};

const CATEGORIES: { id: Credential['category']; label: string }[] = [
  { id: 'login', label: 'Login & Password' },
  { id: 'identity', label: 'Identity (PAN, UAN, Aadhaar)' },
  { id: 'finance', label: 'Financial Data (Cards, Bank details)' },
  { id: 'note', label: 'Secure Note' },
  { id: 'other', label: 'Other' },
];

export function UpsertCredentialModal(props: Props) {
  const addCredential = usePortfolioStore((s) => s.addCredential);
  const updateCredential = usePortfolioStore((s) => s.updateCredential);

  const initial = useMemo<FormState>(() => {
    if (props.mode === 'edit') {
      return {
        title: props.credential.title,
        category: props.credential.category,
        identifier: props.credential.identifier || '',
        secret: props.credential.secret || '',
        notes: props.credential.notes || '',
      };
    }
    return {
      title: '',
      category: 'login',
      identifier: '',
      secret: '',
      notes: '',
    };
  }, [props.mode, props.credential]);

  const [state, setState] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    if (!state.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: state.title.trim(),
        category: state.category,
        identifier: state.identifier.trim() || undefined,
        secret: state.secret || undefined,
        notes: state.notes.trim() || undefined,
      };

      if (props.mode === 'create') await addCredential(payload);
      else await updateCredential(props.credential.id, payload);

      props.onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm outline-none transition-all focus:border-fuchsia-500/50 focus:ring-2 focus:ring-fuchsia-500/20 placeholder:text-slate-500 dark:placeholder:text-slate-500 dark:text-slate-600';
  const labelCls =
    'text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 block ml-1';

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === 'create' ? 'Add Credential' : 'Edit Credential'}
    >
      <div className='flex flex-col gap-4'>
        <div>
          <label className={labelCls}>Category</label>
          <Dropdown
            value={state.category}
            options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
            onChange={(category) => setState((s) => ({ ...s, category }))}
          />
        </div>

        <div>
          <label className={labelCls}>Title</label>
          <input
            className={inputCls}
            value={state.title}
            onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
            placeholder='e.g. Gmail, PAN Card, Wi-Fi'
          />
        </div>

        {(state.category === 'login' ||
          state.category === 'identity' ||
          state.category === 'finance') && (
          <div>
            <label className={labelCls}>
              {state.category === 'identity'
                ? 'ID Number (e.g., PAN/UAN)'
                : 'Username / Email / Identifier'}
            </label>
            <input
              className={inputCls}
              value={state.identifier}
              onChange={(e) =>
                setState((s) => ({ ...s, identifier: e.target.value }))
              }
              placeholder='...'
            />
          </div>
        )}

        {(state.category === 'login' || state.category === 'finance') && (
          <div>
            <label className={labelCls}>Secret / Password / PIN</label>
            <input
              className={inputCls}
              type='password'
              value={state.secret}
              onChange={(e) =>
                setState((s) => ({ ...s, secret: e.target.value }))
              }
              placeholder='••••••••'
            />
          </div>
        )}

        <div>
          <label className={labelCls}>Notes / Extra Information</label>
          <textarea
            className={`${inputCls} min-h-[100px] resize-y`}
            value={state.notes}
            onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            placeholder='Any extra details, recovery codes, etc.'
          />
        </div>

        <div className='mt-4 flex items-center justify-end gap-3 border-t border-slate-200/70 dark:border-slate-800/60 pt-5'>
          <button
            type='button'
            className='rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
            onClick={props.onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type='button'
            className='inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-fuchsia-500 disabled:opacity-60'
            onClick={onSubmit}
            disabled={saving || !state.title.trim()}
          >
            {saving ? (
              <FiSave className='h-4 w-4 animate-pulse' />
            ) : props.mode === 'create' ? (
              <FiPlus className='h-4 w-4' />
            ) : (
              <FiSave className='h-4 w-4' />
            )}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
