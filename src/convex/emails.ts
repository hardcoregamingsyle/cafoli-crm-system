"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const sendRelevant = internalAction({
  args: {
    to: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey =
      process.env.RESEND_API_KEY ||
      process.env.RESEND_API_TOKEN ||
      process.env.RESEND_KEY;
    if (!apiKey) {
      throw new Error("Resend API key not configured in Convex (RESEND_API_KEY).");
    }

    const payload = {
      from: "intro@mail.skinticals.com",
      to: [args.to],
      subject: "Test",
      text: "Test",
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Resend API error: HTTP ${res.status} ${res.statusText} - ${errText}`);
    }

    // Best-effort parse
    try {
      return await res.json();
    } catch {
      return { ok: true };
    }
  },
});
