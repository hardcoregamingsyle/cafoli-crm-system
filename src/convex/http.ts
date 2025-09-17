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

// Add: OPTIONS handler for /api/webhook/indiamart (CORS preflight)
http.route({
  path: "/api/webhook/indiamart",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return corsNoContent();
  }),
});

// Optional: IndiaMART webhook to create a lead
http.route({
  path: "/api/webhook/indiamart",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      // Parse from query or other sources
      const url = new URL(req.url);
      const paramsObj: Record<string, string> = {};
      url.searchParams.forEach((value, key) => (paramsObj[key] = value));

      // Unified field extraction
      const r = paramsObj.RESPONSE ? paramsObj.RESPONSE : paramsObj;
      const fallback = (keys: string[], def: string) => {
        for (const k of keys) {
          const v = (r as any)?.[k] ?? paramsObj[k];
          if (v !== undefined && v !== null && `${v}`.length > 0) return `${v}`;
        }
        return def;
      };

      const name = fallback(["SENDER_NAME", "name", "fullName"], "Unknown");
      const subject = fallback(["SUBJECT", "subject"], "Lead from IndiaMART");
      const message = fallback(["QUERY_MESSAGE", "message", "msg", "body"], "");
      const mobileNo = fallback(["SENDER_MOBILE", "SENDER_PHONE", "mobileNo", "mobile", "phone"], "");
      const email = fallback(["SENDER_EMAIL", "email"], "unknown@example.com");
      const altMobileNo = fallback(["SENDER_MOBILE_ALT", "SENDER_PHONE_ALT", "altMobileNo", "altMobile", "altPhone"], "");
      const altEmail = fallback(["SENDER_EMAIL_ALT", "altEmail"], "");
      const state = fallback(["SENDER_STATE", "state", "region"], "Unknown");

      // Only attempt create if essential data present
      const shouldAttempt = !!(mobileNo || (email && email !== "unknown@example.com"));
      let created = false;
      if (shouldAttempt) {
        created = await ctx.runMutation(internal.webhook.createLeadFromSource, {
          name,
          subject,
          message,
          mobileNo: `${mobileNo}`,
          email,
          altMobileNo: altMobileNo ? `${altMobileNo}` : undefined,
          altEmail: altEmail || undefined,
          state,
          source: "indiamart",
        });
      }

      // Log raw + accurate leadCreated for debugging
      await ctx.runMutation(internal.webhook.insertLog, {
        payload: { method: "GET", url: req.url, parsed: r, leadCreated: created },
      });

      return corsJson({ ok: true, received: true, leadCreated: created }, 200);
    } catch (e: any) {
      return corsJson({ ok: false, error: e.message || "error" }, 500);
    }
  }),
});

// Generic catch for POST with robust parsing
http.route({
  path: "/api/webhook/indiamart",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await parseRequestPayload(req);
      
      // Log the raw payload for debugging
      await ctx.runMutation(internal.webhook.insertLog, { 
        payload: { 
          method: "POST", 
          rawBody: body,
          timestamp: new Date().toISOString()
        } 
      });

      // IndiaMART sends data in RESPONSE object
      const r = body?.RESPONSE ?? body ?? {};
      const fallback = (keys: string[], def: string) => {
        for (const k of keys) {
          const v = (r as any)?.[k] ?? body?.[k];
          if (v !== undefined && v !== null && `${v}`.trim().length > 0) return `${v}`.trim();
        }
        return def;
      };

      const name = fallback(["SENDER_NAME", "name", "fullName"], "Unknown");
      const subject = fallback(["SUBJECT", "subject"], "Lead from IndiaMART");
      const message = fallback(["QUERY_MESSAGE", "message", "msg", "body"], "");
      const mobileNo = fallback(["SENDER_MOBILE", "SENDER_PHONE", "mobileNo", "mobile", "phone"], "");
      const email = fallback(["SENDER_EMAIL", "email"], "unknown@example.com");
      const altMobileNo = fallback(["SENDER_MOBILE_ALT", "SENDER_PHONE_ALT", "altMobileNo", "altMobile", "altPhone"], "");
      const altEmail = fallback(["SENDER_EMAIL_ALT", "altEmail"], "");
      const state = fallback(["SENDER_STATE", "state", "region"], "Unknown");
      const source = "indiamart";

      // Only attempt to create if we have essential data
      const shouldAttempt = !!(mobileNo || (email && email !== "unknown@example.com"));
      let created = false;
      if (shouldAttempt) {
        created = await ctx.runMutation(internal.webhook.createLeadFromSource, {
          name,
          subject,
          message,
          mobileNo: `${mobileNo}`,
          email,
          altMobileNo: altMobileNo ? `${altMobileNo}` : undefined,
          altEmail: altEmail || undefined,
          state,
          source,
        });
      }

      // Log parsed payload + accurate created flag for POST as well
      await ctx.runMutation(internal.webhook.insertLog, {
        payload: {
          method: "POST",
          url: req.url,
          parsed: r,
          leadCreated: created,
        },
      });

      return corsJson({ ok: true, received: true, leadCreated: created }, 200);
    } catch (e: any) {
      // Log the error for debugging
      await ctx.runMutation(internal.webhook.insertLog, { 
        payload: { 
          method: "POST", 
          error: e.message,
          timestamp: new Date().toISOString()
        } 
      });
      
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
      const max = Math.max(1, Math.min(limit, 1000));

      // Ensure we act as an admin to fetch logs (admin-restricted query)
      const currentUserId = await ensureAdminUserId(ctx);
      const result: any[] =
        (await ctx.runQuery(api.audit.getWebhookLogs, { currentUserId, limit: max })) ?? [];

      const logs = result.map((l: any) => ({
        _id: l._id,
        timestamp: l.timestamp,
        details: l.details,
      }));

      return corsJson({ ok: true, logs }, 200);
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
      const all: any[] = (await ctx.runQuery(api.leads.getAllLeads, { filter: "all", currentUserId })) ?? [];

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
      const all: any[] =
        (await ctx.runQuery(api.leads.getAllLeads, { filter: "all", currentUserId })) ?? [];

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

export default http;