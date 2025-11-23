import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ROLES } from "./schema";

export const createTemplate = mutation({
  args: {
    name: v.string(),
    language: v.string(),
    category: v.string(),
    components: v.any(),
    visibility: v.string(),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) throw new Error("User not found");

    // In a real implementation, this would also trigger an action to submit to WhatsApp API
    // For now, we store it as "pending" (internal approval or waiting for submission)
    
    const templateId = await ctx.db.insert("whatsappTemplates", {
      name: args.name,
      language: args.language,
      category: args.category,
      components: args.components,
      status: "pending",
      visibility: args.visibility,
      createdBy: args.currentUserId,
    });

    return templateId;
  },
});

export const getTemplates = query({
  args: {
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    let templates = await ctx.db.query("whatsappTemplates").collect();

    if (args.currentUserId) {
      const user = await ctx.db.get(args.currentUserId);
      if (user) {
        // Filter: Show Public templates OR Private templates created by this user
        // Admins see all
        if (user.role !== ROLES.ADMIN) {
          templates = templates.filter(
            (t) =>
              t.visibility === "public" ||
              t.createdBy === args.currentUserId
          );
        }
      }
    }

    return templates.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const updateTemplateStatus = mutation({
  args: {
    templateId: v.id("whatsappTemplates"),
    status: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.templateId, {
      status: args.status,
      rejectionReason: args.reason,
    });
  },
});
