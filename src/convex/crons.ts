import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

// Helper: format a Date to "yyyy-mm-dd"
function fmt(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Compute "today" and "yesterday" in IST, independent of server timezone
function getIstDates() {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);

  // Normalize to IST midnight by using the UTC fields of the shifted clock
  const istMidnight = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()));
  const yesterdayIstMidnight = new Date(istMidnight.getTime() - 24 * 60 * 60 * 1000);

  const start_date = fmt(yesterdayIstMidnight); // yesterday (IST)
  const end_date = fmt(istMidnight);            // today (IST)
  return { start_date, end_date };
}

// Internal action: fetch Pharmavends daily queries and log to WEBHOOK_LOG
export const fetchPharmavendsQueries = internalAction({
  args: {},
  handler: async (ctx) => {
    const { start_date, end_date } = getIstDates();
    const base =
      "https://pharmavends.net/api/company-profile?apitoken=RgX9pgJT07mcSX9zp3BmjAH6pdlG6oWhM2tZi4BvnU9TwQV1VG";
    const url = `${base}&start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}`;

    try {
      const res = await fetch(url, { method: "GET" });
      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        // keep raw text if not JSON
        parsed = { _raw: text };
      }

      // Store into WEBHOOK_LOG so it appears on the /webhook/logs page and can be imported later
      await ctx.runMutation(internal.webhook.insertLog, {
        payload: {
          source: "pharmavends",
          url,
          status: res.status,
          dates: { start_date, end_date },
          data: parsed,
        },
      });

      // NEW: Auto-create/club leads directly (no manual import needed)
      const arr =
        Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.data)
          ? parsed.data
          : Array.isArray(parsed?.results)
          ? parsed.results
          : Array.isArray(parsed?.company_profile)
          ? parsed.company_profile
          : [];

      const fallback = (obj: any, keys: string[], def: string) => {
        for (const k of keys) {
          const v = obj?.[k];
          if (v !== undefined && v !== null && `${v}`.trim().length > 0) {
            return `${v}`.trim();
          }
        }
        return def;
      };

      for (const r of arr) {
        // Try best-effort field extraction
        const name = fallback(r, ["SENDER_NAME", "name", "fullName", "contact_person"], "Unknown");
        const subject = fallback(r, ["SUBJECT", "subject"], "Lead from Pharmavends");
        const message = fallback(r, ["QUERY_MESSAGE", "message", "msg", "body", "remarks"], "");
        const mobileNo = fallback(r, ["SENDER_MOBILE", "SENDER_PHONE", "mobileNo", "mobile", "phone", "contact_no"], "");
        const email = fallback(r, ["SENDER_EMAIL", "email"], "");
        const altMobileNo = fallback(r, ["SENDER_MOBILE_ALT", "SENDER_PHONE_ALT", "altMobileNo", "altMobile", "altPhone"], "");
        const altEmail = fallback(r, ["SENDER_EMAIL_ALT", "altEmail"], "");
        const state = fallback(r, ["SENDER_STATE", "state", "region"], "Unknown");
        const source = "pharmavends";

        // Require at least a mobile or an email
        if (!mobileNo && !email) continue;

        await ctx.runMutation(internal.webhook.createLeadFromSource, {
          name,
          subject,
          message,
          mobileNo: `${mobileNo}`,
          email: email || "unknown@example.com",
          altMobileNo: altMobileNo ? `${altMobileNo}` : undefined,
          altEmail: altEmail || undefined,
          state,
          source,
        });
      }
    } catch (e: any) {
      // Log error as well for visibility
      await ctx.runMutation(internal.webhook.insertLog, {
        payload: {
          source: "pharmavends",
          url,
          error: e?.message || "fetch_error",
          dates: { start_date, end_date },
        },
      });
    }
  },
});

const crons = cronJobs();

// Run daily at 12:00 AM IST (which is 18:30 UTC)
crons.cron(
  "Fetch Pharmavends queries daily 12am IST",
  "30 18 * * *",
  internal.crons.fetchPharmavendsQueries,
  {}
);

export default crons;