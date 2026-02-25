import * as vscode from 'vscode'
import { TerminalManager } from './terminalManager'
import { DashboardPanel, DashboardSidebarProvider } from './dashboardPanel'
import { type ClaudeModel, MODEL_QUICK_PICK_ITEMS } from './types'

export function activate(context: vscode.ExtensionContext): void {
  const manager = new TerminalManager()
  const dashboard = DashboardPanel.getInstance(manager, context.extensionUri)

  const sidebarProvider = new DashboardSidebarProvider(dashboard)
  const sidebarRegistration = vscode.window.registerWebviewViewProvider(
    'claudeCodeDashboard.welcome',
    sidebarProvider,
  )

  const openDashboardCmd = vscode.commands.registerCommand(
    'claudeCodeDashboard.openDashboard',
    () => dashboard.openOrReveal(),
  )

  const newTerminalCmd = vscode.commands.registerCommand(
    'claudeCodeDashboard.newClaudeTerminal',
    async () => {
      const config = vscode.workspace.getConfiguration('claudeCodeDashboard')
      const defaultModel = config.get<string>('defaultModel', 'sonnet') as ClaudeModel
      await manager.createClaudeTerminal(defaultModel)
    },
  )

  const newTerminalWithModelCmd = vscode.commands.registerCommand(
    'claudeCodeDashboard.newClaudeTerminalWithModel',
    async () => {
      const picked = await vscode.window.showQuickPick(MODEL_QUICK_PICK_ITEMS, {
        placeHolder: 'Select a Claude model',
        title: 'New Claude Code Terminal',
      })

      if (picked) {
        await manager.createClaudeTerminal(picked.description as ClaudeModel)
      }
    },
  )

  const refreshCmd = vscode.commands.registerCommand(
    'claudeCodeDashboard.refreshTerminals',
    () => dashboard.openOrReveal(),
  )

  const closeTerminalCmd = vscode.commands.registerCommand(
    'claudeCodeDashboard.closeTerminal',
    (arg?: unknown) => {
      const id = resolveTerminalId(arg)
      if (id) {
        manager.closeTerminal(id)
      }
    },
  )

  const focusTerminalCmd = vscode.commands.registerCommand(
    'claudeCodeDashboard.focusTerminal',
    (arg?: unknown) => {
      const id = resolveTerminalId(arg)
      if (id) {
        manager.focusTerminal(id)
      }
    },
  )

  context.subscriptions.push(
    manager,
    dashboard,
    sidebarRegistration,
    openDashboardCmd,
    newTerminalCmd,
    newTerminalWithModelCmd,
    refreshCmd,
    closeTerminalCmd,
    focusTerminalCmd,
  )

  // Auto-open the dashboard on activation
  dashboard.openOrReveal()
}

function resolveTerminalId(arg: unknown): string | undefined {
  if (typeof arg === 'string') {
    return arg
  }
  return undefined
}

export function deactivate(): void {}
