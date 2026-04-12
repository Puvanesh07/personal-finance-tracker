import { Modal } from '../ui/Modal';

const ROWS: { keys: string; action: string }[] = [
  { keys: 'Ctrl / ⌘ + K', action: 'Open command palette (jump to any page)' },
  { keys: '?', action: 'Open this shortcuts reference' },
  { keys: '/ (Investments)', action: 'Focus portfolio search (when not typing elsewhere)' },
  { keys: 'Esc', action: 'Close modals, palette, and menus' },
];

export function KeyboardShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title='Keyboard shortcuts'>
      <p className='text-sm text-slate-600 dark:text-slate-400 mb-4'>
        Shortcuts are disabled while focus is in a text field so you can type
        normally.
      </p>
      <div className='rounded-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden'>
        <table className='w-full text-sm'>
          <thead className='bg-slate-50 dark:bg-slate-800/50 text-left'>
            <tr>
              <th className='px-4 py-2.5 font-bold text-slate-600 dark:text-slate-300'>
                Shortcut
              </th>
              <th className='px-4 py-2.5 font-bold text-slate-600 dark:text-slate-300'>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.action}
                className='border-t border-slate-200/60 dark:border-slate-800/60'
              >
                <td className='px-4 py-2.5 font-mono text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap'>
                  {row.keys}
                </td>
                <td className='px-4 py-2.5 text-slate-700 dark:text-slate-200'>
                  {row.action}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className='mt-4 text-xs text-slate-500 dark:text-slate-400'>
        Saved views and export filename presets sync to this browser (local
        storage).
      </p>
    </Modal>
  );
}
