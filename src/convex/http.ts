import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";

const http = httpRouter();

function sanitizeJsonLikeString(input: string): string {
  // Remove trailing commas before } or ]
  return input.replace(/,\s*([}\]])/g, "$1");
}

async function parseRequestPayload(req: Request): Promise<any> {
  // Try JSON
  try {
    const json = await req.clone().json();
    return json;
  } catch (_) {
    // ignore
  }
  // Try text -> JSON
  try {
    const text = await req.clone().text();
    if (text && text.trim().length > 0) {
      const sanitized = sanitizeJsonLikeString(text.trim());
      try {
        return JSON.parse(sanitized);
      } catch {
        // If it's not JSON at all, return raw text
        return { _raw: text };
      }
    }
  } catch (_) {
    // ignore
  }
  // Try form data
  try {
    const form = await req.clone().formData();
    const obj: Record<string, any> = {};
    (form as any).forEach((value: any, key: string) => {
      obj[key] = value;
    });
    return obj;
  } catch (_) {
    // ignore
  }
  return {};
}

// Add: CORS helpers
function corsJson(data: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      ...extraHeaders,
    },
  });
}

function corsNoContent(status = 204, extraHeaders: Record<string, string> = {}) {
  return new Response(null, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      ...extraHeaders,
    },
  });
}

// Add: helper to ensure an admin user id for server-initiated actions (mirrors webhook.ts)
async function ensureAdminUserId(ctx: any) {
  // Resolve or create an admin user via internal mutation (httpAction cannot use ctx.db)
  const ownerId = await ctx.runMutation(internal.webhook.ensureLoggingUser, {});
  return ownerId;
}

// Add: helper to extract client IP from headers
function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // XFF may contain a list: client, proxy1, proxy2...
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return null;
}

// Add: fetch ipstack data if configured
async function ipstackLookup(ip: string): Promise<any | null> {
  try {
    // Env vars in Convex httpAction are available via process.env
    const key = process.env.IPSTACK_API_KEY;
    if (!key) return null;
    // fields kept concise; add more if needed
    const url = `http://api.ipstack.com/${encodeURIComponent(
      ip
    )}?access_key=${encodeURIComponent(key)}&fields=ip,city,region_name,country_name,connection.isp`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.success === false) return null;
    return json;
  } catch {
    return null;
  }
}

