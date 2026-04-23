const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

async function readRequestBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

function buildTargetUrl(req) {
  const targetOrigin = process.env.API_PROXY_TARGET;

  if (!targetOrigin) {
    throw new Error("API_PROXY_TARGET is not configured.");
  }

  const incomingUrl = new URL(req.url, "http://localhost");
  return new URL(incomingUrl.pathname + incomingUrl.search, targetOrigin);
}

export default async function handler(req, res) {
  try {
    const targetUrl = buildTargetUrl(req);
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readRequestBody(req);
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const entry of value) {
          headers.append(key, entry);
        }
        continue;
      }

      headers.set(key, value);
    }

    headers.set("x-forwarded-host", req.headers.host ?? "");
    headers.set("x-forwarded-proto", req.headers["x-forwarded-proto"] ?? "https");

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });

    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.statusCode = upstream.status;
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    res.end(responseBody);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      success: false,
      error: {
        code: "API_PROXY_ERROR",
        message: error instanceof Error ? error.message : "API proxy failed.",
      },
    }));
  }
}
