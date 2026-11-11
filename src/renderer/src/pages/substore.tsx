import { Button } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  ensureSubStoreServices,
  subStoreFrontendPort,
  subStorePort,
  startSubStoreFrontendServer,
  startSubStoreBackendServer,
  stopSubStoreFrontendServer,
  stopSubStoreBackendServer,
  downloadSubStore
} from '@renderer/utils/ipc'
import React, { useEffect, useState } from 'react'
import { HiExternalLink } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'
import { IoMdCloudDownload } from 'react-icons/io'

interface SubStoreProps {
  embedded?: boolean
}

const SubStore: React.FC<SubStoreProps> = ({ embedded = false }) => {
  const { t } = useTranslation()
  const { appConfig } = useAppConfig()
  const { useCustomSubStore, customSubStoreUrl } = appConfig || {}
  const [backendPort, setBackendPort] = useState<number | undefined>()
  const [frontendPort, setFrontendPort] = useState<number | undefined>()
  const [isUpdating, setIsUpdating] = useState(false)
  const getPort = async (ensureStarted = true): Promise<void> => {
    if (ensureStarted) {
      const ports = await ensureSubStoreServices()
      setBackendPort(ports.backendPort)
      setFrontendPort(ports.frontendPort)
      return
    }
    setBackendPort(await subStorePort())
    setFrontendPort(await subStoreFrontendPort())
  }
  useEffect(() => {
    void getPort().catch((error) => {
      new Notification(`${t('substore.updateFailed')}: ${error}`)
    })
  }, [t, useCustomSubStore])

  if (!useCustomSubStore && !backendPort) return null
  if (!frontendPort) return null

  const toolbarButtons = (
    <div className="flex items-center gap-1 app-nodrag">
      <Button
        title={t('substore.checkUpdate')}
        isIconOnly
        size="sm"
        className="app-nodrag"
        variant="light"
        isLoading={isUpdating}
        onPress={async () => {
          try {
            new Notification(t('substore.updating'))
            setIsUpdating(true)
            await downloadSubStore()
            await stopSubStoreBackendServer()
            await startSubStoreBackendServer()
            await new Promise((resolve) => setTimeout(resolve, 1000))
            setFrontendPort(0)
            await stopSubStoreFrontendServer()
            await startSubStoreFrontendServer()
            await getPort(false)
            new Notification(t('substore.updateCompleted'))
          } catch (e) {
            new Notification(`${t('substore.updateFailed')}: ${e}`)
          } finally {
            setIsUpdating(false)
          }
        }}
      >
        <IoMdCloudDownload className="text-lg" />
      </Button>

      <Button
        title={t('substore.openInBrowser')}
        isIconOnly
        size="sm"
        className="app-nodrag"
        variant="light"
        onPress={() => {
          open(
            `http://127.0.0.1:${frontendPort}?api=${useCustomSubStore ? customSubStoreUrl : `http://127.0.0.1:${backendPort}`}`
          )
        }}
      >
        <HiExternalLink className="text-lg" />
      </Button>
    </div>
  )

  const bodyContent = (
    <div className="flex flex-col h-full w-full">
      {embedded && (
        <div className="flex items-center justify-end px-3 py-1.5 border-b border-divider bg-background/50">
          {toolbarButtons}
        </div>
      )}
      <iframe
        className="w-full flex-1 min-h-[460px]"
        allow="clipboard-write; clipboard-read"
        src={`http://127.0.0.1:${frontendPort}?api=${useCustomSubStore ? customSubStoreUrl : `http://127.0.0.1:${backendPort}`}`}
      />
    </div>
  )

  if (embedded) {
    return bodyContent
  }

  return (
    <BasePage title={t('substore.title')} header={toolbarButtons}>
      {bodyContent}
    </BasePage>
  )
}

export default SubStore
