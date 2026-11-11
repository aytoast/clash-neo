import { Button, Card, CardBody } from '@heroui/react'
import { mihomoUnfixedProxy } from '@renderer/utils/ipc'
import React, { useMemo, useState, useCallback } from 'react'
import { FaMapPin } from 'react-icons/fa6'
import { useTranslation } from 'react-i18next'
import { KeyedMutator } from 'swr'

interface Props {
  mutateProxies: KeyedMutator<IMihomoMixedGroup[]>
  onProxyDelay: (proxy: IMihomoProxy | IMihomoGroup, url?: string) => Promise<IMihomoDelay>
  proxyDisplayMode: 'simple' | 'full'
  proxy: IMihomoProxy | IMihomoGroup
  group: IMihomoMixedGroup
  onSelect: (group: string, proxy: string) => void
  selected: boolean
  isGroupTesting?: boolean
}

function delayColor(delay: number): 'primary' | 'success' | 'warning' | 'danger' {
  if (delay === -1) return 'primary'
  if (delay === 0) return 'danger'
  if (delay < 300) return 'success'
  return 'warning'
}

const ProxyItemBase: React.FC<Props> = (props) => {
  const { t } = useTranslation()
  const {
    mutateProxies,
    proxyDisplayMode,
    group,
    proxy,
    selected,
    onSelect,
    onProxyDelay,
    isGroupTesting = false
  } = props

  const delay = useMemo(() => {
    if (proxy.history.length > 0) {
      return proxy.history[proxy.history.length - 1].delay
    }
    return -1
  }, [proxy.history])

  const [loading, setLoading] = useState(false)

  const isLoading = loading || isGroupTesting

  const delayText = useMemo(() => {
    if (delay === -1) return t('proxies.delay.test')
    if (delay === 0) return t('proxies.delay.timeout')
    return `${delay} ms`
  }, [delay, t])

  const onDelay = useCallback((): void => {
    setLoading(true)
    onProxyDelay(proxy, group.testUrl).finally(() => {
      mutateProxies()
      setLoading(false)
    })
  }, [proxy, group.testUrl, onProxyDelay, mutateProxies])

  const fixed = useMemo(() => group.fixed && group.fixed === proxy.name, [group.fixed, proxy.name])

  return (
    <Card
      as="div"
      onPress={() => onSelect(group.name, proxy.name)}
      isPressable
      fullWidth
      shadow="none"
      className={`border transition-colors ${
        fixed
          ? 'bg-emerald-500/10 border-emerald-500/50'
          : selected
            ? 'bg-content2 border-foreground/50'
            : 'bg-content1 border-divider hover:bg-content2/60'
      }`}
      radius="sm"
    >
      <CardBody className="px-2.5 py-2">
        {proxyDisplayMode === 'full' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    fixed ? 'bg-emerald-500' : selected ? 'bg-foreground' : 'bg-transparent'
                  }`}
                />
                <div className="text-ellipsis overflow-hidden whitespace-nowrap text-xs font-medium text-foreground">
                  <div className="flag-emoji inline" title={proxy.name}>
                    {proxy.name}
                  </div>
                </div>
              </div>
              {fixed && (
                <Button
                  isIconOnly
                  title={t('proxies.unpin')}
                  color="danger"
                  onPress={async () => {
                    await mihomoUnfixedProxy(group.name)
                    mutateProxies()
                  }}
                  variant="light"
                  className="h-5 w-5 min-w-0 p-0 text-xs"
                >
                  <FaMapPin className="text-xs" />
                </Button>
              )}
            </div>
            <div className="flex justify-between items-center gap-1">
              <div className="flex gap-1 items-center flex-wrap">
                <div className="text-default-500 text-[10px] font-mono bg-content2 border border-divider px-1.5 py-0.2 rounded-[4px]">
                  {proxy.type}
                </div>
                {['tfo', 'udp', 'xudp', 'mptcp', 'smux'].map(
                  (protocol) =>
                    proxy[protocol as keyof IMihomoProxy] && (
                      <div
                        key={protocol}
                        className="text-default-400 text-[10px] font-mono bg-content2 border border-divider px-1 py-0.2 rounded-[4px]"
                      >
                        {protocol}
                      </div>
                    )
                )}
              </div>
              <Button
                isIconOnly
                title={proxy.type}
                isLoading={isLoading}
                color={delayColor(delay)}
                onPress={onDelay}
                variant="light"
                className="h-5 text-[11px] font-mono ml-auto px-1.5 relative w-min min-w-0 whitespace-nowrap"
              >
                <div className="w-full h-full flex items-center justify-end">{delayText}</div>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  fixed ? 'bg-emerald-500' : selected ? 'bg-foreground' : 'bg-transparent'
                }`}
              />
              <div className="text-ellipsis overflow-hidden whitespace-nowrap text-xs font-medium text-foreground">
                <div className="flag-emoji inline" title={proxy.name}>
                  {proxy.name}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end shrink-0">
              {fixed && (
                <Button
                  isIconOnly
                  title={t('proxies.unpin')}
                  color="danger"
                  onPress={async () => {
                    await mihomoUnfixedProxy(group.name)
                    mutateProxies()
                  }}
                  variant="light"
                  className="h-5 w-5 min-w-0 p-0 text-xs"
                >
                  <FaMapPin className="text-xs" />
                </Button>
              )}
              <Button
                isIconOnly
                title={proxy.type}
                isLoading={isLoading}
                color={delayColor(delay)}
                onPress={onDelay}
                variant="light"
                className="h-5 text-[11px] font-mono px-1.5 relative w-min min-w-0 whitespace-nowrap"
              >
                <div className="w-full h-full flex items-center justify-end">{delayText}</div>
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

const ProxyItem = React.memo(ProxyItemBase, (prevProps, nextProps) => {
  return (
    prevProps.proxy.name === nextProps.proxy.name &&
    prevProps.proxy.history === nextProps.proxy.history &&
    prevProps.selected === nextProps.selected &&
    prevProps.proxyDisplayMode === nextProps.proxyDisplayMode &&
    prevProps.group.fixed === nextProps.group.fixed &&
    prevProps.isGroupTesting === nextProps.isGroupTesting
  )
})

ProxyItem.displayName = 'ProxyItem'

export default ProxyItem
