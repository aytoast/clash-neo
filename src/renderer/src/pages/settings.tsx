import React, { useState } from 'react'
import { Button } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import { CgWebsite } from 'react-icons/cg'
import { IoLogoGithub } from 'react-icons/io5'
import WebdavConfig from '@renderer/components/settings/webdav-config'
import GeneralConfig from '@renderer/components/settings/general-config'
import MihomoConfig from '@renderer/components/settings/mihomo-config'
import Actions from '@renderer/components/settings/actions'
import ShortcutConfig from '@renderer/components/settings/shortcut-config'
import { FaTelegramPlane } from 'react-icons/fa'
import SiderConfig from '@renderer/components/settings/sider-config'
import SubStoreConfig from '@renderer/components/settings/substore-config'
import LocalBackupConfig from '@renderer/components/settings/local-backup-config'
import { useTranslation } from 'react-i18next'

type SettingsCategory = 'all' | 'general' | 'navigation' | 'engine' | 'backup' | 'system'

interface SettingsProps {
  embedded?: boolean
}

const Settings: React.FC<SettingsProps> = ({ embedded = false }) => {
  const { t } = useTranslation()
  const [category, setCategory] = useState<SettingsCategory>('all')

  const tabs: { key: SettingsCategory; label: string }[] = [
    { key: 'all', label: 'All Settings' },
    { key: 'general', label: 'General & UI' },
    { key: 'navigation', label: 'Navigation' },
    { key: 'engine', label: 'Core & Sub-Store' },
    { key: 'backup', label: 'Backup & Sync' },
    { key: 'system', label: 'Shortcuts & System' }
  ]

  const toolbarHeader = (
    <div className="flex items-center gap-1 app-nodrag">
      <Button
        isIconOnly
        size="sm"
        variant="light"
        title={t('settings.links.docs')}
        className="app-nodrag"
        onPress={() => {
          window.open('https://mihomo.party')
        }}
      >
        <CgWebsite className="text-base" />
      </Button>
      <Button
        isIconOnly
        size="sm"
        variant="light"
        className="app-nodrag"
        title={t('settings.links.github')}
        onPress={() => {
          window.open('https://github.com/mihomo-party-org/mihomo-party')
        }}
      >
        <IoLogoGithub className="text-base" />
      </Button>
      <Button
        isIconOnly
        size="sm"
        variant="light"
        className="app-nodrag"
        title={t('settings.links.telegram')}
        onPress={() => {
          window.open('https://t.me/mihomo_party_group')
        }}
      >
        <FaTelegramPlane className="text-base" />
      </Button>
    </div>
  )

  const bodyContent = (
    <div className="flex flex-col h-full w-full">
      {embedded && (
        <div className="flex items-center justify-end px-3 py-1.5 border-b border-divider bg-background/50">
          {toolbarHeader}
        </div>
      )}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-divider px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setCategory(tab.key)}
            className={`px-3 py-1.5 rounded-[5px] text-sm font-medium whitespace-nowrap transition-colors ${
              category === tab.key
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-default-500 hover:bg-content2 hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-[960px] mx-auto pb-6">
        {(category === 'all' || category === 'general') && <GeneralConfig />}
        {(category === 'all' || category === 'engine') && <SubStoreConfig />}
        {(category === 'all' || category === 'navigation') && <SiderConfig />}
        {(category === 'all' || category === 'backup') && <WebdavConfig />}
        {(category === 'all' || category === 'engine') && <MihomoConfig />}
        {(category === 'all' || category === 'system') && <ShortcutConfig />}
        {(category === 'all' || category === 'backup') && <LocalBackupConfig />}
        {(category === 'all' || category === 'system') && <Actions />}
      </div>
    </div>
  )

  if (embedded) {
    return bodyContent
  }

  return (
    <BasePage title={t('settings.title')} header={toolbarHeader}>
      {bodyContent}
    </BasePage>
  )
}

export default Settings
