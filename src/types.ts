import type * as vscode from 'vscode'
import type { TerminalCardData } from './webview/messageTypes'

export enum ClaudeModel {
  Opus = 'opus',
  Sonnet = 'sonnet',
  Haiku = 'haiku',
}

export enum TerminalStatus {
  Plain = 'plain',
  Idle = 'idle',
  Active = 'active',
  Exited = 'exited',
}

export interface TrackedTerminal {
  terminal: vscode.Terminal
  isClaudeManaged: boolean
  model?: ClaudeModel
  status: TerminalStatus
  id: string
  label: string
  createdAt: number
}

export const CLAUDE_TERMINAL_NAME_PREFIX = 'Claude Code'

export const MODEL_DISPLAY_NAMES: Record<ClaudeModel, string> = {
  [ClaudeModel.Opus]: 'Opus',
  [ClaudeModel.Sonnet]: 'Sonnet',
  [ClaudeModel.Haiku]: 'Haiku',
}

export const MODEL_QUICK_PICK_ITEMS = Object.values(ClaudeModel).map((model) => ({
  label: MODEL_DISPLAY_NAMES[model],
  description: model,
}))

export function toCardData(t: TrackedTerminal): TerminalCardData {
  return {
    id: t.id,
    label: t.label,
    isClaudeManaged: t.isClaudeManaged,
    model: t.model,
    status: t.status,
    createdAt: t.createdAt,
  }
}
