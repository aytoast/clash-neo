import { describe, expect, it } from 'vitest'
import { getSiderCardByPath, getInitialSiderRoute } from './sider'

describe('sidebar navigation', () => {
  it.each([
    ['/nodes', '', 'proxy'],
    ['/proxies/nodes', '', 'proxy'],
    ['/proxies', '?tab=subscriptions', 'profile'],
    ['/proxies', '?tab=substore', 'substore'],
    ['/routing', '?tab=overrides', 'override'],
    ['/routing', '?tab=resources', 'resource'],
    ['/telemetry', '?tab=logs', 'log'],
    ['/settings', '?tab=dns', 'dns'],
    ['/override', '', 'override']
  ] as const)('remembers the actual section at %s%s', (path, search, expected) => {
    expect(getSiderCardByPath(path, search)).toBe(expected)
  })

  it('returns to the remembered section when the option is enabled', () => {
    expect(getInitialSiderRoute(true, 'override')).toBe('/override')
    expect(getInitialSiderRoute(false, 'override')).toBe('/dashboard')
  })
})
