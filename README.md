# Template for Bun MCP Server

## Usage

## Create a new project

```bash
bun create github.com/dotneet/bun-mcp-server new_project_name
cd new_project_name
```

## Implement MCP server

Use [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) or any other tools you prefer.

```bash
# Edit spec.txt to describe what you want
vim spec.txt
claude "Read spec.txt and implement an MCP Server according to the specifications."
```

## Build the server

```bash
bun run build
```

## Testing and Debugging

```bash
# You can use [inspector](https://github.com/modelcontextprotocol/inspector) for testing and debugging.
package_name=$(bun run show-package-name)
npx @modelcontextprotocol/inspector dist/$package_name
```

### Verify Graylog universal search endpoints

Set required environment variables and run the verifier script. It checks that GET `universal/relative` and `universal/absolute` return HTTP 200 and expected JSON shape.

```bash
export GRAYLOG_BASE_URL="https://your-graylog.example/"
export GRAYLOG_USERNAME="your-user"
export GRAYLOG_PASSWORD="your-password"

# Run verification (Bun executes TypeScript directly)
bun run test:graylog
```

## Install

```bash
# Install the command to $HOME/bin or your preferred path
cp dist/$package_name $HOME/bin/
```
