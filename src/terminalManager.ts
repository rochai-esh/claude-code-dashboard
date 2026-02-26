import * as vscode from 'vscode'
import {
  type TrackedTerminal,
  TerminalStatus,
  type ClaudeModel,
  CLAUDE_TERMINAL_NAME_PREFIX,
  MODEL_DISPLAY_NAMES,
} from './types'

// How long after the last output burst before transitioning Active → Pending
const OUTPUT_ACTIVE_MS = 1500

export class TerminalManager implements vscode.Disposable {
  private terminals: Map<string, TrackedTerminal> = new Map()
  private nextId = 1
  private disposables: vscode.Disposable[] = []
  private outputDebounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  private readonly _onDidChangeTerminals = new vscode.EventEmitter<void>()
  public readonly onDidChangeTerminals = this._onDidChangeTerminals.event

  constructor() {
    this.syncExistingTerminals()

    this.disposables.push(
      vscode.window.onDidOpenTerminal((t) => this.handleTerminalOpen(t)),
      vscode.window.onDidCloseTerminal((t) => this.handleTerminalClose(t)),
      vscode.window.onDidChangeTerminalState((t) => this.handleTerminalStateChange(t)),
      vscode.window.onDidStartTerminalShellExecution((e) => this.handleShellExecutionStart(e)),
      vscode.window.onDidEndTerminalShellExecution((e) => this.handleShellExecutionEnd(e)),
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

    // Claude is starting — show as Pending (waiting for first user input)
    tracked.claudeRunning = true
    tracked.status = TerminalStatus.Pending

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
      const timer = this.outputDebounceTimers.get(tracked.id)
      if (timer) {
        clearTimeout(timer)
        this.outputDebounceTimers.delete(tracked.id)
      }
      this.terminals.delete(tracked.id)
    }
    this._onDidChangeTerminals.fire()
  }

  private handleTerminalStateChange(terminal: vscode.Terminal): void {
    const tracked = this.findByVscodeTerminal(terminal)
    if (tracked) {
      tracked.label = terminal.name
    }
    this._onDidChangeTerminals.fire()
  }

  // Fired whenever data is written to the terminal output buffer.
  // We use this to distinguish Active (output flowing) from Pending (quiet but running).
  private handleTerminalData(terminal: vscode.Terminal, _data: string): void {
    const tracked = this.findByVscodeTerminal(terminal)
    if (!tracked || !tracked.isClaudeManaged || !tracked.claudeRunning) return

    tracked.lastOutputTime = Date.now()

    if (tracked.status !== TerminalStatus.Active) {
      tracked.status = TerminalStatus.Active
      this._onDidChangeTerminals.fire()
    }

    // Restart the debounce — when output stops for OUTPUT_ACTIVE_MS, transition to Pending
    this.resetOutputDebounce(tracked)
  }

  private resetOutputDebounce(tracked: TrackedTerminal): void {
    const existing = this.outputDebounceTimers.get(tracked.id)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      this.outputDebounceTimers.delete(tracked.id)
      if (tracked.claudeRunning && tracked.status === TerminalStatus.Active) {
        tracked.status = TerminalStatus.Pending
        this._onDidChangeTerminals.fire()
      }
    }, OUTPUT_ACTIVE_MS)

    this.outputDebounceTimers.set(tracked.id, timer)
  }

  // Shell integration: fires when the shell begins executing a command.
  // Catches the case where the user manually types `claude` in an existing terminal.
  private handleShellExecutionStart(event: vscode.TerminalShellExecutionStartEvent): void {
    const tracked = this.findByVscodeTerminal(event.terminal)
    if (!tracked || !tracked.isClaudeManaged) return

    const config = vscode.workspace.getConfiguration('claudeCodeDashboard')
    const cliPath = config.get<string>('claudeCliPath', 'claude')
    const cmdLine = event.execution.commandLine?.value?.trim() ?? ''

    // Only react if the command being run is the claude CLI
    if (cmdLine === cliPath || cmdLine.startsWith(cliPath + ' ')) {
      tracked.claudeRunning = true
      if (tracked.status === TerminalStatus.Idle) {
        tracked.status = TerminalStatus.Pending
        this._onDidChangeTerminals.fire()
      }

      // Read execution output stream to detect activity (Active vs Pending)
      this.readExecutionOutput(tracked, event.execution)
    }
  }

  private async readExecutionOutput(
    tracked: TrackedTerminal,
    execution: vscode.TerminalShellExecution,
  ): Promise<void> {
    try {
      for await (const data of execution.read()) {
        this.handleTerminalData(tracked.terminal, data)
      }
    } catch {
      // Stream ends when terminal closes or execution finishes
    }
  }

  // Shell integration: fires when the command finishes (i.e. claude process exits).
  private handleShellExecutionEnd(event: vscode.TerminalShellExecutionEndEvent): void {
    const tracked = this.findByVscodeTerminal(event.terminal)
    if (!tracked || !tracked.isClaudeManaged) return

    const config = vscode.workspace.getConfiguration('claudeCodeDashboard')
    const cliPath = config.get<string>('claudeCliPath', 'claude')
    const cmdLine = event.execution.commandLine?.value?.trim() ?? ''

    if (cmdLine === cliPath || cmdLine.startsWith(cliPath + ' ')) {
      tracked.claudeRunning = false
      tracked.status = TerminalStatus.Idle

      const timer = this.outputDebounceTimers.get(tracked.id)
      if (timer) {
        clearTimeout(timer)
        this.outputDebounceTimers.delete(tracked.id)
      }

      this._onDidChangeTerminals.fire()
    }
  }

  private trackTerminal(
    terminal: vscode.Terminal,
    isClaudeManaged: boolean,
    model?: ClaudeModel,
  ): TrackedTerminal {
    const id = String(this.nextId++)

    // Existing claude terminals that have already been interacted with are assumed running
    const claudeRunning = isClaudeManaged && terminal.state.isInteractedWith

    const tracked: TrackedTerminal = {
      terminal,
      isClaudeManaged,
      model,
      status: claudeRunning ? TerminalStatus.Pending : TerminalStatus.Idle,
      id,
      label: terminal.name,
      createdAt: Date.now(),
      claudeRunning,
      lastOutputTime: 0,
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
    for (const timer of this.outputDebounceTimers.values()) {
      clearTimeout(timer)
    }
    this.outputDebounceTimers.clear()
    this.disposables.forEach((d) => d.dispose())
    this._onDidChangeTerminals.dispose()
  }
}
