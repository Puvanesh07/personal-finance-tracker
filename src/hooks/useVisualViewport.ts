import { useEffect, useState } from 'react';

export type VisualViewportState = {
  /** Height of the visible viewport — shrinks when the soft keyboard opens. */
  height: number;
  /** Width of the visible viewport. */
  width: number;
  /** Vertical offset of the visual viewport within the layout viewport. */
  offsetTop: number;
  /** Approximate soft-keyboard height in px (0 when closed). */
  keyboardHeight: number;
  /** Heuristic: a soft keyboard is currently open. */
  isKeyboardOpen: boolean;
};

function read(): VisualViewportState {
  const hasWindow = typeof window !== 'undefined';
  const vv = hasWindow ? window.visualViewport : null;
  const layoutHeight = hasWindow ? window.innerHeight : 0;
  const layoutWidth = hasWindow ? window.innerWidth : 0;

  const height = vv?.height ?? layoutHeight;
  const width = vv?.width ?? layoutWidth;
  const offsetTop = vv?.offsetTop ?? 0;
  const keyboardHeight = Math.max(
    0,
    Math.round(layoutHeight - height - offsetTop),
  );

  return {
    height: Math.round(height),
    width: Math.round(width),
    offsetTop: Math.round(offsetTop),
    keyboardHeight,
    isKeyboardOpen: keyboardHeight > 120,
  };
}

/**
 * Tracks the browser VisualViewport so overlays (modals, sheets, popovers) can
 * size and position themselves within the *visible* area and stay above the
 * soft keyboard. Falls back to `window.innerHeight` where the API is missing.
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(read);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const update = () => setState(read());
    update();

    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return state;
}
