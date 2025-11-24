import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ROLES } from "./schema";
import { internal } from "./_generated/api";

export const createTemplate = mutation({
  args: {
    name: v.string(),
    language: v.string(),
    category: v.string(),
    subCategory: v.optional(v.string()),
    components: v.any(),
    visibility: v.string(),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (!user) throw new Error("User not found");

    // If admin, we mark as "processing" and send to Meta immediately.
    // If not admin, we mark as "pending_approval" (internal).
    
    const isAdmin = user.role === ROLES.ADMIN;
    const initialStatus = isAdmin ? "processing" : "pending_approval";

    const templateId = await ctx.db.insert("whatsappTemplates", {
      name: args.name,
      language: args.language,
      category: args.category,
      subCategory: args.subCategory,
      components: args.components,
      status: initialStatus,
      visibility: args.visibility,
      createdBy: args.currentUserId,
    });

    if (isAdmin) {
      // Schedule the action to submit to Meta
      // Cast to any to avoid type error if api types aren't updated yet
      await ctx.scheduler.runAfter(0, (internal as any).whatsappTemplateActions.submitTemplateToMeta, {
        templateId,
      });
    }

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
              (t.createdBy && t.createdBy === args.currentUserId)
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

export const upsertTemplates = internalMutation({
  args: {
    templates: v.array(v.object({
      name: v.string(),
      language: v.string(),
      category: v.string(),
      components: v.any(),
      status: v.string(),
      wabaTemplateId: v.string(),
    }))
  },
  handler: async (ctx, args) => {
    for (const t of args.templates) {
      // Check if exists by wabaTemplateId
      const existing = await ctx.db
        .query("whatsappTemplates")
        .filter(q => q.eq(q.field("wabaTemplateId"), t.wabaTemplateId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          status: t.status,
          components: t.components,
          category: t.category,
          // Update name/language if they changed on Meta (unlikely for same ID but possible)
          name: t.name,
          language: t.language,
        });
      } else {
        // Check if exists by name and language (legacy or created locally but not linked yet)
        const existingByName = await ctx.db
            .query("whatsappTemplates")
            .filter(q => q.and(
                q.eq(q.field("name"), t.name),
                q.eq(q.field("language"), t.language)
            ))
            .first();
        
        if (existingByName) {
             await ctx.db.patch(existingByName._id, {
                wabaTemplateId: t.wabaTemplateId,
                status: t.status,
                components: t.components,
                category: t.category,
             });
        } else {
            await ctx.db.insert("whatsappTemplates", {
              name: t.name,
              language: t.language,
              category: t.category,
              components: t.components,
              status: t.status,
              wabaTemplateId: t.wabaTemplateId,
              visibility: "public", // Default to public for external templates
              // createdBy is undefined for synced templates
            });
        }
      }
    }
  }
});

export const deleteTemplateInternal = internalMutation({
  args: { templateId: v.id("whatsappTemplates") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.templateId);
  },
});

// Internal functions for Actions

export const getTemplateInternal = internalQuery({
  args: { templateId: v.id("whatsappTemplates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.templateId);
  },
});

export const updateTemplateMetaStatus = internalMutation({
  args: {
    templateId: v.id("whatsappTemplates"),
    status: v.string(),
    wabaTemplateId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = { status: args.status };
    if (args.wabaTemplateId) updates.wabaTemplateId = args.wabaTemplateId;
    if (args.reason) updates.rejectionReason = args.reason;
    
    await ctx.db.patch(args.templateId, updates);
  },
});