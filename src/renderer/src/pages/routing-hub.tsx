import React, { useEffect, useState } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { LuCompass, LuDatabase, LuFileCode } from 'react-icons/lu'
import { useSearchParams } from 'react-router-dom'
import Rules from './rules'
import Resources from './resources'
import Override from './override'

type RoutingMainTab = 'rules' | 'resources' | 'overrides'

const RoutingHub: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const qTab = searchParams.get('tab')

  const [mainTab, setMainTab] = useState<RoutingMainTab>(
    qTab === 'resources' ? 'resources' : qTab === 'overrides' ? 'overrides' : 'rules'
  )

  useEffect(() => {
    const currentQTab = searchParams.get('tab')
    if (currentQTab === 'resources') {
      setMainTab('resources')
    } else if (currentQTab === 'overrides') {
      setMainTab('overrides')
    } else {
      setMainTab('rules')
    }
  }, [searchParams])

  const handleSelectMainTab = (tab: RoutingMainTab): void => {
    setMainTab(tab)
    setSearchParams({ tab }, { replace: true })
  }

  return (
    <BasePage title="Routing">
      <div className="flex flex-col h-full w-full select-none">
        {/* Top Navigation Strip */}
        <div className="px-3 py-2 border-b border-divider bg-background/50 backdrop-blur-sm shrink-0 flex items-center justify-between gap-2">
          {/* Main 2 Pillars: Routing Rules vs Rule Providers */}
          <div className="inline-flex items-center gap-1.5 p-1 rounded-[6px] border border-divider bg-content1">
            <button
              type="button"
              onClick={() => handleSelectMainTab('rules')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-[5px] transition-all ${
                mainTab === 'rules'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-default-500 hover:text-foreground hover:bg-content2/50'
              }`}
            >
              <LuCompass className="text-sm" />
              <span>Routing Rules</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectMainTab('overrides')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-[5px] transition-all ${
                mainTab === 'overrides'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-default-500 hover:text-foreground hover:bg-content2/50'
              }`}
            >
              <LuFileCode className="text-sm" />
              <span>Overrides</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectMainTab('resources')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-[5px] transition-all ${
                mainTab === 'resources'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-default-500 hover:text-foreground hover:bg-content2/50'
              }`}
            >
              <LuDatabase className="text-sm" />
              <span>Rule Providers</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {mainTab === 'rules' && <Rules embedded={true} />}
          {mainTab === 'resources' && <Resources embedded={true} />}
          {mainTab === 'overrides' && <Override embedded={true} />}
        </div>
      </div>
    </BasePage>
  )
}

export default RoutingHub
