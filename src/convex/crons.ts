import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

// Helper: Clean phone number by removing quotes and formatting
function cleanPhoneNumber(phone: string): string {
  if (!phone) return "";
  return phone.toString().replace(/'/g, "").trim();
}

// Helper: Clean email and validate
function cleanEmail(email: string): string {
  if (!email) return "";
  const cleaned = email.toString().trim().toLowerCase();
  return cleaned.includes("@") ? cleaned : "";
}

// Helper: Map column data to lead object
function mapColumnDataToLead(item: any) {
  return {
    serialNo: item["Column A"] ? Number(item["Column A"]) : undefined,
    source: item["Column B"] || "unknown",
    name: item["Column C"] || "Unknown",
    subject: item["Column D"] || "Lead inquiry",
    email: cleanEmail(item["Column E"]) || "unknown@example.com",
    mobileNo: cleanPhoneNumber(item["Column F"]) || "",
    message: item["Column G"] || "",
    altEmail: cleanEmail(item["Column H"]) || undefined,
    altMobileNo: cleanPhoneNumber(item["Column I"]) || undefined,
    state: item["Column M"] || "Unknown",
    station: item["Column N"] || undefined,
    district: item["Column O"] || undefined,
    pincode: item["Column P"] || undefined,
    agencyName: item["Column Q"] || undefined,
  };
}

// Internal action: fetch leads from Google Apps Script endpoint
export const fetchGoogleScriptLeads = internalAction({
  args: {},
  handler: async (ctx) => {
    const url = "https://script.google.com/macros/s/AKfycbxKrR7SZjO_DhJwJhguvAmnejgddGydFEvJSdsnmV-hl1UQMINjWNQ-dxJRNT155m-H/exec";

    try {
      const res = await fetch(url, { method: "GET" });
      const text = await res.text();
      
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Log error if not valid JSON
        await ctx.runMutation(internal.webhook.insertLog, {
          payload: {
            source: "google_script",
            url,
            error: "Invalid JSON response",
            rawResponse: text.substring(0, 1000), // Limit size
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Log the successful fetch
      await ctx.runMutation(internal.webhook.insertLog, {
        payload: {
          source: "google_script",
          url,
          status: res.status,
          leadCount: Array.isArray(parsed) ? parsed.length : 0,
          timestamp: new Date().toISOString(),
        },
      });

      // Process leads if we have an array
      if (Array.isArray(parsed) && parsed.length > 0) {
        let created = 0;
        let clubbed = 0;
        let skipped = 0;

        for (const item of parsed) {
          try {
            const leadData = mapColumnDataToLead(item);
            
            // Skip if no essential contact info
            if (!leadData.mobileNo && (!leadData.email || leadData.email === "unknown@example.com")) {
              skipped++;
              continue;
            }

            // Create or club the lead
            const wasCreated = await ctx.runMutation(internal.webhook.createLeadFromGoogleScript, {
              ...leadData,
            });

            if (wasCreated) {
              created++;
            } else {
              clubbed++;
            }
          } catch (error) {
            skipped++;
            // Log individual lead processing errors
            await ctx.runMutation(internal.webhook.insertLog, {
              payload: {
                source: "google_script",
                error: `Lead processing error: ${error}`,
                leadData: item,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }

        // Log summary
        await ctx.runMutation(internal.webhook.insertLog, {
          payload: {
            source: "google_script",
            summary: `Processed ${parsed.length} leads: ${created} created, ${clubbed} clubbed, ${skipped} skipped`,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (e: any) {
      // Log fetch error
      await ctx.runMutation(internal.webhook.insertLog, {
        payload: {
          source: "google_script",
          url,
          error: e?.message || "fetch_error",
          timestamp: new Date().toISOString(),
        },
      });
    }
  },
});

const crons = cronJobs();

// Run every 15 minutes to fetch leads from Google Script
crons.cron(
  "Fetch Google Script leads every 15 minutes",
  "*/15 * * * *",
  internal.crons.fetchGoogleScriptLeads,
  {}
);

// Keep the existing Pharmavends cron but reduce frequency since we're getting data from Google Script
crons.cron(
  "Fetch Pharmavends queries daily 12am IST",
  "30 18 * * *",
  internal.crons.fetchPharmavendsQueries,
  {}
);

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

export default crons;