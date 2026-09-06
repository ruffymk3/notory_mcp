# Notory MCP server

A small [MCP](https://modelcontextprotocol.io) server that lets an AI assistant
work with your [Notory](https://notory.io/) inventory through the normal REST API.

Notory is a flexible, GDPR-compliant IT inventory and asset management (ITAM)
tool - self-hosted or as EU-hosted SaaS. Product: https://notory.io/ · Docs:
https://support.notory.io/

You hand it a Notory API token, point it at your instance, and the assistant can
look things up ("which laptops are in maintenance?") or, if the token allows it,
make changes. It never gets to do anything the token's owner couldn't do anyway -
the same roles, scopes and tenant boundaries still apply.

## What you get

Five tools. The first two are generic and between them cover the whole API:

- `notory_list_endpoints` - lists the endpoints your instance exposes, so the
  assistant can find out what's actually available
- `notory_request` - calls any endpoint with any method (writes need a
  write-scoped token)
- `notory_get` - a read-only shortcut for plain GET requests
- `notory_list_assets` and `notory_get_asset` - convenience wrappers for the
  thing people ask about most

Because the discovery and request tools read the live OpenAPI spec of your
instance, the assistant can reach all 200-odd endpoints, not just assets.

## Getting started

You need Node 18 or newer and an API token. Create the token in Notory under
Settings, API tokens. It's shown once and starts with `inv_`. Give it the `read`
scope if you only want look-ups, or `write` if the assistant should be able to
change things.

Run it straight from npm with `npx` - no clone, no build step:

```bash
npx -y @notory/mcp
```

Then tell your MCP client where it lives. Most clients read a JSON config that
looks like this:

```json
{
  "mcpServers": {
    "notory": {
      "command": "npx",
      "args": ["-y", "@notory/mcp"],
      "env": {
        "NOTORY_BASE_URL": "https://demo.notory.io",
        "NOTORY_API_TOKEN": "inv_your_token_here"
      }
    }
  }
}
```

Restart the client and you're set. Try asking it to list the assets in
maintenance, or to show a specific asset by its serial number.

Prefer to run from source (for development)? Clone the repo, then `npm install`
and `npm run build`, and point the client at `node` with the absolute path to
`dist/index.js`.

## Configuration

Two environment variables, both required:

- `NOTORY_BASE_URL` - your instance, e.g. `https://demo.notory.io` (no trailing
  `/api`)
- `NOTORY_API_TOKEN` - the `inv_...` token; its scope decides read-only vs
  read/write

## A word on safety

Stick to a `read` token unless you genuinely need writes. The server keeps no
state of its own - it just forwards your requests over HTTPS and hands the
response back. The token grants exactly the owner's permissions in exactly their
tenant, nothing more.

## Development

```bash
npm run dev   # tsc --watch
npm start     # run the built server (needs the two env vars set)
```

## License

MIT - see [LICENSE](./LICENSE). Copyright (c) 2026 TougeTech - Raphael Ernst.
