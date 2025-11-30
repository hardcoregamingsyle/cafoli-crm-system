"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const sendCustomEmail = action({
  args: {
    currentUserId: v.id("users"),
    to: v.string(),
    subject: v.string(),
    htmlContent: v.optional(v.string()),
    textContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user exists
    const user = await ctx.runQuery(internal.users.getUser, { userId: args.currentUserId });
    if (!user) {
      throw new Error("User not found");
    }

    // Get available API key
    const availableKey: any = await ctx.runQuery(internal.emailKeys.getAvailableKey, {});
    let apiKey: string | null = availableKey?.apiKey ?? null;
    let usingDbKey = !!apiKey;

    // Fallback to env key
    if (!apiKey) {
      const envKey = process.env.BREVO_API_KEY || process.env.BREVO_API_TOKEN || null;
      if (!envKey) {
        console.error("❌ No Brevo API key found");
        await ctx.runMutation(internal.emailKeys.enqueueEmail, {
          to: args.to,
          subject: args.subject,
          text: args.textContent || "",
        });
        return { queued: true, reason: "No available API key - configure in /admin panel" };
      }
      apiKey = envKey;
      console.log("⚠️ Using Brevo API key from environment variables");
    } else {
      console.log(`✅ Using admin-configured API key: ${availableKey.name}`);
    }

    // Build Brevo payload
    const payload: any = {
      sender: { email: "welcome@mail.skinticals.com", name: "Cafoli Lifecare" },
      to: [{ email: args.to }],
      subject: args.subject,
    };

    if (args.htmlContent) {
      payload.htmlContent = args.htmlContent;
    }
    if (args.textContent) {
      payload.textContent = args.textContent;
    }

    // Send via Brevo API
    const res: any = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`Brevo API error: ${res.status} ${res.statusText}`, errText);
      await ctx.runMutation(internal.emailKeys.enqueueEmail, {
        to: args.to,
        subject: args.subject,
        text: args.textContent || "",
      });
      return { queued: true, reason: `Brevo error: ${res.status} ${res.statusText}` };
    }

    console.log(`✅ Custom email sent successfully to ${args.to}`);

    // Increment key usage
    if (usingDbKey && availableKey?._id) {
      await ctx.runMutation(internal.emailKeys.incrementKeySent, {
        keyId: availableKey._id,
        by: 1,
      });
    }

    try {
      return await res.json();
    } catch {
      return { ok: true, sent: true };
    }
  },
});
