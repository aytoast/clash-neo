import React, { useState, useMemo } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Checkbox
} from '@heroui/react'
import { toast } from '@renderer/components/base/toast'
import { useGroups } from '@renderer/hooks/use-groups'
import {
  getLocalRulesEditor,
  saveLocalRules,
  mihomoCloseConnection,
  addOverrideItem
} from '@renderer/utils/ipc'
import { useActiveProfile } from '@renderer/hooks/use-active-profile'

interface QuickRouteModalProps {
  connection: IMihomoConnectionDetail
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const RULE_TYPES = [
  { key: 'DOMAIN-SUFFIX', label: 'DOMAIN-SUFFIX (Match domain & all subdomains)' },
  { key: 'DOMAIN', label: 'DOMAIN (Exact host match)' },
  { key: 'DOMAIN-KEYWORD', label: 'DOMAIN-KEYWORD (Keyword match)' },
  { key: 'IP-CIDR', label: 'IP-CIDR (Destination IP block)' }
]

export const QuickRouteModal: React.FC<QuickRouteModalProps> = ({
  connection,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { isLocalActive } = useActiveProfile()
  const { groups = [] } = useGroups()

  // Extract base domain and default payload
  const rawHost =
    connection.metadata.host ||
    connection.metadata.sniffHost ||
    connection.metadata.destinationIP ||
    ''

  const initialPayload = useMemo(() => {
    if (!rawHost) return ''
    if (rawHost.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(rawHost)) {
      return rawHost.includes(':') ? `${rawHost}/128` : `${rawHost}/32`
    }
    const parts = rawHost.split('.')
    if (parts.length > 2) {
      return parts.slice(-2).join('.')
    }
    return rawHost
  }, [rawHost])

  const initialRuleType = useMemo(() => {
    if (!rawHost) return 'DOMAIN-SUFFIX'
    if (rawHost.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(rawHost)) {
      return 'IP-CIDR'
    }
    return 'DOMAIN-SUFFIX'
  }, [rawHost])

  const [ruleType, setRuleType] = useState<string>(initialRuleType)
  const [payload, setPayload] = useState<string>(initialPayload)
  const [targetGroup, setTargetGroup] = useState<string>(() => {
    if (groups.length > 0) return groups[0].name
    return 'DIRECT'
  })
  const [saveAsOverride, setSaveAsOverride] = useState<boolean>(!isLocalActive)
  const [terminateExisting, setTerminateExisting] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState(false)

  const groupOptions = useMemo(() => {
    const list = [{ name: 'DIRECT' }, { name: 'REJECT' }]
    groups.forEach((g) => {
      if (!list.some((item) => item.name === g.name)) {
        list.push({ name: g.name })
      }
    })
    return list
  }, [groups])

  const handleSave = async (): Promise<void> => {
    const cleanPayload = payload.trim()
    if (!cleanPayload) {
      toast.error('Rule payload required')
      return
    }

    setSubmitting(true)
    const ruleString = `${ruleType},${cleanPayload},${targetGroup}`

    try {
      if (!saveAsOverride && isLocalActive) {
        // Prepend directly to local profile rules
        const editor = await getLocalRulesEditor()
        await saveLocalRules({ action: 'add', index: 0, value: ruleString }, editor.rules)
      } else {
        // Add as prepend rule override (works for any remote subscription)
        const overrideYaml = `rules:\n  - ${ruleString}`
        await addOverrideItem({
          name: `Route: ${cleanPayload}`,
          type: 'local',
          ext: 'yaml',
          file: overrideYaml
        })
      }

      if (terminateExisting) {
        try {
          await mihomoCloseConnection(connection.id)
        } catch {
          // ignore
        }
      }

      toast.success(`Routing applied: ${ruleString}`)
      onSuccess?.()
      onClose()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" className="shadcn-card">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 pb-1">
          <span className="text-base font-semibold text-foreground">Quick Routing Rule</span>
          <span className="text-xs text-default-500 font-mono">
            {connection.metadata.process || 'Process'} → {rawHost}
          </span>
        </ModalHeader>

        <ModalBody className="space-y-3 py-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-default-600">Rule Match Type</label>
            <Select
              size="sm"
              selectedKeys={[ruleType]}
              onChange={(e) => setRuleType(e.target.value)}
              className="w-full text-sm"
              aria-label="Rule match type"
            >
              {RULE_TYPES.map((t) => (
                <SelectItem key={t.key} textValue={t.key}>
                  <div className="text-sm font-mono">{t.key}</div>
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-default-600">Target Host / Pattern</label>
            <Input
              size="sm"
              value={payload}
              onValueChange={setPayload}
              placeholder="example.com"
              className="w-full text-base font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-default-600">Route To Destination</label>
            <Select
              size="sm"
              selectedKeys={[targetGroup]}
              onChange={(e) => setTargetGroup(e.target.value)}
              className="w-full text-sm"
              aria-label="Target destination group"
            >
              {groupOptions.map((g) => (
                <SelectItem key={g.name} textValue={g.name}>
                  <div className="text-sm font-medium">{g.name}</div>
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="pt-2 space-y-2 border-t border-divider">
            <Checkbox size="sm" isSelected={terminateExisting} onValueChange={setTerminateExisting}>
              <span className="text-xs text-default-600">
                Close active socket immediately (forces next request through new route)
              </span>
            </Checkbox>

            <Checkbox size="sm" isSelected={saveAsOverride} onValueChange={setSaveAsOverride}>
              <span className="text-xs text-default-600">
                Save as user override (persists even if remote subscription updates)
              </span>
            </Checkbox>
          </div>
        </ModalBody>

        <ModalFooter className="pt-2">
          <Button size="sm" variant="light" onPress={onClose} className="h-8 text-sm">
            Cancel
          </Button>
          <Button
            size="sm"
            color="primary"
            isLoading={submitting}
            onPress={() => void handleSave()}
            className="h-8 px-4 text-sm font-medium"
          >
            Apply Route
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default QuickRouteModal
