## Graylog MCP Server

### Introduction

The Graylog MCP Server lets AI IDEs and agents securely query your Graylog instance via the Model Context Protocol. It exposes standardized tools so assistants can search recent or absolute time windows and optionally count results without pulling full payloads.

What you get:

- search tools for Graylog universal search
  - relative window: last N seconds
  - absolute window: explicit ISO timestamps
  - count-only variants for lightweight analytics
- drop-in configuration for popular IDEs and MCP tools

Requirements:

- a reachable Graylog URL
- credentials with permissions to use Universal Search

Links:

- Model Context Protocol: https://modelcontextprotocol.io
- Graylog: https://www.graylog.org/

---

### Installation and Usage

Quick start (runs the MCP server over stdio):

```bash
npx -y graylog-mcp
```

Required environment variables:

- GRAYLOG_BASE_URL: your Graylog base URL (e.g., https://graylog.example/)
- GRAYLOG_USERNAME: Graylog username
- GRAYLOG_PASSWORD: Graylog password

Configure in your IDE or Agentic Tool of choice (Cursor, VS Code, Claude Code):

```json
{
  "graylog": {
    "command": "npx -y graylog-mcp",
    "env": {
      "GRAYLOG_BASE_URL": "https://YOUR_GRAYLOG_INSTANCE_URL/",
      "GRAYLOG_USERNAME": "YOUR_USERNAME",
      "GRAYLOG_PASSWORD": "YOUR_PASSWORD"
    }
  }
}
```

#### Sample Usage Prompts

Some sample prompts to make the most of the MCP server:

**Analyzing error patterns**

```txt
search graylog for the errors in the past 24 hours with log_level:ERROR with a max limit of 100 per query

use the message patterns in the query results to figure out the patterns of errors that are occuring and put them in ERRORS.md

for subsequent queries, use the NOT condition to filter out messages with error patterns that are already discovered
```

Security notes:

- Prefer scoped, least-privilege Graylog credentials.
- Do not commit secrets to source control; use environment managers where possible.

---

### Contribution and Local Development

Prerequisites:

- Bun: https://bun.sh/
- Node-compatible environment

Install and build:

```bash
# Install deps (if any) and build
bun install
bun run build
```

Run locally (TypeScript directly via Bun stdio):

```bash
# Start the MCP server from source
export GRAYLOG_BASE_URL="https://your-graylog.example/"
export GRAYLOG_USERNAME="your-user"
export GRAYLOG_PASSWORD="your-password"
bun index.ts
```

Test against a live Graylog (verifies universal search endpoints):

```bash
export GRAYLOG_BASE_URL="https://your-graylog.example/"
export GRAYLOG_USERNAME="your-user"
export GRAYLOG_PASSWORD="your-password"

# Run verification (Bun executes TypeScript directly)
bun run test:graylog
```

Project scripts:

- build: `bun run build` → emits `dist/index.js`
- test: `bun run test:graylog` → health checks for relative/absolute universal search
- show-package-name: prints the package name

Debug with MCP Inspector against local source:

```bash
npx -y @modelcontextprotocol/inspector "bun index.ts"
```

Code style and contributions:

- Keep code readable and well-typed; avoid unnecessary complexity.
- Match existing formatting; keep lines reasonably wrapped.
- Open issues/PRs with clear reproduction steps or proposed changes.
