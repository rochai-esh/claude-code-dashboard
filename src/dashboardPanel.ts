import * as vscode from 'vscode'
import { TerminalManager } from './terminalManager'
import { toCardData } from './types'
import { getDashboardHtml } from './webview/dashboardHtml'
import { ClaudeModel, MODEL_DISPLAY_NAMES } from './types'
import type { WebviewToExtensionMessage } from './webview/messageTypes'

function getNonce(): string {
  let text = ''
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}

export class DashboardPanel implements vscode.Disposable {
  private static instance: DashboardPanel | undefined
  private panel: vscode.WebviewPanel | undefined
  private disposables: vscode.Disposable[] = []

  constructor(
    private readonly manager: TerminalManager,
    private readonly extensionUri: vscode.Uri,
  ) {
    this.disposables.push(
      manager.onDidChangeTerminals(() => this.sendTerminalsUpdate()),
    )
  }

  static getInstance(manager: TerminalManager, extensionUri: vscode.Uri): DashboardPanel {
    if (!DashboardPanel.instance) {
      DashboardPanel.instance = new DashboardPanel(manager, extensionUri)
    }
    return DashboardPanel.instance
  }

  openOrReveal(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One)
      return
    }

    this.panel = vscode.window.createWebviewPanel(
      'claudeCodeDashboard',
      'Claude Code Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      },
    )

    const nonce = getNonce()
    this.panel.webview.html = getDashboardHtml(this.panel.webview, nonce)

    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewToExtensionMessage) => this.handleWebviewMessage(msg),
      undefined,
      this.disposables,
    )

    this.panel.onDidDispose(
      () => {
        this.panel = undefined
      },
      undefined,
      this.disposables,
    )

    this.panel.iconPath = vscode.Uri.joinPath(
      this.extensionUri,
      'resources',
      'icons',
      'claude-dashboard.svg',
    )

    // Send initial data
    this.sendModelsUpdate()
    this.sendTerminalsUpdate()
  }

  private handleWebviewMessage(msg: WebviewToExtensionMessage): void {
    switch (msg.type) {
      case 'newTerminal':
        this.manager.createClaudeTerminal(msg.model as ClaudeModel)
        break
      case 'closeTerminal':
        this.manager.closeTerminal(msg.terminalId)
        break
      case 'focusTerminal':
        this.manager.focusTerminal(msg.terminalId)
        break
      case 'requestRefresh':
        this.sendModelsUpdate()
        this.sendTerminalsUpdate()
        break
    }
  }

  private sendTerminalsUpdate(): void {
    if (!this.panel) {
      return
    }
    const terminals = this.manager.getTrackedTerminals()
    terminals.sort((a, b) => {
      if (a.isClaudeManaged !== b.isClaudeManaged) {
        return a.isClaudeManaged ? -1 : 1
      }
      return a.createdAt - b.createdAt
    })
    this.panel.webview.postMessage({
      type: 'updateTerminals',
      terminals: terminals.map(toCardData),
    })
  }

  private sendModelsUpdate(): void {
    if (!this.panel) {
      return
    }
    const config = vscode.workspace.getConfiguration('claudeCodeDashboard')
    const defaultModel = config.get<string>('defaultModel', 'sonnet')
    const models = Object.values(ClaudeModel).map((model) => ({
      value: model,
      label: MODEL_DISPLAY_NAMES[model],
    }))
    this.panel.webview.postMessage({
      type: 'updateModels',
      models,
      defaultModel,
    })
  }

  dispose(): void {
    DashboardPanel.instance = undefined
    this.panel?.dispose()
    this.disposables.forEach((d) => d.dispose())
  }
}

export class DashboardSidebarProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly dashboardPanel: DashboardPanel,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    webviewView.webview.options = { enableScripts: true }

    const nonce = getNonce()

    webviewView.webview.html = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <style nonce="${nonce}">
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 16px;
      text-align: center;
    }
    p { margin-bottom: 12px; font-size: 0.9em; color: var(--vscode-descriptionForeground); }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: var(--vscode-font-size);
      font-family: var(--vscode-font-family);
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
  </style>
</head>
<body>
  <p>Open the dashboard in the editor to manage your Claude Code terminals.</p>
  <button id="openBtn">Open Dashboard</button>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('openBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'openDashboard' });
    });
  </script>
</body>
</html>`

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'openDashboard') {
        this.dashboardPanel.openOrReveal()
      }
    })

    // Auto-open dashboard when sidebar becomes visible
    this.dashboardPanel.openOrReveal()
  }
}
