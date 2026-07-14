# @arch-register/mcp-server

MCP tools for querying and, optionally, updating one Arch Register workspace.

## Configuration

Create an API token from Arch Register’s account settings. Read-only usage requires the `ws.view`
capability. Mutation usage additionally requires `ent.edit` and `MCP_ENABLE_MUTATIONS=true`.
Tokens use the `ar_pat_` prefix and are returned only once when created.

Required variables:

```text
ARCH_REGISTER_URL=https://arch-register.example.com
ARCH_REGISTER_WORKSPACE=default
ARCH_REGISTER_TOKEN=ar_pat_...
```

## Claude Desktop / Cursor

Use the stdio transport:

```json
{
  "mcpServers": {
    "arch-register": {
      "command": "pnpm",
      "args": ["--filter", "@arch-register/mcp-server", "stdio"],
      "env": {
        "ARCH_REGISTER_URL": "https://arch-register.example.com",
        "ARCH_REGISTER_WORKSPACE": "default",
        "ARCH_REGISTER_TOKEN": "ar_pat_..."
      }
    }
  }
}
```

The process writes diagnostics only to stderr so stdout remains an MCP JSON-RPC stream.

## Hosted transport

Start the Streamable HTTP and legacy SSE endpoints with:

```bash
pnpm --filter @arch-register/mcp-server http
```

Streamable HTTP is available at `/mcp`. Legacy SSE clients use `/sse` and `/messages`. Hosted
requests must send the workspace API token as `Authorization: Bearer ar_pat_...` on every request.

Set `MCP_ENABLE_MUTATIONS=true` only for a deployment that is intentionally allowed to write.
