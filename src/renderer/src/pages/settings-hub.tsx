import React, { useEffect, useMemo, useState } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { LuSettings, LuCpu, LuNetwork, LuGlobe, LuServer, LuScan, LuSearch } from 'react-icons/lu'
import { Button, Input } from '@heroui/react'
import { IoLogoGithub } from 'react-icons/io5'
import { FaTelegramPlane } from 'react-icons/fa'
import { useSearchParams } from 'react-router-dom'
import SettingsPage from './settings'
import MihomoPage from './mihomo'
import TunPage from './tun'
import SysproxyPage from './sysproxy'
import DnsPage from './dns'
import SnifferPage from './sniffer'

type SettingsTab = 'general' | 'kernel' | 'tun' | 'sysproxy' | 'dns' | 'sniffer'

const TAB_KEYWORDS: Record<SettingsTab, string[]> = {
  general: [
    'general',
    'language',
    'theme',
    'autostart',
    'start',
    'update',
    'substore',
    'font',
    'tray',
    'window',
    'profile'
  ],
  kernel: [
    'kernel',
    'mihomo',
    'port',
    'mixed-port',
    'socks',
    'redir',
    'tproxy',
    'allow-lan',
    'lan',
    'ipv6',
    'log',
    'mode',
    'secret',
    'external',
    'controller',
    'tcp',
    'concurrent'
  ],
  tun: [
    'tun',
    'adapter',
    'stack',
    'gvisor',
    'system',
    'mixed',
    'auto-route',
    'strict-route',
    'mtu',
    'endpoint',
    'dns-hijack'
  ],
  sysproxy: ['sysproxy', 'system proxy', 'pac', 'bypass', 'static', 'loopback', 'lan-bypass'],
  dns: [
    'dns',
    'fake-ip',
    'nameserver',
    'fallback',
    'default-nameserver',
    'doh',
    'dot',
    'enhanced-mode',
    'listen',
    'hosts'
  ],
  sniffer: ['sniffer', 'sniff', 'tls', 'http', 'quic', 'force-domain', 'skip-domain', 'ports']
}

const SettingsHub: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'general'

  const [tab, setTab] = useState<SettingsTab>(
    ['general', 'kernel', 'tun', 'sysproxy', 'dns', 'sniffer'].includes(initialTab)
      ? initialTab
      : 'general'
  )
  const [searchQuery, setSearchQuery] = useState('')

  const tabMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return {}
    const result: Partial<Record<SettingsTab, number>> = {}
    for (const [key, keywords] of Object.entries(TAB_KEYWORDS) as [SettingsTab, string[]][]) {
      const count = keywords.filter((kw) => kw.includes(query) || query.includes(kw)).length
      if (count > 0) result[key] = count
    }
    return result
  }, [searchQuery])

  useEffect(() => {
    const entries = Object.entries(tabMatches) as [SettingsTab, number][]
    if (entries.length > 0) {
      entries.sort((a, b) => b[1] - a[1])
      setTab(entries[0][0])
    }
  }, [tabMatches])

  useEffect(() => {
    const qTab = searchParams.get('tab') as SettingsTab
    if (
      qTab &&
      ['general', 'kernel', 'tun', 'sysproxy', 'dns', 'sniffer'].includes(qTab) &&
      qTab !== tab
    ) {
      setTab(qTab)
    }
  }, [searchParams, tab])

  const handleSelectTab = (newTab: SettingsTab): void => {
    setTab(newTab)
    setSearchParams({ tab: newTab }, { replace: true })
  }

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'general', label: 'General', icon: <LuSettings className="text-xs" /> },
    { key: 'kernel', label: 'Kernel', icon: <LuCpu className="text-xs" /> },
    { key: 'tun', label: 'Tun', icon: <LuNetwork className="text-xs" /> },
    { key: 'sysproxy', label: 'System proxy', icon: <LuGlobe className="text-xs" /> },
    { key: 'dns', label: 'DNS', icon: <LuServer className="text-xs" /> },
    { key: 'sniffer', label: 'Sniffer', icon: <LuScan className="text-xs" /> }
  ]

  const toolbarHeader = (
    <div className="flex items-center gap-1 app-nodrag">
      <Button
        isIconOnly
        size="sm"
        variant="light"
        onPress={() => window.open('https://github.com/mihomo-party-org/clash-party')}
      >
        <IoLogoGithub className="text-lg" />
      </Button>
      <Button
        isIconOnly
        size="sm"
        variant="light"
        onPress={() => window.open('https://t.me/clash_party')}
      >
        <FaTelegramPlane className="text-lg" />
      </Button>
    </div>
  )

  return (
    <BasePage title="Settings" header={toolbarHeader}>
      <div className="flex flex-col h-full w-full">
        {/* Top Sub-nav Tabs & Search Bar */}
        <div className="px-3 pt-2.5 pb-2 border-b border-divider bg-background/50 backdrop-blur-sm shrink-0 flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex items-center gap-1.5 p-1 rounded-[6px] border border-divider bg-content1 overflow-x-auto max-w-full">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleSelectTab(t.key)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-[5px] whitespace-nowrap transition-all ${
                  tab === t.key
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-default-500 hover:text-foreground hover:bg-content2/50'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
                {tabMatches[t.key] && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/20 text-primary font-bold">
                    {tabMatches[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="w-56 shrink-0">
            <Input
              size="sm"
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Search settings..."
              startContent={<LuSearch className="text-default-400 text-xs" />}
              isClearable
              classNames={{
                inputWrapper: 'h-8 bg-content1 border border-divider shadow-none'
              }}
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'general' && <SettingsPage embedded={true} />}
          {tab === 'kernel' && <MihomoPage embedded={true} />}
          {tab === 'tun' && <TunPage embedded={true} />}
          {tab === 'sysproxy' && <SysproxyPage embedded={true} />}
          {tab === 'dns' && <DnsPage embedded={true} />}
          {tab === 'sniffer' && <SnifferPage embedded={true} />}
        </div>
      </div>
    </BasePage>
  )
}

export default SettingsHub
