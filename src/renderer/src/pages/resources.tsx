import BasePage from '@renderer/components/base/base-page'
import GeoData from '@renderer/components/resources/geo-data'
import SmartModel from '@renderer/components/resources/smart-model'
import RuleProvider from '@renderer/components/resources/rule-provider'
import ProxyProvider from '@renderer/components/resources/proxy-provider'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useActiveProfile } from '@renderer/hooks/use-active-profile'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import EditModeMenu from '@renderer/components/local/edit-mode-menu'

interface ResourcesProps {
  embedded?: boolean
}

const Resources: React.FC<ResourcesProps> = ({ embedded = false }: ResourcesProps) => {
  const { t } = useTranslation()
  const { appConfig } = useAppConfig()
  const { core = 'mihomo' } = appConfig || {}
  const { isLocalActive: localMode } = useActiveProfile()
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!localMode) setEditing(false)
  }, [localMode])

  const toolbarHeader = localMode ? (
    <EditModeMenu enabled={editing} onChange={setEditing} />
  ) : undefined

  const bodyContent = (
    <div className="flex flex-col h-full w-full">
      {embedded && toolbarHeader && (
        <div className="flex items-center justify-end px-3 py-1.5 border-b border-divider bg-background/50">
          {toolbarHeader}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {core === 'mihomo-smart' && <SmartModel />}
        <GeoData />
        <ProxyProvider editing={localMode && editing} />
        <RuleProvider editing={localMode && editing} />
      </div>
    </div>
  )

  if (embedded) {
    return bodyContent
  }

  return (
    <BasePage title={t('sider.cards.resources')} header={toolbarHeader}>
      {bodyContent}
    </BasePage>
  )
}

export default Resources
