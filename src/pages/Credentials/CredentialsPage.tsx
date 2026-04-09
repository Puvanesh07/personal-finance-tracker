// src/pages/Credentials/CredentialsPage.tsx

import { FiLock, FiPlus, FiSearch } from 'react-icons/fi';
import { useMemo, useState } from 'react';

import { CredentialCard } from './CredentialCard';
import { UpsertCredentialModal } from './UpsertCredentialModal';
import { usePortfolioStore } from '../../store/portfolioStore';

export function CredentialsPage() {
  const ready = usePortfolioStore((s) => s.ready);
  const credentials = usePortfolioStore((s) => s.credentials);
  const [query, setQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return credentials;
    return credentials.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.identifier && c.identifier.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q)),
    );
  }, [credentials, query]);

  if (!ready) {
    return (
      <div className='p-8 text-center text-slate-500'>
        Loading credentials...
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4 md:gap-6 pb-20 md:pb-8'>
      <header className='flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-fuchsia-500/10 to-slate-900/50 p-4 md:p-6 border border-fuchsia-500/20 shadow-xl'>
        <div className='flex items-center justify-between w-full'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20'>
              <FiLock className='h-5 w-5' />
            </div>
            <div>
              <h1 className='text-xl md:text-2xl font-semibold text-white leading-tight'>
                Credentials
              </h1>
              <p className='text-[11px] md:text-sm text-slate-400 font-medium'>
                Securely store passwords, PAN, UAN, and notes
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className='flex h-10 w-10 md:w-auto md:px-4 items-center justify-center gap-2 rounded-xl bg-fuchsia-500 text-white font-medium shadow-lg shadow-fuchsia-500/20 hover:bg-fuchsia-400 transition-colors'
          >
            <FiPlus className='h-5 w-5' />
            <span className='hidden md:inline'>Add New</span>
          </button>
        </div>
      </header>

      <div className='relative group'>
        <FiSearch className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-fuchsia-500 transition-colors' />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className='w-full rounded-xl border border-slate-800 bg-slate-900/50 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none focus:border-fuchsia-500/50 focus:ring-4 focus:ring-fuchsia-500/10 transition-all'
          placeholder='Search by title, email, or notes...'
        />
      </div>

      {filtered.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 text-slate-500'>
          <FiLock className='h-8 w-8 mb-2 opacity-20' />
          <p className='text-sm font-medium'>No credentials found</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {filtered.map((cred) => (
            <CredentialCard key={cred.id} credential={cred} />
          ))}
        </div>
      )}

      <UpsertCredentialModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        mode='create'
      />
    </div>
  );
}
