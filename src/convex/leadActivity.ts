import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Check and auto-unassign inactive leads
export const checkInactiveLeads = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.leadActivity.processInactiveLeads, {});
  },
});

export const processInactiveLeads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allLeads = await ctx.db.query("leads").collect();
    
    for (const lead of allLeads) {
      if (!lead.assignedTo || !lead.assignedDate) continue;
      
      // Get last activity time
      const lastActivity = lead.lastActivityTime || lead.assignedDate;
      const timeSinceActivity = now - lastActivity;
      
      // Calculate inactivity threshold based on status and heat
      let inactivityThreshold = 0;
      const isFirstAssignment = !lead.firstAssignmentDate || lead.firstAssignmentDate === lead.assignedDate;
      
      if (isFirstAssignment) {
        // First assignment: 24 hours
        inactivityThreshold = 24 * 60 * 60 * 1000;
      } else {
        // Subsequent assignments: based on heat and status
        if (lead.heat === "matured") {
          continue; // Mature leads never auto-unassign
        } else if (lead.heat === "hot") {
          inactivityThreshold = 20 * 24 * 60 * 60 * 1000; // 20 days
        } else if (lead.status === "yet_to_decide") {
          inactivityThreshold = 17 * 24 * 60 * 60 * 1000; // 17 days
        } else {
          inactivityThreshold = 15 * 24 * 60 * 60 * 1000; // 15 days default
        }
      }
      
      // Check if lead should be unassigned
      if (timeSinceActivity >= inactivityThreshold) {
        const reassignCount = lead.reassignmentCount || 0;
        
        // If this is second+ assignment and threshold reached, move to masterdata
        if (!isFirstAssignment && reassignCount > 0) {
          // Move to masterdata
          await ctx.db.insert("masterdata", {
            name: lead.name,
            subject: lead.subject || "",
            message: lead.message || "",
            mobileNo: lead.mobileNo,
            email: lead.email,
            altMobileNo: lead.altMobileNo,
            altEmail: lead.altEmail,
            state: lead.state,
            source: lead.source || "",
            station: lead.station,
            district: lead.district,
            pincode: lead.pincode,
            agencyName: lead.agencyName,
            isAssigned: false,
          });
          
          // Add comment
          const systemUser = await ctx.db.query("users").first();
          if (systemUser) {
            await ctx.db.insert("comments", {
              leadId: lead._id,
              userId: systemUser._id,
              content: "Lead moved to masterdata due to prolonged inactivity after reassignment.",
              timestamp: now,
            });
          }
          
          // Delete lead
          await ctx.db.delete(lead._id);
        } else {
          // Just unassign
          await ctx.db.patch(lead._id, {
            assignedTo: undefined,
            assignedDate: undefined,
            reassignmentCount: reassignCount + 1,
          });
          
          // Add comment
          const systemUser = await ctx.db.query("users").first();
          if (systemUser) {
            await ctx.db.insert("comments", {
              leadId: lead._id,
              userId: systemUser._id,
              content: `Lead auto-unassigned due to ${Math.floor(timeSinceActivity / (24 * 60 * 60 * 1000))} days of inactivity.`,
              timestamp: now,
            });
          }
        }
      }
    }
  },
});