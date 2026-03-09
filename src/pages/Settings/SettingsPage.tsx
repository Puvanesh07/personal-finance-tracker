import { NotionSettings } from '../../components/settings/NotionSettings'
import { DataManagement } from '../../components/settings/DataManagement'
import { EssentialsSettings } from '../../components/settings/EssentialsSettings'

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-600">Local storage, integrations, and preferences.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <NotionSettings />
        <EssentialsSettings />
        <DataManagement />
      </div>
    </div>
  )
}

