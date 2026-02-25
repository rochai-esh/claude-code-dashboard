import type { ClaudeModel, TerminalStatus } from '../types'

export interface TerminalCardData {
  id: string
  label: string
  customName?: string
  isClaudeManaged: boolean
  model?: ClaudeModel
  status: TerminalStatus
  createdAt: number
}

// Extension → Webview
export interface UpdateTerminalsMessage {
  type: 'updateTerminals'
  terminals: TerminalCardData[]
}

export interface UpdateModelsMessage {
  type: 'updateModels'
  models: { value: string; label: string }[]
  defaultModel: string
}

export type ExtensionToWebviewMessage = UpdateTerminalsMessage | UpdateModelsMessage

// Webview → Extension
export interface NewTerminalMessage {
  type: 'newTerminal'
  model: string
}

export interface CloseTerminalMessage {
  type: 'closeTerminal'
  terminalId: string
}

export interface FocusTerminalMessage {
  type: 'focusTerminal'
  terminalId: string
}

export interface RenameTerminalMessage {
  type: 'renameTerminal'
  terminalId: string
  name: string
}

export interface RequestRefreshMessage {
  type: 'requestRefresh'
}

export type WebviewToExtensionMessage =
  | NewTerminalMessage
  | CloseTerminalMessage
  | FocusTerminalMessage
  | RenameTerminalMessage
  | RequestRefreshMessage
