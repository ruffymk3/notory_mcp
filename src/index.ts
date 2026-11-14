#!/usr/bin/env node
/**
 * Notory MCP server.
 *
 * Exposes a Notory instance's REST API to MCP-capable AI assistants over stdio.
 * The assistant authenticates as the owner of a Notory API token, so it can
 * never do more than that user may: RBAC, token scopes (read/write) and tenant
 * isolation all still apply.
 *
 * Configuration (environment variables):
 *   NOTORY_BASE_URL   Base URL of the instance, e.g. https://demo.notory.io
 *   NOTORY_API_TOKEN  An API token (starts with "inv_"), created in the web UI
 *                     under Settings -> API tokens. Give it a "read" scope to
 *                     keep the assistant read-only.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (process.env.NOTORY_BASE_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.NOTORY_API_TOKEN || "";

if (!BASE_URL || !TOKEN) {
  console.error(
    "[notory-mcp] Missing configuration. Set NOTORY_BASE_URL (e.g. " +
      "https://demo.notory.io) and NOTORY_API_TOKEN (an 'inv_...' token from " +
      "Settings -> API tokens)."
  );
  process.exit(1);
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

interface CallResult {
  ok: boolean;
  status: number;
  data: unknown;
}

/** Perform an authenticated request against the instance. `path` is rooted at the
 *  host (must start with "/", e.g. "/api/v1/assets"). Never throws on HTTP errors -
 *  the status and parsed body are returned so the model can reason about them. */
async function call(
  method: HttpMethod,
  path: string,
  opts: { query?: Record<string, unknown>; body?: unknown } = {}
): Promise<CallResult> {
  if (!path.startsWith("/")) path = "/" + path;
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(opts.query || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/json",
  };
  const init: RequestInit = { method, headers };
  if (opts.body !== undefined && method !== "GET") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    return { ok: false, status: 0, data: `Network error: ${(err as Error).message}` };
  }
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }
  return { ok: res.ok, status: res.status, data };
}

/** Wrap a CallResult as an MCP tool result (JSON text + isError on failure). */
function result(r: CallResult) {
  const payload =
    typeof r.data === "string" ? r.data : JSON.stringify(r.data, null, 2);
  const header = r.ok ? `HTTP ${r.status}` : `HTTP ${r.status} (error)`;
  return {
    content: [{ type: "text" as const, text: `${header}\n${payload}` }],
    isError: !r.ok,
  };
}

const server = new McpServer({ name: "notory", version: "0.1.0" });

// ── Discovery ──────────────────────────────────────────────────────────────
server.tool(
  "notory_list_endpoints",
  "List the available Notory API endpoints (method, path, summary) from the " +
    "live OpenAPI spec of the configured instance. Use this to discover what " +
    "you can call before using notory_request. Optionally filter by substring.",
  { search: z.string().optional().describe("Case-insensitive substring filter on path or summary") },
  async ({ search }) => {
    const r = await call("GET", "/api/openapi.json");
    if (!r.ok || typeof r.data !== "object" || r.data === null) return result(r);
    const spec = r.data as { paths?: Record<string, Record<string, { summary?: string }>> };
    const q = (search || "").toLowerCase();
    const lines: string[] = [];
    for (const [path, methods] of Object.entries(spec.paths || {})) {
      for (const [method, op] of Object.entries(methods)) {
        if (!HTTP_METHODS.includes(method.toUpperCase() as HttpMethod)) continue;
        const summary = op?.summary || "";
        const line = `${method.toUpperCase().padEnd(6)} ${path}${summary ? ` - ${summary}` : ""}`;
        if (!q || line.toLowerCase().includes(q)) lines.push(line);
      }
    }
    lines.sort();
    return {
      content: [
        {
          type: "text" as const,
          text: `${lines.length} endpoint(s):\n${lines.join("\n")}`,
        },
      ],
    };
  }
);

// ── Generic access ─────────────────────────────────────────────────────────
server.tool(
  "notory_get",
  "GET any Notory endpoint (read-only). `path` is rooted at the host, e.g. " +
    "'/api/v1/assets' or '/api/v1/assets/{id}'. Pass query parameters via `query`.",
  {
    path: z.string().describe("Path starting with '/', e.g. /api/v1/assets"),
    query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  },
  async ({ path, query }) => result(await call("GET", path, { query }))
);

server.tool(
  "notory_request",
  "Call any Notory endpoint with any HTTP method (GET/POST/PUT/PATCH/DELETE). " +
    "Writes require a token with the 'write' scope. Use notory_list_endpoints " +
    "first to find the right path and payload shape.",
  {
    method: z.enum(HTTP_METHODS),
    path: z.string().describe("Path starting with '/', e.g. /api/v1/assets"),
    query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    body: z.unknown().optional().describe("JSON request body for POST/PUT/PATCH"),
  },
  async ({ method, path, query, body }) =>
    result(await call(method, path, { query, body }))
);

// ── Convenience: assets (the most common object) ───────────────────────────
server.tool(
  "notory_list_assets",
  "List assets with optional filters and pagination. Thin wrapper over " +
    "GET /api/v1/assets.",
  {
    query: z.string().optional().describe("Free-text search term"),
    status: z.string().optional().describe("Filter by asset status"),
    asset_type: z.string().optional().describe("Filter by asset type"),
    page: z.number().int().positive().optional(),
    page_size: z.number().int().min(1).max(100).optional(),
  },
  async ({ query, status, asset_type, page, page_size }) =>
    result(
      await call("GET", "/api/v1/assets", {
        query: { q: query, status, asset_type, page, page_size },
      })
    )
);

server.tool(
  "notory_get_asset",
  "Fetch a single asset by its id (GET /api/v1/assets/{asset_id}).",
  { asset_id: z.string().describe("The asset id") },
  async ({ asset_id }) =>
    result(await call("GET", `/api/v1/assets/${encodeURIComponent(asset_id)}`))
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[notory-mcp] connected to ${BASE_URL} (stdio)`);
}

main().catch((err) => {
  console.error("[notory-mcp] fatal:", err);
  process.exit(1);
});
