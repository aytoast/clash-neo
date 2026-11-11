/**
 * Browser polyfill shim for running Clash Party UI in a standard web browser (Chrome, Edge, etc.)
 * when not running inside Electron container.
 */

if (typeof window !== 'undefined' && !window.electron) {
  console.info('[BrowserShim] Initializing Electron & IPC polyfill for web browser preview')

  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()

  let mockAlwaysOnTop = false

  const defaultAppConfig = {
    sysProxy: { enable: false },
    autoCloseConnection: true,
    useSubStore: true,
    font: { size: '14px' }
  }

  const defaultMihomoConfig = {
    mode: 'rule',
    tun: { enable: false },
    'mixed-port': 7890
  }

  const defaultProfileConfig = {
    current: 'local-demo',
    items: [
      {
        id: 'local-demo',
        name: 'Demo Profile',
        type: 'local',
        file: 'proxies: []\nproxy-groups: []\nrules: []'
      }
    ]
  }

  const defaultOverrideConfig = { items: [] }

  const defaultLocalConfig = {
    revision: 1,
    draft: {
      sources: [],
      modules: {
        general: 'mode: rule\n',
        proxies: '[]\n',
        'proxy-providers': '{}\n',
        'proxy-groups': '[]\n',
        rules: '[]\n',
        'rule-providers': '{}\n',
        'sub-rules': '{}\n',
        dns: '{}\n',
        hosts: '{}\n',
        tun: '{}\n',
        sniffer: '{}\n'
      }
    },
    published: {
      sources: [],
      modules: {
        general: 'mode: rule\n',
        proxies: '[]\n',
        'proxy-providers': '{}\n',
        'proxy-groups': '[]\n',
        rules: '[]\n',
        'rule-providers': '{}\n',
        'sub-rules': '{}\n',
        dns: '{}\n',
        hosts: '{}\n',
        tun: '{}\n',
        sniffer: '{}\n'
      }
    }
  }

  const mockInvokeHandlers: Record<string, (...args: unknown[]) => unknown> = {
    getPlatform: () => 'win32',
    getVersion: () => 'v2.0.4',
    getAppConfig: () => defaultAppConfig,
    patchAppConfig: (_patch) => defaultAppConfig,
    getControledMihomoConfig: () => defaultMihomoConfig,
    patchControledMihomoConfig: (_patch) => defaultMihomoConfig,
    patchMihomoConfig: (_patch) => undefined,
    getProfileConfig: () => defaultProfileConfig,
    setProfileConfig: (_cfg) => undefined,
    getCurrentProfileItem: () => defaultProfileConfig.items[0],
    getProfileItem: (id) =>
      defaultProfileConfig.items.find((i) => i.id === id) || defaultProfileConfig.items[0],
    getProfileStr: () => 'proxies: []\nproxy-groups: []\nrules: []',
    setProfileStr: () => undefined,
    addProfileItem: (item) => ({
      id: String(Date.now()),
      ...(item && typeof item === 'object' ? (item as Record<string, unknown>) : {})
    }),
    updateProfileItem: () => undefined,
    removeProfileItem: () => undefined,
    changeCurrentProfile: () => undefined,
    getOverrideConfig: () => defaultOverrideConfig,
    setOverrideConfig: () => undefined,
    getLocalConfig: () => defaultLocalConfig,
    getLocalRulesEditor: () => ({
      rules: [
        'DOMAIN-SUFFIX,google.com,PROXY',
        'DOMAIN-KEYWORD,github,PROXY',
        'GEOIP,CN,DIRECT',
        'MATCH,PROXY'
      ],
      ruleProviders: {},
      outbounds: ['DIRECT', 'REJECT', 'PROXY'],
      subRules: []
    }),
    saveLocalRules: () => undefined,
    mihomoVersion: () => ({ version: 'Mihomo v1.19.21' }),
    mihomoRules: () => ({
      rules: [
        { index: 0, type: 'DOMAIN-SUFFIX', payload: 'google.com', proxy: 'PROXY', size: -1 },
        { index: 1, type: 'DOMAIN-KEYWORD', payload: 'github', proxy: 'PROXY', size: -1 },
        { index: 2, type: 'GEOIP', payload: 'CN', proxy: 'DIRECT', size: -1 },
        { index: 3, type: 'MATCH', payload: 'MATCH', proxy: 'PROXY', size: -1 }
      ]
    }),
    mihomoGroups: () => [
      {
        name: 'PROXY',
        type: 'Selector',
        now: 'DIRECT',
        all: [
          { name: 'DIRECT', type: 'Direct' },
          { name: 'REJECT', type: 'Reject' }
        ]
      }
    ],
    mihomoProxies: () => ({
      proxies: {
        DIRECT: { name: 'DIRECT', type: 'Direct', alive: true, history: [] },
        REJECT: { name: 'REJECT', type: 'Reject', alive: true, history: [] }
      }
    }),
    mihomoCloseConnection: () => undefined,
    mihomoCloseAllConnections: () => undefined,
    mihomoGroupDelay: () => ({ DIRECT: 12 }),
    mihomoRulesDisable: () => undefined,
    subStoreSubs: () => [],
    subStoreCollections: () => [],
    subStorePort: () => 0,
    subStoreFrontendPort: () => 0,
    ensureSubStoreServices: () => ({ backendPort: 0, frontendPort: 0 }),
    checkAutoRun: () => false,
    enableAutoRun: () => undefined,
    disableAutoRun: () => undefined,
    showMainWindow: () => undefined,
    triggerMainWindow: () => undefined,
    closeMainWindow: () => undefined,
    checkMihomoCorePermissions: () => true,
    showTunPermissionDialog: () => true,
    showErrorDialog: () => undefined,
    queryTrafficUsageOverview: () => ({ totalUp: 0, totalDown: 0, buckets: [] }),
    queryTrafficUsageBreakdown: () => [],
    fetchIPInfo: async () => ({
      ip: '127.0.0.1',
      country: 'Localhost',
      country_code: 'us',
      city: 'Development',
      isp: 'Dev Environment'
    }),
    getSmartOverrideContent: () => null,
    getPluginConfig: () => ({ items: [] }),
    updatePluginProfile: () => undefined,
    getLocalNode: () => ({}),
    createLocalNodes: () => undefined,
    exportLocalConfig: () => ({ path: '' }),
    previewLocalConfig: () => ({}),
    getFilePath: () => [],
    readTextFile: () => '',
    openFile: () => undefined,
    openDirectory: () => undefined,
    openDevTools: () => undefined,
    quitApp: () => undefined,
    isAlwaysOnTop: () => mockAlwaysOnTop,
    setAlwaysOnTop: (value) => {
      mockAlwaysOnTop = Boolean(value)
    },
    windowMinimize: () => undefined,
    windowMaximize: () => undefined,
    windowClose: () => undefined,
    windowIsMaximized: () => false,
    updateTrayIcon: () => undefined,
    updateTrayIconImmediate: () => undefined
  }

  // Define window.electron
  ;(window as unknown as { electron: unknown }).electron = {
    ipcRenderer: {
      invoke: async (channel: string, ...args: unknown[]) => {
        if (channel in mockInvokeHandlers) {
          return mockInvokeHandlers[channel](...args)
        }
        console.warn(`[BrowserShim] unhandled invoke channel: ${channel}`, args)
        return null
      },
      on: (channel: string, callback: (...args: unknown[]) => void) => {
        if (!listeners.has(channel)) listeners.set(channel, new Set())
        listeners.get(channel)!.add(callback)
        return () => {
          listeners.get(channel)?.delete(callback)
        }
      },
      removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
        listeners.get(channel)?.delete(callback)
      },
      send: (channel: string, ...args: unknown[]) => {
        console.debug(`[BrowserShim] ipcRenderer.send: ${channel}`, args)
      }
    },
    process: {
      platform: 'win32'
    }
  }

  // Define window.api
  ;(window as unknown as { api: unknown }).api = {
    webUtils: {
      getPathForFile: (file: File) => file.name
    }
  }
}
