import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { RiPushpin2Fill, RiPushpin2Line } from 'react-icons/ri'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import {
  isAlwaysOnTop,
  setAlwaysOnTop,
  windowMinimize,
  windowMaximize,
  windowClose,
  windowIsMaximized
} from '@renderer/utils/ipc'
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

interface Props {
  title?: React.ReactNode
  header?: React.ReactNode
  children?: React.ReactNode
  contentClassName?: string
}

const BasePage = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { t } = useTranslation()
  const { appConfig } = useAppConfig()
  const { useWindowFrame = false } = appConfig || {}

  const [isMax, setIsMax] = useState(false)
  const [onTop, setOnTop] = useState(false)

  useEffect(() => {
    void isAlwaysOnTop().then(setOnTop)
  }, [])
  const showCustomCaption = !useWindowFrame && platform !== 'darwin'

  useEffect(() => {
    if (!showCustomCaption) return
    void windowIsMaximized().then(setIsMax)
    const unsub = window.electron.ipcRenderer.on('windowMaximizedState', (_e, state) => {
      setIsMax(Boolean(state))
    })
    return () => unsub()
  }, [showCustomCaption])

  const contentRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => {
    return contentRef.current as HTMLDivElement
  })

  return (
    <div ref={contentRef} className="w-full h-full bg-background select-none">
      <div
        className="sticky top-0 z-40 h-9 w-full bg-background/95 backdrop-blur-sm border-b border-divider"
        onDoubleClick={() => {
          if (showCustomCaption) void windowMaximize()
        }}
      >
        <div className="app-drag pl-3.5 pr-0 flex items-center justify-between h-9 gap-2">
          <div className="title min-w-0 truncate whitespace-nowrap text-sm font-semibold tracking-tight text-foreground leading-9">
            {props.title}
          </div>

          <div className="header flex items-center gap-1.5 h-full shrink-0">
            {props.header}
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="app-nodrag"
              title={t('common.pinWindow')}
              aria-label={t('common.pinWindow')}
              color={onTop ? 'primary' : 'default'}
              onPress={async () => {
                await setAlwaysOnTop(!onTop)
                setOnTop(await isAlwaysOnTop())
              }}
            >
              {onTop ? <RiPushpin2Fill /> : <RiPushpin2Line />}
            </Button>

            {/* Chrome/Windows 11 Style Title Bar Caption Controls */}
            {showCustomCaption && (
              <>
                {props.header && <div className="w-[1px] h-3.5 bg-divider/60 mx-1 shrink-0" />}
                <div className="flex items-center h-full">
                  {/* Minimize */}
                  <button
                    type="button"
                    onClick={() => void windowMinimize()}
                    className="app-nodrag h-full w-[46px] flex items-center justify-center text-default-500 hover:text-foreground hover:bg-default-200/50 active:bg-default-300/60 transition-colors"
                    title="Minimize"
                    aria-label="Minimize"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <line
                        x1="0"
                        y1="5"
                        x2="10"
                        y2="5"
                        stroke="currentColor"
                        strokeWidth="1"
                        shapeRendering="crispEdges"
                      />
                    </svg>
                  </button>

                  {/* Maximize / Restore */}
                  <button
                    type="button"
                    onClick={() => void windowMaximize()}
                    className="app-nodrag h-full w-[46px] flex items-center justify-center text-default-500 hover:text-foreground hover:bg-default-200/50 active:bg-default-300/60 transition-colors"
                    title={isMax ? 'Restore' : 'Maximize'}
                    aria-label={isMax ? 'Restore' : 'Maximize'}
                  >
                    {isMax ? (
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <path
                          d="M2.5 2.5V0.5H9.5V7.5H7.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          shapeRendering="crispEdges"
                        />
                        <rect
                          x="0.5"
                          y="2.5"
                          width="7"
                          height="7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          shapeRendering="crispEdges"
                        />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <rect
                          x="0.5"
                          y="0.5"
                          width="9"
                          height="9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          shapeRendering="crispEdges"
                        />
                      </svg>
                    )}
                  </button>

                  {/* Close */}
                  <button
                    type="button"
                    onClick={() => void windowClose()}
                    className="app-nodrag h-full w-[46px] flex items-center justify-center text-default-500 hover:text-white hover:bg-[#e81123] active:bg-[#c42b1c] active:text-white transition-colors"
                    title="Close"
                    aria-label="Close"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <line
                        x1="0.5"
                        y1="0.5"
                        x2="9.5"
                        y2="9.5"
                        stroke="currentColor"
                        strokeWidth="1"
                      />
                      <line
                        x1="9.5"
                        y1="0.5"
                        x2="0.5"
                        y2="9.5"
                        stroke="currentColor"
                        strokeWidth="1"
                      />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="content h-[calc(100vh-36px)] overflow-y-auto custom-scrollbar">
        {props.children}
      </div>
    </div>
  )
})

BasePage.displayName = 'BasePage'
export default BasePage
