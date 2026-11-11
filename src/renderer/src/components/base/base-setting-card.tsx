import React, { useState } from 'react'
import { Accordion, AccordionItem, Card, CardBody } from '@heroui/react'
import { IoIosArrowBack } from 'react-icons/io'

interface Props {
  title?: string
  children?: React.ReactNode
  className?: string
}

const SettingCard: React.FC<Props> = (props) => {
  const [isOpen, setIsOpen] = useState(false)

  return !props.title ? (
    <Card
      shadow="none"
      radius="sm"
      className={`${props.className ?? ''} m-2 border border-divider bg-content1`}
    >
      <CardBody className="p-3.5">{props.children}</CardBody>
    </Card>
  ) : (
    <Accordion
      isCompact
      className={`${props.className ?? ''} my-2 mx-2 px-0`}
      variant="splitted"
      itemClasses={{
        base: 'border border-divider bg-content1 rounded-[6px] shadow-none px-3.5',
        title: 'text-sm font-semibold text-foreground',
        trigger: 'py-2.5',
        content: 'pt-1 pb-3'
      }}
      onSelectionChange={(keys) => {
        setIsOpen(keys instanceof Set ? keys.size > 0 : false)
      }}
    >
      <AccordionItem
        className="data-[open=true]:pb-2"
        hideIndicator
        keepContentMounted
        textValue={props.title}
        title={
          <div className="flex justify-between items-center w-full">
            <span className="text-sm font-medium tracking-tight">{props.title}</span>
            <IoIosArrowBack
              className={`transition duration-200 ml-2 h-6 text-base text-foreground-500 ${isOpen ? '-rotate-90' : ''}`}
            />
          </div>
        }
      >
        {props.children}
      </AccordionItem>
    </Accordion>
  )
}

export default SettingCard
