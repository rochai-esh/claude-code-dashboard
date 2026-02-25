import * as vscode from 'vscode'
import {
  type TrackedTerminal,
  TerminalStatus,
  type ClaudeModel,
  CLAUDE_TERMINAL_NAME_PREFIX,
  MODEL_DISPLAY_NAMES,
} from './types'

export class TerminalManager implements vscode.Disposable {
  private terminals: Map<string, TrackedTerminal> = new Map()
  private nextId = 1
  private disposables: vscode.Disposable[] = []

  private readonly _onDidChangeTerminals = new vscode.EventEmitter<void>()
  public readonly onDidChangeTerminals = this._onDidChangeTerminals.event

  constructor() {
    this.syncExistingTerminals()

    this.disposables.push(
      vscode.window.onDidOpenTerminal((t) => this.handleTerminalOpen(t)),
      vscode.window.onDidCloseTerminal((t) => this.handleTerminalClose(t)),
      vscode.window.onDidChangeTerminalState((t) => this.handleTerminalStateChange(t)),
    )
  }

  getTrackedTerminals(): TrackedTerminal[] {
    return Array.from(this.terminals.values())
  }

  async createClaudeTerminal(model: ClaudeModel): Promise<TrackedTerminal> {
    const config = vscode.workspace.getConfiguration('claudeCodeDashboard')
    const cliPath = config.get<string>('claudeCliPath', 'claude')
    const terminalName = `${CLAUDE_TERMINAL_NAME_PREFIX} (${MODEL_DISPLAY_NAMES[model]})`

    const terminal = vscode.window.createTerminal({ name: terminalName })
    const tracked = this.trackTerminal(terminal, true, model)

    terminal.sendText(`${cliPath} --model ${model}`, true)
    terminal.show()

    this._onDidChangeTerminals.fire()
    return tracked
  }

  closeTerminal(id: string): void {
    const tracked = this.terminals.get(id)
    if (tracked) {
      tracked.terminal.dispose()
    }
  }

  focusTerminal(id: string): void {
    const tracked = this.terminals.get(id)
    if (tracked) {
      tracked.terminal.show()
    }
  }

  getTerminalById(id: string): TrackedTerminal | undefined {
    return this.terminals.get(id)
  }

  private syncExistingTerminals(): void {
    for (const terminal of vscode.window.terminals) {
      const isClaudeDetected = this.detectClaudeTerminal(terminal)
      this.trackTerminal(terminal, isClaudeDetected)
    }
  }

  private handleTerminalOpen(terminal: vscode.Terminal): void {
    const existing = this.findByVscodeTerminal(terminal)
    if (!existing) {
      const isClaudeDetected = this.detectClaudeTerminal(terminal)
      this.trackTerminal(terminal, isClaudeDetected)
    }
    this._onDidChangeTerminals.fire()
  }

  private handleTerminalClose(terminal: vscode.Terminal): void {
    const tracked = this.findByVscodeTerminal(terminal)
    if (tracked) {
      this.terminals.delete(tracked.id)
    }
    this._onDidChangeTerminals.fire()
  }

  private handleTerminalStateChange(terminal: vscode.Terminal): void {
    const tracked = this.findByVscodeTerminal(terminal)
    if (tracked) {
      if (terminal.state.isInteractedWith) {
        tracked.status = tracked.isClaudeManaged
          ? TerminalStatus.Active
          : TerminalStatus.Plain
      }
      tracked.label = terminal.name
    }
    this._onDidChangeTerminals.fire()
  }

  private trackTerminal(
    terminal: vscode.Terminal,
    isClaudeManaged: boolean,
    model?: ClaudeModel,
  ): TrackedTerminal {
    const id = String(this.nextId++)
    const tracked: TrackedTerminal = {
      terminal,
      isClaudeManaged,
      model,
      status: isClaudeManaged ? TerminalStatus.Idle : TerminalStatus.Plain,
      id,
      label: terminal.name,
      createdAt: Date.now(),
    }
    this.terminals.set(id, tracked)
    return tracked
  }

  private findByVscodeTerminal(terminal: vscode.Terminal): TrackedTerminal | undefined {
    for (const tracked of this.terminals.values()) {
      if (tracked.terminal === terminal) {
        return tracked
      }
    }
    return undefined
  }

  private detectClaudeTerminal(terminal: vscode.Terminal): boolean {
    const config = vscode.workspace.getConfiguration('claudeCodeDashboard')
    if (!config.get<boolean>('autoDetectClaudeTerminals', true)) {
      return false
    }
    return terminal.name.includes(CLAUDE_TERMINAL_NAME_PREFIX)
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose())
    this._onDidChangeTerminals.dispose()
  }
}
