import { FiX } from 'react-icons/fi';
import { useEffect, useRef, type PropsWithChildren } from 'react';

import { useIsMobile } from '../../hooks/useMediaQuery';
import { useVisualViewport } from '../../hooks/useVisualViewport';

/**
 * App-wide dialog.
 *
 * Mobile: docks to the bottom as a sheet. Desktop: centred card. In both cases
 * the overlay is sized to the *visual* viewport, so when the soft keyboard opens
 * the dialog stays fully visible above it, the body remains scrollable, and the
 * focused field is kept in view.
 */
export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: PropsWithChildren<{
  open: boolean;
  title: string;
  /** One line under the title — what this form is for / what it feeds. */
  subtitle?: string;
  onClose: () => void;
}>) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const vv = useVisualViewport();
  const isMobile = useIsMobile();

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus trap (audit Y5): move focus into the dialog on open and keep Tab
  // cycling within it, so keyboard users can't wander into the hidden page
  // behind the overlay. Focus is restored to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const selector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      Array.from(overlay.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
    // Don't steal focus if the user is already on an element inside the dialog.
    if (!overlay.contains(document.activeElement)) {
      const first = focusables()[0];
      (first ?? overlay).focus({ preventScroll: true });
    }
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !overlay.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    overlay.addEventListener('keydown', onTab);
    return () => {
      overlay.removeEventListener('keydown', onTab);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Keep the active input visible above the keyboard: centre it within the
  // scrollable body on focus and whenever the visual viewport changes.
  useEffect(() => {
    if (!open) return;
    const centre = () => {
      const body = bodyRef.current;
      const el = document.activeElement as HTMLElement | null;
      if (!body || !el || !body.contains(el)) return;
      const tag = el.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !el.isContentEditable)
        return;
      const elRect = el.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const delta =
        elRect.top - bodyRect.top - body.clientHeight / 2 + elRect.height / 2;
      body.scrollTo({ top: body.scrollTop + delta, behavior: 'smooth' });
    };
    const onFocusIn = () => window.setTimeout(centre, 60);
    const overlay = overlayRef.current;
    overlay?.addEventListener('focusin', onFocusIn);
    const t = window.setTimeout(centre, 120);
    return () => {
      overlay?.removeEventListener('focusin', onFocusIn);
      window.clearTimeout(t);
    };
  }, [open, vv.height, vv.offsetTop]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: vv.offsetTop,
        height: vv.height,
      }}
      className={`z-50 flex overflow-hidden bg-slate-900/50 backdrop-blur-sm dark:bg-slate-950/70 ${
        isMobile ? 'items-end justify-center' : 'items-center justify-center p-4'
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role='dialog'
      aria-modal='true'
      aria-label={title}
      tabIndex={-1}
    >
      <div
        className={`flex max-h-[92%] w-full flex-col bg-white shadow-2xl dark:bg-slate-900/95 ${
          isMobile
            ? 'animate-in fade-in slide-in-from-bottom-4 duration-200 rounded-t-2xl border border-slate-300/80 dark:border-slate-700/80'
            : 'animate-in fade-in zoom-in-95 duration-200 max-w-2xl rounded-2xl border border-slate-300/80 dark:border-slate-700/80'
        }`}
      >
        {/* ── Fixed header ── */}
        <header className='flex shrink-0 items-start justify-between gap-3 rounded-t-2xl border-b border-slate-200/70 bg-slate-100/80 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-800/30 sm:px-5 sm:py-4'>
          <div className='min-w-0'>
            <div className='truncate text-base font-bold tracking-tight text-slate-900 dark:text-slate-100'>
              {title}
            </div>
            {subtitle && (
              <p className='mt-0.5 text-xs font-medium leading-snug text-slate-500 dark:text-slate-400 sm:text-[13px]'>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type='button'
            className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition-colors hover:bg-rose-500/20 hover:text-rose-400 dark:bg-slate-800 dark:text-slate-400'
            onClick={onClose}
            title='Close'
            aria-label='Close dialog'
          >
            <FiX className='h-4 w-4' />
          </button>
        </header>

        {/* ── Scrollable body ── */}
        <div
          ref={bodyRef}
          className='min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 text-slate-900 dark:text-slate-100 sm:p-6'
          style={
            isMobile
              ? { paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
