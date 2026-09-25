import { FiAlertTriangle, FiHome, FiRotateCw } from 'react-icons/fi';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';

/**
 * Route-level error screen (audit I6). Without this, a lazy chunk that fails to
 * download (offline, or right after a redeploy when old hashes are gone) or any
 * unexpected render throw produced a white screen that looked like a crash.
 * React Router renders this for the whole authenticated subtree, so a slow or
 * broken read now degrades to a friendly, recoverable message.
 */
export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();

  const isChunkError =
    error instanceof Error &&
    /dynamically import|loading css chunk|loading chunk|failed to fetch|networkerror/i.test(
      error.message,
    );

  const title = isChunkError ? "This section didn’t load" : 'Something went wrong';
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.';

  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center'>
      <span className='flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 text-rose-500'>
        <FiAlertTriangle className='h-8 w-8' />
      </span>
      <h1 className='mt-5 text-xl font-black text-slate-900 dark:text-white'>{title}</h1>
      <p className='mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-400'>
        {isChunkError
          ? 'Your connection may have dropped, or the app was just updated. Reload to get the latest version.'
          : detail}
      </p>
      <div className='mt-6 flex flex-wrap items-center justify-center gap-3'>
        <button
          type='button'
          onClick={() => window.location.reload()}
          className='flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500'
        >
          <FiRotateCw className='h-4 w-4' />
          Reload
        </button>
        <button
          type='button'
          onClick={() => navigate('/dashboard', { replace: true })}
          className='flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
        >
          <FiHome className='h-4 w-4' />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
