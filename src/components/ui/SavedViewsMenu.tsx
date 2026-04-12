import { FiChevronDown, FiLayers, FiTrash2 } from 'react-icons/fi';
import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from './Modal';
import { useSavedViewsStore } from '../../store/savedViewsStore';

export function SavedViewsMenu({
  pageId,
  label = 'Saved views',
  getState,
  applyState,
}: {
  pageId: string;
  label?: string;
  getState: () => Record<string, unknown>;
  applyState: (state: Record<string, unknown>) => void;
}) {
  const allViews = useSavedViewsStore((s) => s.views);
  const saveView = useSavedViewsStore((s) => s.saveView);
  const removeView = useSavedViewsStore((s) => s.removeView);

  const views = useMemo(
    () =>
      [...allViews]
        .filter((v) => v.pageId === pageId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [allViews, pageId],
  );

  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 220 });

  const updatePos = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const w = 260;
    let left = r.left;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    setPos({
      top: r.bottom + 6,
      left: Math.max(8, left),
      width: w,
    });
  };

  return (
    <div className='relative inline-flex'>
      <button
        ref={btnRef}
        type='button'
        onClick={() => {
          if (!open) updatePos();
          setOpen((v) => !v);
        }}
        className='inline-flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/50 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors'
      >
        <FiLayers className='h-3.5 w-3.5 text-emerald-500' />
        {label}
        <FiChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <>
            <div
              className='fixed inset-0 z-[120]'
              aria-hidden
              onMouseDown={() => setOpen(false)}
            />
            <div
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: pos.width,
                zIndex: 130,
              }}
              className='rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-xl py-1 max-h-[320px] overflow-y-auto'
            >
              <button
                type='button'
                className='w-full px-3 py-2.5 text-left text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                onClick={() => {
                  setSaveOpen(true);
                  setOpen(false);
                }}
              >
                + Save current as view…
              </button>
              {views.length === 0 ? (
                <div className='px-3 py-4 text-[11px] text-slate-500 text-center'>
                  No saved views yet
                </div>
              ) : (
                views.map((v) => (
                  <div
                    key={v.id}
                    className='flex items-center gap-1 border-t border-slate-100 dark:border-slate-800/80'
                  >
                    <button
                      type='button'
                      className='flex-1 text-left px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 truncate'
                      onClick={() => {
                        applyState(v.state);
                        setOpen(false);
                      }}
                      title={v.name}
                    >
                      {v.name}
                    </button>
                    <button
                      type='button'
                      className='p-2 text-slate-400 hover:text-rose-500'
                      title='Delete view'
                      onClick={() => removeView(v.id)}
                    >
                      <FiTrash2 className='h-3.5 w-3.5' />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>,
          document.body,
        )}

      <Modal
        open={saveOpen}
        onClose={() => {
          setSaveOpen(false);
          setName('');
        }}
        title='Save view'
      >
        <p className='text-sm text-slate-600 dark:text-slate-400 mb-3'>
          Capture the current filters and options for this page. Views are
          stored in this browser only.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='e.g. Zerodha stocks'
          className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30'
          autoFocus
        />
        <div className='flex justify-end gap-2 mt-5 pt-4 border-t border-slate-200 dark:border-slate-800'>
          <button
            type='button'
            onClick={() => {
              setSaveOpen(false);
              setName('');
            }}
            className='rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={() => {
              saveView(pageId, name, getState());
              setSaveOpen(false);
              setName('');
            }}
            className='rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-500'
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}
