import { createMcpHandler } from "@modelcontextprotocol/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { hashKey, mcpBearerKey } from "@/lib/mcp";
import { buildServer } from "./server";

// The MCP server (design v4): Streamable HTTP, stateless, on the default Node.js runtime
// (Cache Components doesn't allow a `runtime` export). Public in the proxy like
// /api/collect; every request carries `Authorization: Bearer vamcp_...`, an account key
// from Settings → MCP server, checked against its hash in Convex before anything else.

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// One server per request, bound to the key the route checked; 2025-era clients
// (initialize, then tools/call) get the SDK's stateless fallback
const handler = createMcpHandler(
  ({ authInfo }) => buildServer(authInfo!.token, process.env.INGEST_SECRET!),
  { onerror: (error) => console.error("[mcp]", error) },
);

const unauthorized = (message: string) =>
  Response.json(
    { error: message },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="analytics"', "Cache-Control": "no-store" } },
  );

async function handle(request: Request): Promise<Response> {
  const key = mcpBearerKey(request.headers.get("authorization"));
  if (key === null) return unauthorized("Missing or malformed API key");

  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    console.error("[mcp] INGEST_SECRET is not set");
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const keyHash = hashKey(key);
  try {
    if (!(await convex.mutation(api.mcp.authenticate, { secret, keyHash }))) return unauthorized("Unknown or revoked API key");
  } catch (error) {
    console.error("[mcp]", error);
    return Response.json({ error: "Could not check the API key" }, { status: 500 });
  }
  // The token handed to the factory is the hash, so the key itself goes no further
  return await handler.fetch(request, { authInfo: { token: keyHash, clientId: "api-key", scopes: [] } });
}

export { handle as GET, handle as POST, handle as DELETE };
