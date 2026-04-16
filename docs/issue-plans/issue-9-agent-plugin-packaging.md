# Detailed Issue Plan

This file contains the detailed implementation content for this single GitHub issue, extracted from the master plan.

## Phase 7 — Agent Plugin Packaging ([#9](https://github.com/mrlarson2007/copilot-tdd-harness/issues/9))

Package the harness as a VS Code Agent Plugin so it installs with a single command and is discoverable in the `@agentPlugins` Extensions view. The plugin format is shared by VS Code, GitHub Copilot CLI, and Claude Code.

### plugin.json (repo root)

```json
{
  "name": "copilot-tdd-harness",
  "description": "Enforces the RED→GREEN→COMMIT→REFACTOR TDD workflow using hooks, agents, skills, and prompt files.",
  "version": "0.1.0",
  "author": { "name": "mrlarson2007" },
  "skills": ".github/skills/",
  "agents": ".github/agents/",
  "hooks": ".github/hooks/tdd-enforcement.json"
}
```

### Distribution Channels

| Channel | How | Audience |
|---------|-----|---------|
| Git URL install | `Chat: Install Plugin From Source` → `https://github.com/mrlarson2007/copilot-tdd-harness` | Any VS Code user |
| GitHub Copilot CLI | `gh copilot plugin install https://github.com/mrlarson2007/copilot-tdd-harness` | CLI users |
| `copilot-plugins` marketplace | Submit `marketplace.json` to `github/copilot-plugins` | Discoverable via `@agentPlugins` in Extensions view |
| NuGet content package | `dotnet add package copilot-tdd-harness` drops files into `.github/` via content files | .NET teams |

### marketplace.json Entry

Added to the `github/copilot-plugins` or `github/awesome-copilot` repo to make the plugin discoverable under `@agentPlugins` in the VS Code Extensions view.

### NuGet Content Package

`copilot-tdd-harness.nuspec` packages all `.github/**` skill/agent/hook files as NuGet content files. On `dotnet add package copilot-tdd-harness`, these are restored into the target project's `.github/` directory. The project can then register the path via `chat.pluginLocations` in VS Code settings.

