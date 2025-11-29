import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Auto-unassign feature disabled
// crons.interval(
//   "check inactive leads",
//   { hours: 6 },
//   internal.leadActivity.checkInactiveLeads,
//   {}
// );

// Reset email API key daily counts at midnight
crons.cron(
  "reset email daily counts",
  "0 0 * * *",
  (internal as any).emailKeys.resetDailyCounts,
  {}
);

// Shortly after midnight: process queued emails using fresh limits
crons.cron(
  "process email queue after reset",
  "5 0 * * *",
  (internal as any).emails.processQueue,
  { maxToSend: 500 }
);

// Optionally, process queue every hour to drain with available quotas
crons.cron(
  "process email queue hourly",
  "0 * * * *",
  (internal as any).emails.processQueue,
  { maxToSend: 200 }
);

// Update: Run every 2 minutes to fetch leads from Google Script (Convex doesn't support seconds granularity)
// COMMENTED OUT: Function does not exist
// crons.interval(
//   "Fetch Google Script leads every 5 minutes",
//   { minutes: 5 },
//   (internal as any).crons.fetchGoogleScriptLeads,
//   {}
// );

// NEW: Sync WhatsApp templates from Meta every 30 minutes
crons.interval(
  "Sync WhatsApp templates from Meta",
  { minutes: 30 },
  (internal as any).whatsappTemplateActions.syncTemplates,
  {}
);

crons.interval(
  "fetch pharmavends leads",
  { minutes: 5 },
  (internal as any).webhook.fetchPharmavendsLeads,
  {}
);

// Add default export required by Convex
export default crons;