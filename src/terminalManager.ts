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
  private activeTerminal: vscode.Terminal | undefined

  private readonly _onDidChangeTerminals = new vscode.EventEmitter<void>()
  public readonly onDidChangeTerminals = this._onDidChangeTerminals.event

  constructor() {
    this.activeTerminal = vscode.window.activeTerminal
    this.syncExistingTerminals()

    this.disposables.push(
      vscode.window.onDidOpenTerminal((t) => this.handleTerminalOpen(t)),
      vscode.window.onDidCloseTerminal((t) => this.handleTerminalClose(t)),
      vscode.window.onDidChangeTerminalState((t) => this.handleTerminalStateChange(t)),
      vscode.window.onDidChangeActiveTerminal((t) => this.handleActiveTerminalChange(t)),
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

    // Wait for the shell process to be ready before sending the command
    await terminal.processId
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

  renameTerminal(id: string, name: string): void {
    const tracked = this.terminals.get(id)
    if (tracked) {
      tracked.customName = name || undefined
      this._onDidChangeTerminals.fire()
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
      tracked.label = terminal.name
      tracked.status = this.computeStatus(tracked)
    }
    this._onDidChangeTerminals.fire()
  }

  private handleActiveTerminalChange(terminal: vscode.Terminal | undefined): void {
    this.activeTerminal = terminal
    this.refreshStatuses()
    this._onDidChangeTerminals.fire()
  }

  private refreshStatuses(): void {
    for (const tracked of this.terminals.values()) {
      tracked.status = this.computeStatus(tracked)
    }
  }

  private computeStatus(tracked: TrackedTerminal): TerminalStatus {
    // Currently focused terminal is Active
    if (this.activeTerminal && tracked.terminal === this.activeTerminal) {
      return TerminalStatus.Active
    }

    // Claude terminal that has been started but not focused → Pending
    if (tracked.isClaudeManaged && tracked.terminal.state.isInteractedWith) {
      return TerminalStatus.Pending
    }

    // Everything else is Idle
    return TerminalStatus.Idle
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
      status: TerminalStatus.Idle,
      id,
      label: terminal.name,
      createdAt: Date.now(),
    }
    this.terminals.set(id, tracked)
    tracked.status = this.computeStatus(tracked)
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
