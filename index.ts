import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "GraylogMcpServer",
  version: "1.0.0",
});

interface GraylogSearchMessageEntry {
  index: string;
  message: Record<string, unknown>;
  highlight?: Record<string, unknown>;
}

interface GraylogSearchResponse {
  query: string;
  took_ms: number;
  total_results: number;
  messages: GraylogSearchMessageEntry[];
}

type GraylogConfig = {
  baseUrl: string;
  username: string;
  password: string;
};

export function getGraylogConfig(): GraylogConfig {
  const { GRAYLOG_BASE_URL, GRAYLOG_USERNAME, GRAYLOG_PASSWORD } = process.env;

  if (!GRAYLOG_BASE_URL || !GRAYLOG_USERNAME || !GRAYLOG_PASSWORD) {
    throw new Error(
      "Missing Graylog configuration. Please set GRAYLOG_BASE_URL, GRAYLOG_USERNAME, and GRAYLOG_PASSWORD environment variables."
    );
  }

  return {
    baseUrl: GRAYLOG_BASE_URL.endsWith("/") ? GRAYLOG_BASE_URL : `${GRAYLOG_BASE_URL}/`,
    username: GRAYLOG_USERNAME,
    password: GRAYLOG_PASSWORD,
  };
}

function cleanPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null));
}

function withFields<T extends { fields?: string[] }>(payload: T): Record<string, unknown> {
  const { fields, ...rest } = payload;

  return cleanPayload({
    ...rest,
    ...(fields && fields.length > 0 ? { fields: fields.join(",") } : {}),
  });
}

export async function graylogPost<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const config = getGraylogConfig();
  const normalizedPath = path.replace(/^\//, "");
  const url = new URL(normalizedPath, config.baseUrl);
  const headers = new Headers({
    Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`,
    "Content-Type": "application/json",
    "X-Requested-By": "graylog-mcp",
  });

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(
      `Failed to reach Graylog at ${url.toString()}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Graylog request failed (${response.status} ${response.statusText}): ${errorText}`);
  }

  return (await response.json()) as T;
}

export async function graylogGet<T>(path: string, params: Record<string, unknown>): Promise<T> {
  const config = getGraylogConfig();
  const normalizedPath = path.replace(/^\//, "");
  const url = new URL(normalizedPath, config.baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const stringValue = Array.isArray(value)
      ? value.join(",")
      : typeof value === "boolean"
      ? String(value)
      : String(value);
    url.searchParams.set(key, stringValue);
  }

  const headers = new Headers({
    Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`,
    "X-Requested-By": "graylog-mcp",
    Accept: "application/json",
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers,
    });
  } catch (error) {
    throw new Error(
      `Failed to reach Graylog at ${url.toString()}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Graylog request failed (${response.status} ${response.statusText}): ${errorText}`);
  }

  return (await response.json()) as T;
}

const relativeSearchInputDefinition = {
  query: z.string().min(1, "Query is required").describe("Graylog search query written in Lucene syntax."),
  range: z.number().int().positive().describe("Relative timeframe in seconds to search backwards from now."),
  limit: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .describe("Maximum number of messages to return (default 150)."),
  offset: z.number().int().min(0).optional().describe("Pagination offset for the result set."),
  sort: z.string().optional().describe("Sort expression, e.g., 'timestamp:desc'."),
  filter: z.string().optional().describe("Graylog stream filter expression, e.g., 'streams:<stream-id>'."),
  fields: z
    .array(z.string().min(1))
    .nonempty()
    .optional()
    .describe("Restrict response to these fields (will be joined as comma separated list)."),
  decorate: z.boolean().optional().describe("Whether to apply Graylog message decorators."),
} satisfies Record<string, z.ZodTypeAny>;

const relativeSearchInputSchema = z.object(relativeSearchInputDefinition);

type RelativeSearchInput = z.infer<typeof relativeSearchInputSchema>;

