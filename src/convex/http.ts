import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Log webhooks for debugging/recordkeeping
http.route({
  path: "/api/webhook/logs",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await req.json();
      // Store minimal log entry to audit logs (anonymous system user concept: store without userId using a placeholder)
      await ctx.runMutation(internal.webhook.insertLog, { payload: body });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (e: any) {
      return new Response(JSON.stringify({ ok: false, error: e.message || "error" }), { status: 500 });
    }
  }),
});

// Optional: IndiaMART webhook to create a lead
http.route({
  path: "/api/webhook/indiamart",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await req.json();
      const r = body?.RESPONSE ?? {};
      const name = r.SENDER_NAME || "Unknown";
      const subject = r.SUBJECT || "Lead from IndiaMART";
      const message = r.QUERY_MESSAGE || "";
      const mobileNo = (r.SENDER_MOBILE || r.SENDER_PHONE || "").toString();
      const email = r.SENDER_EMAIL || "unknown@example.com";
      const altMobileNo = (r.SENDER_MOBILE_ALT || r.SENDER_PHONE_ALT || "").toString() || undefined;
      const altEmail = r.SENDER_EMAIL_ALT || undefined;
      const state = r.SENDER_STATE || "Unknown";
      const source = "indiamart";

      await ctx.runMutation(internal.webhook.createLeadFromSource, {
        name,
        subject,
        message,
        mobileNo,
        email,
        altMobileNo,
        altEmail,
        state,
        source,
      });

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (e: any) {
      return new Response(JSON.stringify({ ok: false, error: e.message || "error" }), { status: 500 });
    }
  }),
});

export default http;