import { Divider } from '@heroui/react'
import React from 'react'

interface Props {
  title: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  divider?: boolean
}

const SettingItem: React.FC<Props> = (props) => {
  const { title, actions, children, divider = false } = props

  return (
    <>
      <div className="select-text min-h-[40px] py-2 w-full flex items-center justify-between gap-4">
        <div className="h-full flex items-center gap-1.5 min-w-0">
          <h4 className="text-sm font-normal text-foreground leading-5 whitespace-nowrap truncate">
            {title}
          </h4>
          {actions && <div className="flex items-center">{actions}</div>}
        </div>
        <div className="flex items-center shrink-0">{children}</div>
      </div>
      {divider && <Divider className="my-1 bg-divider/70" />}
    </>
  )
}

export default SettingItem
