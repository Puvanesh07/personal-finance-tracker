/**
 * NumericInput
 * ─────────────────────────────────────────────────────────────────
 * • Formats with commas WHILE TYPING  (10000 → 10,000 as you type)
 * • When default/stored value is 0 the field shows empty so user
 *   can just start typing without deleting "0" first
 * • Strips commas internally; parent always gets a plain numeric
 *   string like "10000.50" via onChange
 * • Preserves cursor position accurately after re-formatting
 * ─────────────────────────────────────────────────────────────────
 */

import { useRef, useState, useEffect, type InputHTMLAttributes } from 'react';

// ── helpers ────────────────────────────────────────────────────────────────

/** Strip commas */
function stripCommas(v: string): string {
  return v.replace(/,/g, '');
}

/** Format integer part with commas, keep decimal as-is */
function formatWithCommas(raw: string): string {
  if (!raw || raw === '' || raw === '-') return raw;
  const [intPart, ...decParts] = raw.split('.');
  const hasDecimal = raw.includes('.');
  const intFormatted = intPart
    ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : '';
  return hasDecimal ? `${intFormatted}.${decParts.join('.')}` : intFormatted;
}

/** Count commas before a given index in a string */
function commasBefore(str: string, index: number): number {
  let count = 0;
  for (let i = 0; i < index && i < str.length; i++) {
    if (str[i] === ',') count++;
  }
  return count;
}

/** True if the value represents zero */
function isZeroValue(raw: string): boolean {
  const n = parseFloat(raw);
  return !isNaN(n) && n === 0;
}

// ── component ──────────────────────────────────────────────────────────────

type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'type' | 'inputMode'
> & {
  /** Controlled value – plain numeric string ("0", "10000.5", "") from parent state */
  value: string;
  /** Called with a plain numeric string (no commas) */
  onChange: (plain: string) => void;
  /** Allow decimal input (default true) */
  allowDecimal?: boolean;
  className?: string;
};

export function NumericInput({
  value,
  onChange,
  allowDecimal = true,
  className,
  onFocus,
  onBlur,
  ...rest
}: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  /** Convert a stored plain value to a display string */
  function toDisplay(plain: string, isFocused: boolean): string {
    if (isZeroValue(plain) || plain === '' || plain === '0') return '';
    // While focused, still format (with commas) so user sees 10,000 live
    return formatWithCommas(plain);
  }

  const [displayValue, setDisplayValue] = useState<string>(() =>
    toDisplay(value, false),
  );

  // Sync display when external value changes and field not focused
  useEffect(() => {
    if (!focused) {
      setDisplayValue(toDisplay(value, false));
    }
  }, [value, focused]);

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(true);
    // Keep formatted display on focus (don't strip commas)
    onFocus?.(e);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(false);
    const plain = stripCommas(displayValue);

    if (plain === '' || plain === '.') {
      setDisplayValue('');
      onChange('0');
    } else {
      const n = parseFloat(plain);
      if (isNaN(n)) {
        setDisplayValue('');
        onChange('0');
      } else {
        setDisplayValue(formatWithCommas(plain));
        onChange(plain);
      }
    }
    onBlur?.(e);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const rawInput = el.value;

    // Remember cursor position BEFORE formatting
    const cursorPos = el.selectionStart ?? rawInput.length;
    const commasBefore_old = commasBefore(rawInput, cursorPos);

    // Strip commas to get plain value
    let plain = stripCommas(rawInput);

    // Validate: only digits, one decimal, optional leading minus
    if (allowDecimal) {
      if (!/^-?\d*\.?\d*$/.test(plain)) return;
    } else {
      if (!/^-?\d*$/.test(plain)) return;
    }

    // Block multiple leading zeros (e.g. "007")
    if (/^0\d/.test(plain)) {
      plain = plain.replace(/^0+/, '');
    }

    // Format with commas for display
    // Keep trailing dot while typing (e.g. "1000." stays "1,000.")
    const hasTrailingDot = plain.endsWith('.');
    const formatted = hasTrailingDot
      ? formatWithCommas(plain.slice(0, -1)) + '.'
      : formatWithCommas(plain);

    setDisplayValue(formatted);

    // Restore cursor: adjust for change in comma count
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      const commasBefore_new = commasBefore(formatted, cursorPos);
      const delta = commasBefore_new - commasBefore_old;
      const newPos = Math.max(0, cursorPos + delta);
      inputRef.current.setSelectionRange(newPos, newPos);
    });

    // Notify parent with plain numeric string
    const n = parseFloat(plain);
    if (plain === '' || plain === '-' || plain === '.') {
      onChange('0');
    } else {
      onChange(isNaN(n) ? '0' : plain);
    }
  }

  return (
    <input
      {...rest}
      ref={inputRef}
      type='text'
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={displayValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      className={className}
    />
  );
}
