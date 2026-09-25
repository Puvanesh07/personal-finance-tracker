// src/hooks/useViewportPinnedShell.ts
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';

import { useIsMobile } from './useMediaQuery';
import { useVisualViewport } from './useVisualViewport';

/**
 * Everything the app renders above the page content (sticky top bar, trial
 * banner). A pinned shell starts below the lowest of them — `#app-top-bar` is
 * tagged by AppLayout, banners opt in with `data-shell-top-offset`.
 */
const TOP_INSET_SELECTORS = ['#app-top-bar', '[data-shell-top-offset]'];
const TOP_INSET_FALLBACK_PX = 52;

/**
 * Bottom clearance while no keyboard is up: the floating nav button is fixed at
 * `bottom-6` and is 54px tall, so the shell must stop above it.
 */
const REST_BOTTOM_PX = 88;
/** The soft keyboard hides that button, so almost no clearance is needed. */
const KEYBOARD_BOTTOM_PX = 8;
/** Never let a short viewport (landscape phone) collapse the shell. */
const MIN_SHELL_PX = 200;
/**
 * A phone held sideways is wider than the mobile breakpoint but very short, and
 * its keyboard eats half the screen — treat anything under this height (on a
 * small window) as a phone too, otherwise the keyboard covers the input bar.
 */
const SHORT_VIEWPORT_PX = 600;
const SMALL_WINDOW_PX = 1024;

function scrollParentOf(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null;
  while (el) {
    const { overflowY } = window.getComputedStyle(el);
    if (overflowY === 'auto' || overflowY === 'scroll') return el;
    el = el.parentElement;
  }
  return null;
}

export type PinnedShell = {
  shellRef: RefObject<HTMLDivElement | null>;
  /** True while the shell is lifted out of the document flow. */
  pinned: boolean;
  /** Inline style for the shell element itself. */
  shellStyle: CSSProperties;
  /** Height the in-flow wrapper must reserve so the page never jumps. */
  reservedHeight: number;
  /** Height available to a non-pinned (tablet/desktop) shell. */
  flowHeight: number;
  /**
   * Current visual-viewport height. Changes the moment the keyboard opens —
   * subscribe to it when something must be re-measured or re-scrolled after the
   * shell has been resized (e.g. keeping the newest chat message in view).
   */
  visibleHeight: number;
};

/**
 * Keeps a full-height shell (chat thread, data-entry panel) pinned to the
 * *visual* viewport on phones, so the soft keyboard can never cover its input
 * bar or its Save/Submit buttons.
 *
 * `100dvh` does not shrink when the keyboard opens on iOS, and a shell sized
 * from it can still be scrolled so that its bottom sits behind the keyboard.
 * Sizing off `window.visualViewport` (same approach as `Modal`) is the only
 * reliable answer: the shell is `position: fixed`, starts below the app top bar
 * and always ends exactly at the keyboard. A same-height spacer keeps the page's
 * scroll length stable, and the page scroller is locked so the pinned layer is
 * never scrolled away from or overlapped by unrelated content.
 *
 * @param active disable pinning (e.g. while a modal owns the viewport)
 */
export function useViewportPinnedShell(active = true): PinnedShell {
  const vv = useVisualViewport();
  const isMobile = useIsMobile();
  const shellRef = useRef<HTMLDivElement>(null);
  const [topInset, setTopInset] = useState(TOP_INSET_FALLBACK_PX);
  const [layoutHeight, setLayoutHeight] = useState(() => window.innerHeight);

  // Measured, not hard-coded: the chrome above the page depends on what is
  // rendered (trial banner or not), and guessing slides the shell header under it.
  useEffect(() => {
    const measure = () => {
      // Use the *bottom edge*, not the height: the page wrapper has padding and
      // the banner sits inside it, so summing heights would slide the shell over
      // the banner. Invisible elements (empty slots) contribute nothing.
      let inset = 0;
      for (const selector of TOP_INSET_SELECTORS) {
        for (const el of Array.from(document.querySelectorAll(selector))) {
          const rect = (el as HTMLElement).getBoundingClientRect();
          if (rect.height > 0 && rect.bottom > inset) inset = rect.bottom;
        }
      }
      if (inset > 0) setTopInset(Math.round(inset));
      // Layout viewport ignores the soft keyboard, so this stays constant while
      // it is open — that is what makes the reserved spacer height stable.
      setLayoutHeight(window.innerHeight);
    };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    // A banner appearing after the data has loaded changes the inset without any
    // window resize, so watch the page subtree too.
    const host = scrollParentOf(shellRef.current);
    let observer: MutationObserver | null = null;
    if (host) {
      observer = new MutationObserver(schedule);
      observer.observe(host, { childList: true, subtree: true });
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      observer?.disconnect();
    };
  }, []);

  const isPhoneSurface = isMobile
    || (vv.height < SHORT_VIEWPORT_PX && vv.width < SMALL_WINDOW_PX);
  const pinned = active && isPhoneSurface;
  const bottomInset = vv.isKeyboardOpen ? KEYBOARD_BOTTOM_PX : REST_BOTTOM_PX;
  const pinnedHeight = Math.max(
    MIN_SHELL_PX,
    Math.round(vv.height - topInset - bottomInset),
  );
  // Height the spacer holds while the shell is lifted out of the flow. It is
  // derived from the *layout* viewport on purpose: if it tracked the keyboard
  // the document would grow and shrink every time the keyboard opens or closes,
  // which reads as the page jumping under the user.
  const reservedHeight = Math.max(
    MIN_SHELL_PX,
    Math.round(layoutHeight - topInset - REST_BOTTOM_PX),
  );
  const flowHeight = Math.max(
    360,
    Math.round(vv.height - topInset - 120),
  );

  // While pinned the shell covers the page, so the page itself must not scroll
  // (otherwise the footer slides underneath the layer and nothing is reachable).
  useEffect(() => {
    if (!pinned) return;
    const scroller = scrollParentOf(shellRef.current);
    if (!scroller) return;
    const previous = scroller.style.overflowY;
    scroller.style.overflowY = 'hidden';
    return () => {
      scroller.style.overflowY = previous;
    };
  }, [pinned]);

  return {
    shellRef,
    pinned,
    reservedHeight: pinned ? reservedHeight : 0,
    flowHeight,
    visibleHeight: Math.round(vv.height),
    shellStyle: pinned
      ? {
          position: 'fixed',
          top: vv.offsetTop + topInset,
          left: 0,
          right: 0,
          height: pinnedHeight,
          marginInline: 'auto',
          paddingInline: 12,
          zIndex: 40,
        }
      : { height: flowHeight },
  };
}
