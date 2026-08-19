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

function stripCommas(v: string): string {
  return v.replace(/,/g, '');
}

function formatWithCommas(raw: string): string {
  if (!raw || raw === '' || raw === '-') return raw;
  const [intPart, ...decParts] = raw.split('.');
  const hasDecimal = raw.includes('.');
  let intFormatted = '';
  if (intPart) {
    const isNegative = intPart.startsWith('-');
    const absInt = isNegative ? intPart.slice(1) : intPart;
    let formattedAbs: string;
    if (absInt.length <= 3) {
      formattedAbs = absInt;
    } else {
      const last3 = absInt.slice(-3);
      const rest = absInt.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      formattedAbs = rest + ',' + last3;
    }
    intFormatted = isNegative ? '-' + formattedAbs : formattedAbs;
  }
  return hasDecimal ? `${intFormatted}.${decParts.join('.')}` : intFormatted;
}

function commasBefore(str: string, index: number): number {
  let count = 0;
  for (let i = 0; i < index && i < str.length; i++) {
    if (str[i] === ',') count++;
  }
  return count;
}

function isZeroValue(raw: string): boolean {
  const n = parseFloat(raw);
  return !isNaN(n) && n === 0;
}

function toDisplay(plain: string): string {
  if (isZeroValue(plain) || plain === '' || plain === '0') return '';
  return formatWithCommas(plain);
}

// ── component ──────────────────────────────────────────────────────────────

type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'type' | 'inputMode'
> & {
  value: string;
  onChange: (plain: string) => void;
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
  const [displayValue, setDisplayValue] = useState<string>(() =>
    toDisplay(value),
  );

  useEffect(() => {
    if (!focused) {
      setDisplayValue(toDisplay(value));
    }
  }, [value, focused]);

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(true);
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
    const cursorPos = el.selectionStart ?? rawInput.length;
    const oldCommas = commasBefore(rawInput, cursorPos);

    let plain = stripCommas(rawInput);

    if (allowDecimal) {
      if (!/^-?\d*\.?\d*$/.test(plain)) return;
    } else {
      if (!/^-?\d*$/.test(plain)) return;
    }

    if (/^0\d/.test(plain)) {
      plain = plain.replace(/^0+/, '');
    }

    const hasTrailingDot = plain.endsWith('.');
    const formatted = hasTrailingDot
      ? formatWithCommas(plain.slice(0, -1)) + '.'
      : formatWithCommas(plain);

    setDisplayValue(formatted);

    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      const newCommas = commasBefore(formatted, cursorPos);
      const newPos = Math.max(0, cursorPos + (newCommas - oldCommas));
      inputRef.current.setSelectionRange(newPos, newPos);
    });

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
