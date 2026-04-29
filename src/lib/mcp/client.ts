/**
 * MCP client — connects to stdio MCP servers and exposes their tools as AI SDK tools.
 * One client is created per server per request (no persistent connections in serverless).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DynamicTool = ReturnType<typeof tool<any, any>>;

export type McpToolBundle = {
  tools: Record<string, DynamicTool>;
  cleanup: () => Promise<void>;
};

type McpToolSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  description?: string;
};

// Build a zod schema from a JSON Schema object (best-effort, covers common cases)
function jsonSchemaToZod(schema: McpToolSchema): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, val] of Object.entries(props)) {
    const v = val as { type?: string; description?: string; enum?: unknown[]; items?: { type?: string } };
    let zType: z.ZodTypeAny;
    switch (v.type) {
      case "string":
        zType = v.enum ? z.enum(v.enum as [string, ...string[]]) : z.string();
        break;
      case "number":
      case "integer":
        zType = z.number();
        break;
      case "boolean":
        zType = z.boolean();
        break;
      case "array":
        zType = z.array(z.unknown());
        break;
      default:
        zType = z.unknown();
    }
    if (v.description) zType = zType.describe(v.description);
    if (!required.has(key)) zType = zType.optional();
    shape[key] = zType;
  }

  return z.object(shape);
}

export async function buildMcpTools(profileId: string): Promise<McpToolBundle> {
  const servers = await db.mcpServer.findMany({
    where: { profileId, enabled: true },
  });

  if (!servers.length) return { tools: {}, cleanup: async () => {} };

  const clients: Client[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, DynamicTool> = {};

  for (const server of servers) {
    let args: string[];
    let envVars: Record<string, string>;
    try {
      args = JSON.parse(server.args) as string[];
      envVars = JSON.parse(server.env) as Record<string, string>;
    } catch {
      console.warn(`[mcp] invalid config for server ${server.name}`);
      continue;
    }

    const client = new Client({ name: "openmlc", version: "1.0.0" }, { capabilities: {} });
    const transport = new StdioClientTransport({
      command: server.command,
      args,
      env: { ...process.env, ...envVars } as Record<string, string>,
    });

    try {
      await client.connect(transport);
      clients.push(client);

      const { tools: mcpTools } = await client.listTools();

      for (const mcpTool of mcpTools) {
        const toolName = `mcp__${server.name.replace(/[^a-z0-9]/gi, "_")}__${mcpTool.name}`;
        const inputSchema = mcpTool.inputSchema as McpToolSchema | undefined;
        // Use passthrough() so empty-schema tools don't trip on strict typing
        const zodSchema: z.ZodObject<Record<string, z.ZodTypeAny>> =
          inputSchema && Object.keys(inputSchema.properties ?? {}).length > 0
            ? jsonSchemaToZod(inputSchema)
            : z.object({}).passthrough() as unknown as z.ZodObject<Record<string, z.ZodTypeAny>>;

        const capturedClient = client;
        const capturedToolName = mcpTool.name;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools[toolName] = tool<any, any>({
          description: mcpTool.description ?? `MCP tool: ${mcpTool.name} from ${server.name}`,
          inputSchema: zodSchema,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          execute: async (input: any) => {
            try {
              const result = await capturedClient.callTool({
                name: capturedToolName,
                arguments: input as Record<string, unknown>,
              });
              return result.content;
            } catch (err) {
              return { error: String(err) };
            }
          },
        });
      }
    } catch (err) {
      console.error(`[mcp] failed to connect to server ${server.name}:`, err);
    }
  }

  const cleanup = async () => {
    for (const c of clients) {
      try { await c.close(); } catch {}
    }
  };

  return { tools, cleanup };
}
