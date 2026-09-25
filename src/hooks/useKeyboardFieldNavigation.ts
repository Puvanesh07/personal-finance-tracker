// src/hooks/useKeyboardFieldNavigation.ts
import { useCallback, useEffect } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';

import { useVisualViewport } from './useVisualViewport';

/** Fields opted into keyboard flow — mark them with `data-field`. */
const FIELD_SELECTOR = 'input[data-field], select[data-field], textarea[data-field]';
const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
/** Breathing room kept between a field and the edge of its scroller. */
const REVEAL_MARGIN_PX = 12;

function isField(node: Element | null): node is HTMLElement {
  return !!node && EDITABLE_TAGS.has(node.tagName);
}

/** Nearest scrollable ancestor inside `root` — the layer we must scroll. */
function scrollableAncestorWithin(field: HTMLElement, root: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = field.parentElement;
  while (el && el !== root.parentElement) {
    const { overflowY } = window.getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Mobile keyboard plumbing for a block of fields.
 *
 * 1. **Next / Done flow** — Enter (and the keyboard's "Next" key) moves focus to
 *    the next `data-field`, and on the last field it calls `onSubmit`, so a user
 *    can fill a whole record without ever leaving the keyboard.
 * 2. **Never hidden behind the keyboard** — browsers do not reliably scroll a
 *    focused control into view when it lives inside a `position: fixed` layer
 *    (which is how the AI Coach shell is pinned), so the focused field is
 *    explicitly revealed inside its own scroll container on focus and again
 *    every time the visual viewport resizes as the keyboard opens.
 */
export function useKeyboardFieldNavigation(
  containerRef: RefObject<HTMLElement | null>,
  onSubmit?: () => void,
): (event: ReactKeyboardEvent) => void {
  const vv = useVisualViewport();

  const revealFocused = useCallback(() => {
    const root = containerRef.current;
    const field = document.activeElement as HTMLElement | null;
    if (!root || !isField(field) || !root.contains(field)) return;
    const scroller = scrollableAncestorWithin(field, root);
    if (!scroller) return;

    const fieldRect = field.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const above = scrollerRect.top + REVEAL_MARGIN_PX - fieldRect.top;
    const below = fieldRect.bottom + REVEAL_MARGIN_PX - scrollerRect.bottom;
    if (above > 0) scroller.scrollTop += above;
    else if (below > 0) scroller.scrollTop += below;
  }, [containerRef]);

  // Re-run whenever the keyboard opens, closes or changes height. iOS reports
  // the resize before the layout settles, so reveal twice.
  useEffect(() => {
    const first = window.setTimeout(revealFocused, 90);
    const second = window.setTimeout(revealFocused, 280);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [vv.height, vv.offsetTop, revealFocused]);

  // Reveal on focus — including taps, where the viewport resize alone may not fire.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onFocusIn = () => window.setTimeout(revealFocused, 90);
    root.addEventListener('focusin', onFocusIn);
    return () => root.removeEventListener('focusin', onFocusIn);
  }, [containerRef, revealFocused]);

  return useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      const field = event.target as HTMLElement;
      if (!isField(field) || !field.dataset.field) return;

      // Enter must never insert a newline or submit an outer <form> here —
      // this handler owns the key.
      event.preventDefault();

      const root = containerRef.current;
      const fields = root
        ? Array.from(root.querySelectorAll<HTMLElement>(FIELD_SELECTOR))
        : [];
      const index = fields.indexOf(field);
      const next = index >= 0 ? fields[index + 1] : undefined;

      if (next) {
        next.focus();
        window.setTimeout(revealFocused, 90);
      } else {
        void onSubmit?.();
      }
    },
    [containerRef, onSubmit, revealFocused],
  );
}

/** Blur the active control — used to dismiss the keyboard once a save succeeds. */
export function dismissKeyboard() {
  const active = document.activeElement as HTMLElement | null;
  active?.blur?.();
}
