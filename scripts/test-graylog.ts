import { graylogGet, getGraylogConfig } from "../index.js";

type GraylogSearchResponse = {
  query: string;
  took_ms: number;
  total_results: number;
};

function isValidSearchResponse(body: any): body is GraylogSearchResponse {
  return body && typeof body.query === "string" && typeof body.total_results === "number";
}

async function main() {
  try {
    getGraylogConfig(); // Validate config is available

    // Relative search: last 5 minutes
    const rel = await graylogGet<GraylogSearchResponse>("api/search/universal/relative", {
      query: "message:*",
      range: 300,
      limit: 1,
    });
    if (!isValidSearchResponse(rel)) throw new Error("Relative response JSON did not match expected shape");
    console.log(
      `[PASS] relative: status=200, total_results=${rel.total_results}, query=${rel.query}, results=${JSON.stringify(
        rel,
        null,
        2
      )}`
    );

    // Absolute search: last 1 hour
    const to = new Date();
    const from = new Date(to.getTime() - 60 * 60 * 1000);
    const abs = await graylogGet<GraylogSearchResponse>("api/search/universal/absolute", {
      query: "message:*",
      from: from.toISOString(),
      to: to.toISOString(),
      limit: 1,
    });
    if (!isValidSearchResponse(abs)) throw new Error("Absolute response JSON did not match expected shape");
    console.log(
      `[PASS] absolute: status=200, total_results=${abs.total_results}, query=${abs.query} messages=${JSON.stringify(
        abs,
        null,
        2
      )}`
    );

    console.log("All checks passed.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[FAIL] ${msg}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