const absoluteSearchInputDefinition = {
  query: z.string().min(1, "Query is required").describe("Graylog search query written in Lucene syntax."),
  from: z
    .string()
    .min(1)
    .describe("Inclusive start timestamp (ISO 8601 or Graylog date format, e.g., '2025-01-01 00:00:00')."),
  to: z
    .string()
    .min(1)
    .describe("Inclusive end timestamp (ISO 8601 or Graylog date format, e.g., '2025-01-01 23:59:59')."),
  limit: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .describe("Maximum number of messages to return (default 150)."),
  offset: z.number().int().min(0).optional().describe("Pagination offset for the result set."),
  sort: z.string().optional().describe("Sort expression, e.g., 'timestamp:desc'."),
  filter: z.string().optional().describe("Graylog stream filter expression, e.g., 'streams:<stream-id>'."),
  fields: z
    .array(z.string().min(1))
    .nonempty()
    .optional()
    .describe("Restrict response to these fields (will be joined as comma separated list)."),
  decorate: z.boolean().optional().describe("Whether to apply Graylog message decorators."),
} satisfies Record<string, z.ZodTypeAny>;

const absoluteSearchInputSchema = z.object(absoluteSearchInputDefinition);

type AbsoluteSearchInput = z.infer<typeof absoluteSearchInputSchema>;

function formatSearchResult(data: GraylogSearchResponse) {
  return {
    query: data.query,
    took_ms: data.took_ms,
    total_results: data.total_results,
    messages: data.messages.map((entry) => ({
      index: entry.index,
      message: entry.message,
      ...(entry.highlight ? { highlight: entry.highlight } : {}),
    })),
  };
}

server.registerTool(
  "search_relative_logs",
  {
    title: "Search Relative Logs",
    description: "Search Graylog messages within a relative timeframe (seconds) counted back from now.",
    inputSchema: relativeSearchInputSchema.shape,
  },
  async (input: RelativeSearchInput) => {
    try {
      const payload = withFields({
        ...input,
        limit: input.limit ?? 150,
      });

      const data = await graylogGet<GraylogSearchResponse>("api/search/universal/relative", payload);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatSearchResult(data), null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error while searching Graylog (relative).",
          },
        ],
      };
    }
  }
);

server.registerTool(
  "count_relative_logs",
  {
    title: "Count Relative Logs",
    description: "Return only the total number of Graylog messages that match a query within a relative timeframe.",
    inputSchema: relativeSearchInputDefinition,
  },
  async (input: RelativeSearchInput) => {
    try {
      const payload = withFields({
        ...input,
        limit: 0,
        offset: input.offset ?? 0,
      });

      const data = await graylogGet<GraylogSearchResponse>("api/search/universal/relative", payload);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query: data.query,
                took_ms: data.took_ms,
                total_results: data.total_results,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error while counting Graylog messages (relative).",
          },
        ],
      };
    }
  }
);

server.registerTool(
  "search_absolute_logs",
  {
    title: "Search Absolute Logs",
    description: "Search Graylog messages within an absolute time range defined by explicit start and end timestamps.",
    inputSchema: absoluteSearchInputDefinition,
  },
  async (input: AbsoluteSearchInput) => {
    try {
      const payload = withFields({
        ...input,
        limit: input.limit ?? 150,
      });

      const data = await graylogGet<GraylogSearchResponse>("api/search/universal/absolute", payload);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatSearchResult(data), null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error while searching Graylog (absolute).",
          },
        ],
      };
    }
  }
);

server.registerTool(
  "count_absolute_logs",
  {
    title: "Count Absolute Logs",
    description: "Return only the total number of Graylog messages that match a query within an absolute timeframe.",
    inputSchema: absoluteSearchInputDefinition,
  },
  async (input: AbsoluteSearchInput) => {
    try {
      const payload = withFields({
        ...input,
        limit: 0,
        offset: input.offset ?? 0,
      });

      const data = await graylogGet<GraylogSearchResponse>("api/search/universal/absolute", payload);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query: data.query,
                took_ms: data.took_ms,
                total_results: data.total_results,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error while counting Graylog messages (absolute).",
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.main) {
  main();
}
