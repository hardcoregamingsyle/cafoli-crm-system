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

// Update: Run every 2 minutes to fetch leads from Google Script (Convex doesn't support seconds granularity)
crons.interval(
  "Fetch Google Script leads every 2 minutes",
  { minutes: 2 },
  internal.crons.fetchGoogleScriptLeads,
  {}
);

// Add default export required by Convex
export default crons;