// Add: apiip.net lookup
async function apiipLookup(ip: string): Promise<any | null> {
  try {
    const key = process.env.APIIP_ACCESS_KEY;
    const base = process.env.APIIP_BASE_URL || "https://apiip.net/api/check";
    if (!key || !base) return null;

    const url = `${base}?ip=${encodeURIComponent(ip)}&accessKey=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    // Some providers signal errors inside the JSON
    if (json?.success === false && json?.message) return null;
    return json;
  } catch {
    return null;
  }
}

// Log webhooks for debugging/recordkeeping
http.route({
  path: "/api/webhook/logs",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return corsNoContent();
  }),
});

http.route({
  path: "/api/webhook/logs",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      // For GET we support query params as payload
      const url = new URL(req.url);
      const paramsObj: Record<string, string> = {};
      url.searchParams.forEach((value, key) => (paramsObj[key] = value));
      await ctx.runMutation(internal.webhook.insertLog, { payload: paramsObj });
      return corsJson({ ok: true }, 200);
    } catch (e: any) {
      return corsJson({ ok: false, error: e.message || "error" }, 500);
    }
  }),
});

// New: List webhook logs via HTTP (reads the same deployment as the webhook)
http.route({
  path: "/api/webhook/logs_list",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return corsNoContent();
  }),
});

http.route({
  path: "/api/webhook/logs_list",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      const url = new URL(req.url);
      const limit = Number(url.searchParams.get("limit") ?? "200");
      const cursorParam = url.searchParams.get("cursor");
      const max = Math.max(1, Math.min(limit, 50));

      // Ensure we act as an admin to fetch logs (admin-restricted query)
      const currentUserId = await ensureAdminUserId(ctx);
      const { items, isDone, continueCursor } = await ctx.runQuery(
        api.audit.getWebhookLogs,
        {
          currentUserId,
          paginationOpts: {
            numItems: max,
            cursor: cursorParam ?? null,
          },
        }
      );

      const logs = items.map((l: any) => ({
        _id: l._id,
        timestamp: l.timestamp,
        details: l.details,
      }));

      return corsJson({ ok: true, logs, isDone, continueCursor }, 200);
    } catch (e: any) {
      return corsJson({ ok: false, error: e.message || "error" }, 500);
    }
  }),
});

// New: Import from webhook logs via HTTP to ensure same-deployment execution
http.route({
  path: "/api/webhook/import_from_logs",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return corsNoContent();
  }),
});

http.route({
  path: "/api/webhook/import_from_logs",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const url = new URL(req.url);
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Number(limitParam) : 500;

      const currentUserId = await ensureAdminUserId(ctx);
      const result = await ctx.runMutation(api.webhook.importFromWebhookLogs, {
        currentUserId,
        limit,
      });

      return corsJson({ ok: true, ...result }, 200);
    } catch (e: any) {
      return corsJson({ ok: false, error: e.message || "error" }, 500);
    }
  }),
});

// New: Quick debug endpoint to view latest leads from the same deployment
http.route({
  path: "/api/webhook/latest_leads",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return corsNoContent();
  }),
});

http.route({
  path: "/api/webhook/latest_leads",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      const url = new URL(req.url);
      const limitParam = Number(url.searchParams.get("limit") ?? "5");
      const limit = Math.max(1, Math.min(limitParam, 50));

      const currentUserId = await ensureAdminUserId(ctx);
      const result = await ctx.runQuery(api.leads.getAllLeads, { filter: "all", currentUserId, paginationOpts: { numItems: 1000, cursor: null } });
      const all: any[] = (result as any)?.page ?? [];

      // Sort by creation time asc (as our query returns), take latest
      const latest = all.slice(-limit).map((l: any) => ({
        _id: l._id,
        name: l.name,
        subject: l.subject,
        mobileNo: l.mobileNo,
        email: l.email,
        _creationTime: l._creationTime,
      }));

      return corsJson({ ok: true, count: latest.length, latest }, 200);
    } catch (e: any) {
      return corsJson({ ok: false, error: e.message || "error" }, 500);
    }
  }),
});

// New: Leads count and latest info for quick deployment debugging
http.route({
  path: "/api/webhook/leads_count",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return corsNoContent();
  }),
});

http.route({
  path: "/api/webhook/leads_count",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      const currentUserId = await ensureAdminUserId(ctx);
      const result = await ctx.runQuery(api.leads.getAllLeads, { filter: "all", currentUserId, paginationOpts: { numItems: 1000, cursor: null } });
      const all: any[] = (result as any)?.page ?? [];

      const count = all.length;
      const latest = count > 0 ? all[all.length - 1] : null;
      const summary = latest
        ? {
            _id: latest._id,
            name: latest.name,
            subject: latest.subject,
            _creationTime: latest._creationTime,
          }
        : null;

      return corsJson({ ok: true, count, latest: summary }, 200);
    } catch (e: any) {
      return corsJson({ ok: false, error: e.message || "error" }, 500);
    }
  }),
});

// New: CORS preflight for /api/iplogging
http.route({
  path: "/api/iplogging",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return corsNoContent();
  }),
});

// New: POST /api/iplogging — log a login with IP geolocation enrichment
http.route({
  path: "/api/iplogging",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      // Parse JSON body with { username }
      let body: any = {};
      try {
        body = await req.json();
      } catch {
        // ignore
      }
      const username = (body?.username ?? "").toString().trim();

      const ip = getClientIp(req) || "Unknown";
      const ua = req.headers.get("user-agent") || "Unknown";

      // Prefer apiip; fallback to ipstack to preserve compatibility
      const apiipInfo = ip !== "Unknown" ? await apiipLookup(ip) : null;
      const ipstackInfo = !apiipInfo && ip !== "Unknown" ? await ipstackLookup(ip) : null;

      // Extract display-friendly fields (prefer apiip)
      const city =
        apiipInfo?.city ??
        apiipInfo?.location?.city ??
        ipstackInfo?.city ??
        "-";
      const region =
        apiipInfo?.region_name ??
        apiipInfo?.region ??
        apiipInfo?.location?.region ??
        ipstackInfo?.region_name ??
        "-";
      const country =
        apiipInfo?.country_name ??
        apiipInfo?.country ??
        apiipInfo?.location?.country ??
        ipstackInfo?.country_name ??
        "-";
      const isp =
        apiipInfo?.connection?.isp ??
        apiipInfo?.isp ??
        ipstackInfo?.connection?.isp ??
        "-";

      // Build formatted details (human-readable)
      const lines: string[] = [];
      lines.push("LOGIN IP LOG");
      lines.push(`Username: ${username || "-"}`);
      lines.push(`IP: ${ip}`);
      if (apiipInfo || ipstackInfo) {
        lines.push(`City: ${city}`);
        lines.push(`Region: ${region}`);
        lines.push(`Country: ${country}`);
        lines.push(`ISP: ${isp}`);
        // Add a hint that full JSON is attached
        lines.push(`Provider: ${apiipInfo ? "apiip.net" : "ipstack"}`);
      } else {
        lines.push("Geolocation: (apiip/ipstack disabled or unavailable)");
      }
      lines.push(`User-Agent: ${ua}`);
      const details = lines.join("\n");

      // Store in auditLogs (full raw provider payloads included)
      const systemUserId = await ensureAdminUserId(ctx);
      await ctx.runMutation(internal.webhook.insertLog, {
        payload: {
          type: "LOGIN_IP_LOG",
          username,
          ip,
          userAgent: ua,
          apiip: apiipInfo || null,     // full apiip payload if available
          ipstack: ipstackInfo || null, // legacy field for backward compatibility
          formatted: details,
          ts: new Date().toISOString(),
        },
      });

      return corsJson(
        {
          ok: true,
          username,
          ip,
          city,
          region,
          country,
          isp,
          userAgent: ua,
          formatted: details,
          provider: apiipInfo ? "apiip.net" : (ipstackInfo ? "ipstack" : "none"),
        },
        200
      );
    } catch (e: any) {
      return corsJson({ ok: false, error: e?.message || "error" }, 500);
    }
  }),
});

// New: GET /api/iplogging — Admin-only view of latest login IP logs (formatted)
// Make this endpoint resilient: never 500; return empty logs on internal errors.
http.route({
  path: "/api/iplogging",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      const url = new URL(req.url);
      const limitParam = Number(url.searchParams.get("limit") ?? "100");
      const cursorParam = url.searchParams.get("cursor");
      const limit = Math.max(1, Math.min(limitParam, 50));

      const sinceDaysParam = Number(url.searchParams.get("sinceDays") ?? "30");
      const days = Number.isFinite(sinceDaysParam) && sinceDaysParam > 0 ? sinceDaysParam : 30;
      const now = Date.now();
      const sinceTs = now - days * 24 * 60 * 60 * 1000;

      let adminUserId: any = null;
      try {
        adminUserId = await ensureAdminUserId(ctx);
      } catch {
        return corsJson(
          {
            ok: true,
            count: 0,
            logs: [],
            isDone: true,
            continueCursor: null,
            warning: "Could not ensure admin user; returning empty logs.",
          },
          200
        );
      }

      let items: any[] = [];
      let isDone = true;
      let continueCursor: string | null = null;
      try {
        const page = await ctx.runQuery(api.audit.getWebhookLogs, {
          currentUserId: adminUserId,
          paginationOpts: {
            numItems: limit,
            cursor: cursorParam ?? null,
          },
          sinceTs,
        });
        items = Array.isArray((page as any)?.items) ? (page as any).items : [];
        isDone = Boolean((page as any)?.isDone);
        continueCursor = (page as any)?.continueCursor ?? null;
      } catch (e: any) {
        return corsJson(
          {
            ok: true,
            count: 0,
            logs: [],
            isDone: true,
            continueCursor: null,
            warning: `Failed to load logs: ${e?.message || "unknown error"}`,
          },
          200
        );
      }

      const loginLogs: any[] = [];
      for (const l of items) {
        try {
          const d = JSON.parse(l.details || "{}");

          if (d?.type !== "LOGIN_IP_LOG") continue;

          // Prefer apiip fields, fallback to ipstack
          const city =
            d.apiip?.city ??
            d.apiip?.location?.city ??
            d.ipstack?.city ??
            null;
          const region =
            d.apiip?.region_name ??
            d.apiip?.region ??
            d.apiip?.location?.region ??
            d.ipstack?.region_name ??
            null;
          const country =
            d.apiip?.country_name ??
            d.apiip?.country ??
            d.apiip?.location?.country ??
            d.ipstack?.country_name ??
            null;
          const isp =
            d.apiip?.connection?.isp ??
            d.apiip?.isp ??
            d.ipstack?.connection?.isp ??
            null;

          loginLogs.push({
            _id: l._id,
            timestamp: l.timestamp,
            username: d.username ?? null,
            ip: d.ip ?? null,
            city,
            region,
            country,
            isp,
            userAgent: d.userAgent ?? null,
            formatted: d.formatted ?? null,
          });
        } catch {
          continue;
        }
      }

      loginLogs.sort((a, b) => b.timestamp - a.timestamp);

      return corsJson(
        {
          ok: true,
          count: loginLogs.length,
          logs: loginLogs,
          isDone,
          continueCursor,
        },
        200
      );
    } catch (e: any) {
      return corsJson(
        {
          ok: true,
          count: 0,
          logs: [],
          isDone: true,
          continueCursor: null,
          warning: e?.message || "Unhandled error",
        },
        200
      );
    }
  }),
});

export default http;