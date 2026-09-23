// src/components/ui/Popover.tsx
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';

import { useIsMobile } from '../../hooks/useMediaQuery';
import { useVisualViewport } from '../../hooks/useVisualViewport';

/** Structural ref type so any `useRef<HTMLElement>` flavour is accepted. */
type AnchorRef = { current: HTMLElement | null };

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  /** The trigger element — used for desktop anchoring and outside-click tests. */
  anchorRef: AnchorRef;
  children: ReactNode;
  /** Preferred panel width on desktop; defaults to the anchor's width. */
  width?: number;
  /** Fallback width when the anchor is narrower than this. */
  minWidth?: number;
  /** Max height (px) of the panel; content scrolls beyond it. */
  maxHeight?: number;
  align?: 'left' | 'right';
  /** Optional title rendered in the mobile sheet header. */
  title?: string;
  /** Extra classes for the panel surface. */
  panelClassName?: string;
  /** Extra classes for the scrollable content region. */
  bodyClassName?: string;
  zIndex?: number;
};

/**
 * Responsive popover.
 *
 * Desktop: an anchored, viewport-clamped panel that flips above the trigger when
 * there is no room below, and follows scroll/resize/keyboard changes.
 * Mobile: a bottom sheet sized to the visible viewport so it always sits above
 * the soft keyboard and scrolls internally.
 *
 * Closes on outside tap/click and Escape.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  width,
  minWidth = 200,
  maxHeight = 320,
  align = 'left',
  title,
  panelClassName = '',
  bodyClassName = '',
  zIndex = 120,
}: PopoverProps) {
  const isMobile = useIsMobile();
  const vv = useVisualViewport();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: minWidth });

  // Desktop anchoring — recompute on open, scroll, resize and viewport change.
  useLayoutEffect(() => {
    if (!open || isMobile) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const panelW = width ?? Math.max(Math.round(r.width), minWidth);
      let left = align === 'right' ? r.right - panelW : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
      const panelH = panelRef.current?.offsetHeight ?? maxHeight;
      const spaceBelow = window.innerHeight - r.bottom;
      const placeAbove = spaceBelow < panelH + 12 && r.top > spaceBelow;
      const top = placeAbove ? Math.max(8, r.top - panelH - 8) : r.bottom + 8;
      setPos({ top, left, width: panelW });
    };
    update();
    const raf = requestAnimationFrame(update);
    const vvp = window.visualViewport;
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    vvp?.addEventListener('resize', update);
    vvp?.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      vvp?.removeEventListener('resize', update);
      vvp?.removeEventListener('scroll', update, true);
    };
  }, [open, isMobile, anchorRef, width, minWidth, maxHeight, align]);

  // Close on outside interaction and Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  // Mobile: keep a focused field (e.g. a sheet search box) above the keyboard.
  useEffect(() => {
    if (!open || !isMobile) return;
    const centre = () => {
      const body = bodyRef.current;
      const el = document.activeElement as HTMLElement | null;
      if (!body || !el || !body.contains(el)) return;
      const elRect = el.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const delta =
        elRect.top - bodyRect.top - body.clientHeight / 2 + elRect.height / 2;
      body.scrollTo({ top: body.scrollTop + delta, behavior: 'smooth' });
    };
    const onFocusIn = () => window.setTimeout(centre, 60);
    const panel = panelRef.current;
    panel?.addEventListener('focusin', onFocusIn);
    const t = window.setTimeout(centre, 120);
    return () => {
      panel?.removeEventListener('focusin', onFocusIn);
      window.clearTimeout(t);
    };
  }, [open, isMobile, vv.height]);

  if (!open) return null;

  // ── Mobile: bottom sheet ────────────────────────────────────────────────
  if (isMobile) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          top: vv.offsetTop,
          height: vv.height,
          zIndex,
        }}
        className='flex items-end justify-center bg-slate-900/50 backdrop-blur-sm'
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={panelRef}
          className={`flex max-h-[85%] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 dark:border-slate-700/80 dark:bg-slate-900 ${panelClassName}`}
        >
          <div className='mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700' />
          {title && (
            <div className='flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3'>
              <span className='text-sm font-bold text-slate-900 dark:text-slate-100'>
                {title}
              </span>
              <button
                type='button'
                onClick={onClose}
                className='flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                aria-label='Close'
              >
                <FiX className='h-3.5 w-3.5' />
              </button>
            </div>
          )}
          <div
            ref={bodyRef}
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {children}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ── Desktop: anchored panel ─────────────────────────────────────────────
  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight,
        zIndex,
      }}
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-700/80 dark:bg-slate-900 ${panelClassName}`}
    >
      <div
        ref={bodyRef}
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
