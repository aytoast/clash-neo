import React, { useEffect, useState } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { LuFolder, LuLayers, LuBoxes } from 'react-icons/lu'
import { useSearchParams } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { DEFAULT_USE_SUB_STORE } from '../../../shared/appConfig'
import Proxies from './proxies'
import Profiles from './profiles'
import SubStore from './substore'

type ProxiesMainTab = 'nodes' | 'subscriptions'

const ProxiesHub: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { useSubStore = DEFAULT_USE_SUB_STORE } = appConfig || {}
  const [searchParams, setSearchParams] = useSearchParams()
  const qTab = searchParams.get('tab')

  const [mainTab, setMainTab] = useState<ProxiesMainTab>(
    qTab === 'subscriptions' || qTab === 'substore' ? 'subscriptions' : 'nodes'
  )
  const [showSubStoreStudio, setShowSubStoreStudio] = useState(qTab === 'substore')

  useEffect(() => {
    const currentQTab = searchParams.get('tab')
    if (currentQTab === 'nodes' || currentQTab === 'proxies') {
      setMainTab('nodes')
      setShowSubStoreStudio(false)
    } else if (currentQTab === 'subscriptions') {
      setMainTab('subscriptions')
      setShowSubStoreStudio(false)
    } else if (currentQTab === 'substore') {
      setMainTab('subscriptions')
      setShowSubStoreStudio(true)
    }
  }, [searchParams])

  const handleSelectTab = (tab: ProxiesMainTab): void => {
    setMainTab(tab)
    setShowSubStoreStudio(false)
    setSearchParams({ tab }, { replace: true })
  }

  const headerRight = (
    <div className="flex items-center gap-1.5 app-nodrag">
      {mainTab === 'subscriptions' && useSubStore && (
        <button
          type="button"
          onClick={() => setShowSubStoreStudio(!showSubStoreStudio)}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-[5px] border transition-colors ${
            showSubStoreStudio
              ? 'border-primary/40 bg-primary/10 text-primary font-medium'
              : 'border-divider text-default-500 hover:text-foreground hover:bg-content2/50'
          }`}
          title="Advanced Sub-Store Studio for custom scripts and raw pipelines"
        >
          <LuBoxes className="text-xs" />
          <span>{showSubStoreStudio ? 'Back to Subscriptions' : 'Sub-Store Studio'}</span>
        </button>
      )}
    </div>
  )

  return (
    <BasePage title="Proxies" header={headerRight}>
      <div className="flex flex-col h-full w-full select-none">
        {/* Top Navigation Strip */}
        <div className="px-3 py-2 border-b border-divider bg-background/50 backdrop-blur-sm shrink-0 flex items-center justify-between gap-2">
          {/* Main 2 Pillars: Nodes vs Subscriptions */}
          <div className="inline-flex items-center gap-1.5 p-1 rounded-[6px] border border-divider bg-content1">
            <button
              type="button"
              onClick={() => handleSelectTab('nodes')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-[5px] transition-all ${
                mainTab === 'nodes'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-default-500 hover:text-foreground hover:bg-content2/50'
              }`}
            >
              <LuLayers className="text-sm" />
              <span>Nodes & Groups</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab('subscriptions')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-[5px] transition-all ${
                mainTab === 'subscriptions'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-default-500 hover:text-foreground hover:bg-content2/50'
              }`}
            >
              <LuFolder className="text-sm" />
              <span>Subscriptions</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {mainTab === 'nodes' && <Proxies embedded={true} />}
          {mainTab === 'subscriptions' && !showSubStoreStudio && <Profiles embedded={true} />}
          {mainTab === 'subscriptions' && showSubStoreStudio && <SubStore embedded={true} />}
        </div>
      </div>
    </BasePage>
  )
}

export default ProxiesHub
