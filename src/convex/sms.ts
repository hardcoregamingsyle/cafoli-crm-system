"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const send = action({
  args: {
    to: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.SMS_API_KEY;
    if (!apiKey) {
      throw new Error("SMS API key not configured in Convex (SMS_API_KEY).");
    }

    // Ensure the phone number is digits only
    const phoneRaw = String(args.to ?? "").trim();
    const phone = phoneRaw.replace(/[^\d]/g, "");
    if (!phone) {
      throw new Error("Invalid phone number.");
    }

    // Match the provider URL while securely injecting the API key
    // Also explicitly replace {to_be_provided} with the actual phone number
    const phParam = "{to_be_provided}".replace("{to_be_provided}", phone);

    const encodedMsg = encodeURIComponent(args.message);
    const url =
      `http://nimbusit.biz/api/SmsApi/SendSingleApi` +
      `?UserID=cafolibiz` +
      `&Password=${encodeURIComponent(apiKey)}` +
      `&SenderID=CAFOLI` +
      `&Phno=${encodeURIComponent(phParam)}` +
      `&msg=${encodedMsg}` +
      `&EntityID=1701173399090235346` +
      `&TemplateID=1707173753089542085`;

    const res = await fetch(url);
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`SMS API error: HTTP ${res.status} ${res.statusText} - ${text}`);
    }
    return { ok: true, response: text };
  },
});
