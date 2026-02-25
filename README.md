# Claude Code Dashboard

A VS Code extension that provides a visual dashboard for managing Claude Code terminal sessions with model selection.

## Features

- **Dashboard View** — Card-based UI in the editor area showing all Claude Code terminals
- **Model Selection** — Launch terminals with Opus, Sonnet, or Haiku from a dropdown
- **Status Indicators** — Color-coded cards: green (active), amber (idle), red (exited)
- **Terminal Management** — Focus, close, and create terminals directly from the dashboard
- **Auto-Detection** — Automatically detects existing Claude Code terminals
- **Theme Support** — Adapts to light and dark VS Code themes

## Usage

1. Click the Claude Code Dashboard icon in the activity bar
2. The dashboard opens in the editor area
3. Select a model from the dropdown and click **+ New Terminal**
4. Cards show terminal status with hover actions (focus / close)

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `claudeCodeDashboard.defaultModel` | `sonnet` | Default model for new terminals |
| `claudeCodeDashboard.claudeCliPath` | `claude` | Path to the Claude CLI executable |
| `claudeCodeDashboard.autoDetectClaudeTerminals` | `true` | Auto-detect Claude terminals |

## Requirements

- VS Code 1.94.0+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
