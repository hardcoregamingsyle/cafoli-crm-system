import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

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

// Log webhooks for debugging/recordkeeping
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
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (e: any) {
      return new Response(JSON.stringify({ ok: false, error: e.message || "error" }), { status: 500 });
    }
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

      await ctx.runMutation(internal.webhook.createLeadFromSource, {
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

      // Log raw for debugging
      await ctx.runMutation(internal.webhook.insertLog, { payload: { method: "GET", url: req.url, parsed: r } });

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (e: any) {
      return new Response(JSON.stringify({ ok: false, error: e.message || "error" }), { status: 500 });
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
      const r = body?.RESPONSE ?? body ?? {};
      const fallback = (keys: string[], def: string) => {
        for (const k of keys) {
          const v = (r as any)?.[k] ?? body?.[k];
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
      const source = "indiamart";

      await ctx.runMutation(internal.webhook.createLeadFromSource, {
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

      await ctx.runMutation(internal.webhook.insertLog, { payload: { method: "POST", parsed: r } });

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (e: any) {
      return new Response(JSON.stringify({ ok: false, error: e.message || "error" }), { status: 500 });
    }
  }),
});

export default http;