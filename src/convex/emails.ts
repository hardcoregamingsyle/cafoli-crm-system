"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const sendRelevant = internalAction({
  args: {
    to: v.string(),
  },
  handler: async (ctx, args) => {
    // Build message
    const subject = "Welcome to Cafoli Lifecare. Your Success Journey Begins Now.";
    const text =
      "Thank you for Joining with Cafoli Lifecare Pvt. Ltd. We hope that we Achive Great Success Together. Please Check out our Social Media and Website to Know more.\n" +
      "Facebook: https://www.facebook.com/cafolilife\n" +
      "Twitter(X): https://x.com/cafoli0215979\n" +
      "Instagram: https://www.instagram.com/cafolilifecare/\n" +
      "#LinkedIn: https://www.linkedin.com/in/cafolilifecarepvtltd?original_referer=https%3A%2F%2Fcafoli.in%2F\n" +
      "Whatsapp: https://api.whatsapp.com/send?phone=+919518447302&text=I%20am%20interested%20in%20Cafoli%20Products.%20Could%20you%20please%20provide%20me%20with%20more%20information\n" +
      "Website: https://Cafoli.in\n" +
      "Email: info@cafoli.in\n" +
      "Phone No: +91 9518447302";

    // 1) Try to pick an available key from DB (admin-configured keys)
    const availableKey: any = await ctx.runQuery((internal as any).emailKeys.getAvailableKey, {});
    let apiKey: string | null = availableKey?.apiKey ?? null;
    let usingDbKey = !!apiKey;

    // 2) Fallback to single BREVO_API_KEY from env if no DB key available
    if (!apiKey) {
      const envKey =
        process.env.BREVO_API_KEY ||
        process.env.BREVO_API_TOKEN ||
        null;
      if (!envKey) {
        console.error("❌ No Brevo API key found. Please configure API keys in /admin panel or set BREVO_API_KEY environment variable");
        // No keys available: enqueue
        await ctx.runMutation((internal as any).emailKeys.enqueueEmail, {
          to: args.to,
          subject,
          text,
        });
        return { queued: true, reason: "No available API key - configure in /admin panel" };
      }
      apiKey = envKey;
      console.log("⚠️ Using Brevo API key from environment variables (fallback). Configure keys in /admin panel for better management.");
    } else {
      console.log(`✅ Using admin-configured API key: ${availableKey.name} (${availableKey.sentToday ?? 0}/${availableKey.dailyLimit ?? 295} sent today)`);
    }

    // Brevo payload and request
    const payload = {
      sender: { email: "welcome@mail.skinticals.com", name: "Cafoli Lifecare" },
      to: [{ email: args.to }],
      subject,
      textContent: text,
    };

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
      // If sending failed (e.g., quota), enqueue and return
      await ctx.runMutation((internal as any).emailKeys.enqueueEmail, {
        to: args.to,
        subject,
        text,
      });
      return { queued: true, reason: `Brevo error: ${res.status} ${res.statusText} - ${errText}` };
    }

    console.log(`✅ Email sent successfully to ${args.to}`);

    // Success: increment key usage if we used a DB-managed key
    if (usingDbKey && availableKey?._id) {
      await ctx.runMutation((internal as any).emailKeys.incrementKeySent, {
        keyId: availableKey._id,
        by: 1,
      });
      console.log(`📊 Updated usage count for key: ${availableKey.name}`);
    }

    try {
      return await res.json();
    } catch {
      return { ok: true };
    }
  },
});

export const processQueue = internalAction({
  args: { maxToSend: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batch = await ctx.runQuery((internal as any).emailKeys.getQueuedBatch, {
      limit: args.maxToSend ?? 100,
    });
    if (batch.length === 0) return { processed: 0 };

    let processed = 0;

    for (const item of batch) {
      // Select a key for each send; if none available, stop early
      const key: any = await ctx.runQuery((internal as any).emailKeys.getAvailableKey, {});
      let apiKey: string | null = key?.apiKey ?? null;
      let usingDbKey = !!apiKey;

      if (!apiKey) {
        const envKey =
          process.env.BREVO_API_KEY ||
          process.env.BREVO_API_TOKEN ||
          null;
        if (!envKey) {
          console.log("⚠️ No API keys available for queue processing. Configure keys in /admin panel.");
          // No keys at all; skip processing further
          break;
        }
        apiKey = envKey;
      }

      const payload = {
        sender: { email: "welcome@mail.skinticals.com", name: "Cafoli Lifecare" },
        to: [{ email: item.to }],
        subject: item.subject,
        textContent: item.text,
      };

      try {
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
          await ctx.runMutation((internal as any).emailKeys.markFailed, {
            id: item._id,
            error: `HTTP ${res.status} ${res.statusText} ${errText}`,
          });
          continue;
        }

        // Mark sent + increment key usage if DB key
        await ctx.runMutation((internal as any).emailKeys.markSent, { id: item._id });
        if (usingDbKey && key?._id) {
          await ctx.runMutation((internal as any).emailKeys.incrementKeySent, {
            keyId: key._id,
            by: 1,
          });
        }
        processed++;
      } catch (e: any) {
        await ctx.runMutation((internal as any).emailKeys.markFailed, {
          id: item._id,
          error: String(e?.message || e || "unknown error"),
        });
      }
    }

    return { processed };
  },
});