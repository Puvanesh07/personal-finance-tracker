import { auth } from '../../services/firebase'
import { signOut } from 'firebase/auth'
import { NotionSettings } from '../../components/settings/NotionSettings'
import { DataManagement } from '../../components/settings/DataManagement'
import { EssentialsSettings } from '../../components/settings/EssentialsSettings'
import { FiSettings, FiLogOut, FiUser, FiMail } from 'react-icons/fi'
import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'

export function SettingsPage() {

  const user = auth.currentUser
  const [logoutOpen, setLogoutOpen] = useState(false)

  const handleSignOut = () => {
    setLogoutOpen(true)
  }

  const confirmLogout = async () => {
    try {
      await signOut(auth)
      setLogoutOpen(false)
    } catch (error) {
      console.error("Error signing out", error)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* Premium Gradient Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-6 border border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:border-emerald-500/30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-lg shadow-slate-500/30 dark:from-slate-700 dark:to-slate-900">
            <FiSettings className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Settings
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
              Manage application data, local storage, and integrations.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">

        {/* User Profile */}
        <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50">

          <div className="flex items-center justify-between">

            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              User Profile
            </h2>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            >
              <FiLogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>

          </div>

          <div className="flex flex-col items-center gap-4 py-4">

            <div className="relative">

              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="h-20 w-20 rounded-full border-4 border-emerald-500/20 object-cover shadow-xl"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <FiUser className="h-10 w-10 text-slate-400" />
                </div>
              )}

              <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900"></div>

            </div>

            <div className="text-center">

              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {user?.displayName || "FinTrackly User"}
              </h3>

              <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <FiMail className="h-3.5 w-3.5" />
                {user?.email || "No email linked"}
              </div>

            </div>

          </div>

          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">

            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Account Security
            </p>

            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Logged in via Google Authentication. Your data is encrypted and tied to your unique User ID:
              <span className="ml-1 font-mono text-emerald-600 dark:text-emerald-400">
                {user?.uid.slice(0, 8)}...
              </span>
            </p>

          </div>

        </div>

        {/* Other Sections */}
        <NotionSettings />
        <EssentialsSettings />
        <DataManagement />

      </div>

      {/* Logout Confirmation Modal */}

      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Confirm Sign Out"
      >

        <div className="space-y-6">

          <p className="text-sm text-slate-500 dark:text-slate-300">
            Are you sure you want to sign out?
          </p>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">

            <button
              onClick={() => setLogoutOpen(false)}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              onClick={confirmLogout}
              className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700"
            >
              Yes, Sign Out
            </button>

          </div>

        </div>

      </Modal>

    </div>
  )
}