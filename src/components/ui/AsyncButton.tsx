import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { ButtonSpinner } from './ButtonSpinner';

type AsyncButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  loadingLabel?: ReactNode;
  spinnerClassName?: string;
};

/** Button that disables and shows a spinner while an async action is in flight. */
export function AsyncButton({
  busy = false,
  loadingLabel,
  spinnerClassName,
  children,
  disabled,
  className = '',
  type = 'button',
  ...props
}: AsyncButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none ${className}`}
      {...props}
    >
      {busy && <ButtonSpinner className={spinnerClassName} />}
      <span>{busy && loadingLabel !== undefined ? loadingLabel : children}</span>
    </button>
  );
}
