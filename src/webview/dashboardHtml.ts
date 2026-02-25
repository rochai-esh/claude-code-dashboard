import type * as vscode from 'vscode'

export function getDashboardHtml(webview: vscode.Webview, nonce: string): string {
  return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <title>Claude Code Dashboard</title>
  <style nonce="${nonce}">
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 24px;
      line-height: 1.5;
    }

    .dashboard-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .dashboard-header h1 {
      font-size: 1.4em;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin-right: auto;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: var(--vscode-font-size);
      font-family: var(--vscode-font-family);
      cursor: pointer;
      outline: none;
    }
    select:focus {
      border-color: var(--vscode-focusBorder);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border: none;
      border-radius: 4px;
      font-size: var(--vscode-font-size);
      font-family: var(--vscode-font-family);
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }

    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .btn-icon {
      background: transparent;
      color: var(--vscode-foreground);
      padding: 4px 8px;
      border-radius: 4px;
    }
    .btn-icon:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .card {
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      position: relative;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.06),
        0 1px 3px rgba(0,0,0,0.12),
        0 1px 2px rgba(0,0,0,0.08);
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.06),
        0 4px 12px rgba(0,0,0,0.15),
        0 2px 4px rgba(0,0,0,0.1);
    }
    .card:hover .card-actions {
      opacity: 1;
    }

    .card-active {
      background: linear-gradient(135deg, rgba(40,167,69,0.12) 0%, rgba(40,167,69,0.04) 100%);
      border: 1px solid rgba(40,167,69,0.25);
    }
    .card-idle {
      background: linear-gradient(135deg, rgba(255,193,7,0.12) 0%, rgba(255,193,7,0.04) 100%);
      border: 1px solid rgba(255,193,7,0.25);
    }
    .card-exited {
      background: linear-gradient(135deg, rgba(220,53,69,0.12) 0%, rgba(220,53,69,0.04) 100%);
      border: 1px solid rgba(220,53,69,0.25);
    }
    .card-plain {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .card-title {
      font-weight: 600;
      font-size: 1em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      margin-right: 8px;
    }

    .card-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .card-action-btn {
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
      font-size: 14px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card-action-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }
    .card-action-btn.close-btn:hover {
      color: var(--vscode-errorForeground);
    }

    .card-body {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .status-dot.active { background: #28a745; }
    .status-dot.idle { background: #ffc107; }
    .status-dot.exited { background: #dc3545; }
    .status-dot.plain { background: #6c757d; }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.8em;
      font-weight: 500;
    }

    .badge-status {
      background: rgba(255,255,255,0.08);
      color: var(--vscode-foreground);
    }

    .badge-model {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .card-meta {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.4;
    }

    .empty-state h2 {
      font-size: 1.2em;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .empty-state p {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="dashboard-header">
    <h1>Claude Code Dashboard</h1>
    <div class="header-controls">
      <select id="modelSelect" title="Select model for new terminal"></select>
      <button class="btn btn-primary" id="newTerminalBtn" title="Create new Claude Code terminal">
        + New Terminal
      </button>
      <button class="btn btn-icon" id="refreshBtn" title="Refresh terminals">
        &#x21bb;
      </button>
    </div>
  </div>

  <div id="cardGrid" class="card-grid"></div>
  <div id="emptyState" class="empty-state" style="display:none;">
    <div class="empty-state-icon">&#x2756;</div>
    <h2>No Terminals Open</h2>
    <p>Create a new Claude Code terminal to get started.</p>
    <button class="btn btn-primary" id="emptyNewTerminalBtn">
      + New Claude Code Terminal
    </button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const cardGrid = document.getElementById('cardGrid');
    const emptyState = document.getElementById('emptyState');
    const modelSelect = document.getElementById('modelSelect');
    const newTerminalBtn = document.getElementById('newTerminalBtn');
    const emptyNewTerminalBtn = document.getElementById('emptyNewTerminalBtn');
    const refreshBtn = document.getElementById('refreshBtn');

    function createNewTerminal() {
      vscode.postMessage({ type: 'newTerminal', model: modelSelect.value });
    }

    newTerminalBtn.addEventListener('click', createNewTerminal);
    emptyNewTerminalBtn.addEventListener('click', createNewTerminal);
    refreshBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'requestRefresh' });
    });

    function statusLabel(status) {
      switch (status) {
        case 'active': return 'Active';
        case 'idle': return 'Idle';
        case 'exited': return 'Exited';
        case 'plain': return 'Terminal';
        default: return status;
      }
    }

    function formatTime(timestamp) {
      const d = new Date(timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function cardClass(status) {
      switch (status) {
        case 'active': return 'card-active';
        case 'idle': return 'card-idle';
        case 'exited': return 'card-exited';
        default: return 'card-plain';
      }
    }

    function renderTerminals(terminals) {
      if (!terminals.length) {
        cardGrid.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
      }

      cardGrid.style.display = 'grid';
      emptyState.style.display = 'none';
      cardGrid.innerHTML = '';

      terminals.forEach(t => {
        const card = document.createElement('div');
        card.className = 'card ' + cardClass(t.status);
        card.dataset.id = t.id;

        const modelBadge = t.isClaudeManaged && t.model
          ? '<span class="badge badge-model">' + escapeHtml(capitalize(t.model)) + '</span>'
          : '';

        card.innerHTML =
          '<div class="card-header">' +
            '<span class="card-title">' + escapeHtml(t.label) + '</span>' +
            '<div class="card-actions">' +
              '<button class="card-action-btn focus-btn" data-id="' + t.id + '" title="Focus terminal">&#x25B6;</button>' +
              '<button class="card-action-btn close-btn" data-id="' + t.id + '" title="Close terminal">&#x2715;</button>' +
            '</div>' +
          '</div>' +
          '<div class="card-body">' +
            '<span class="status-dot ' + t.status + '"></span>' +
            '<span class="badge badge-status">' + statusLabel(t.status) + '</span>' +
            modelBadge +
          '</div>' +
          '<div class="card-meta">Created ' + formatTime(t.createdAt) + '</div>';

        card.addEventListener('click', (e) => {
          if (e.target.closest('.card-action-btn')) return;
          vscode.postMessage({ type: 'focusTerminal', terminalId: t.id });
        });

        cardGrid.appendChild(card);
      });
    }

    // Event delegation for action buttons
    cardGrid.addEventListener('click', (e) => {
      const focusBtn = e.target.closest('.focus-btn');
      if (focusBtn) {
        e.stopPropagation();
        vscode.postMessage({ type: 'focusTerminal', terminalId: focusBtn.dataset.id });
        return;
      }
      const closeBtn = e.target.closest('.close-btn');
      if (closeBtn) {
        e.stopPropagation();
        vscode.postMessage({ type: 'closeTerminal', terminalId: closeBtn.dataset.id });
      }
    });

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'updateTerminals':
          renderTerminals(msg.terminals);
          break;
        case 'updateModels':
          modelSelect.innerHTML = '';
          msg.models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.value;
            opt.textContent = m.label;
            if (m.value === msg.defaultModel) opt.selected = true;
            modelSelect.appendChild(opt);
          });
          break;
      }
    });

    // Request initial data
    vscode.postMessage({ type: 'requestRefresh' });
  </script>
</body>
</html>`
}
