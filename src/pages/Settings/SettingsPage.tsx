import { NotionSettings } from '../../components/settings/NotionSettings'
import { DataManagement } from '../../components/settings/DataManagement'
import { EssentialsSettings } from '../../components/settings/EssentialsSettings'
import { FiSettings } from 'react-icons/fi'

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <FiSettings className="h-6 w-6 text-emerald-500" />
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Local storage, integrations, and preferences.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <NotionSettings />
        <EssentialsSettings />
        <DataManagement />
      </div>
    </div>
  )
}

