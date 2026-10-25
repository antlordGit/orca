import { useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { listEnabledAgentPromptShortcuts } from '../../../../shared/agent-prompt-shortcuts'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { submitPromptToAgentPty } from '@/lib/agent-paste-draft'
import type { PtyTransport } from './pty-transport-types'

export function TerminalAgentPromptShortcuts({
  tabId,
  agent,
  transport
}: {
  tabId: string
  agent: TuiAgent
  transport: PtyTransport
}): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    left: number
    top: number
  } | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const settings = useAppStore((state) => state.settings)
  const shortcuts = listEnabledAgentPromptShortcuts(settings?.agentPromptShortcuts, agent)
  const ptyId = transport.getPtyId()
  if (!ptyId || shortcuts.length === 0) {
    return null
  }
  return (
    <div
      className="terminal-agent-prompt-shortcuts"
      ref={containerRef}
      style={
        position
          ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' }
          : undefined
      }
      role="group"
      aria-label={translate('components.native-chat.composer.promptShortcuts', 'Prompt shortcuts')}
    >
      <button
        type="button"
        className="terminal-agent-prompt-shortcuts__drag-handle"
        aria-label={translate(
          'components.native-chat.composer.movePromptShortcuts',
          'Move prompt shortcuts'
        )}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return
          }
          const bounds = containerRef.current?.getBoundingClientRect()
          const parentBounds = containerRef.current?.parentElement?.getBoundingClientRect()
          if (!bounds || !parentBounds) {
            return
          }
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            left: bounds.left - parentBounds.left,
            top: bounds.top - parentBounds.top
          }
          event.currentTarget.setPointerCapture(event.pointerId)
          event.preventDefault()
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          const bounds = containerRef.current?.getBoundingClientRect()
          const parent = containerRef.current?.parentElement
          if (!drag || drag.pointerId !== event.pointerId || !bounds || !parent) {
            return
          }
          const parentBounds = parent.getBoundingClientRect()
          const viewportMargin = 8
          const originX = parentBounds.left + parent.clientLeft
          const originY = parentBounds.top + parent.clientTop
          const minLeft = Math.max(0, viewportMargin - originX)
          const minTop = Math.max(0, viewportMargin - originY)
          const maxLeft = Math.min(
            parent.clientWidth - bounds.width,
            window.innerWidth - viewportMargin - bounds.width - originX
          )
          const maxTop = Math.min(
            parent.clientHeight - bounds.height,
            window.innerHeight - viewportMargin - bounds.height - originY
          )
          const left = Math.max(minLeft, Math.min(maxLeft, drag.left + event.clientX - drag.startX))
          const top = Math.max(minTop, Math.min(maxTop, drag.top + event.clientY - drag.startY))
          setPosition({ left, top })
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId !== event.pointerId) {
            return
          }
          dragRef.current = null
        }}
        onPointerCancel={() => {
          dragRef.current = null
        }}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      {shortcuts.map((shortcut) => (
        <Button
          key={shortcut.id}
          type="button"
          variant="secondary"
          size="xs"
          title={shortcut.content}
          onClick={() => {
            void submitPromptToAgentPty({ tabId, ptyId, content: shortcut.content })
          }}
        >
          <span className="max-w-48 truncate">{shortcut.name}</span>
        </Button>
      ))}
    </div>
  )
}
