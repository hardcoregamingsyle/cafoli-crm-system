import { mutation } from "./_generated/server";

// Helper function to normalize phone numbers
function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  
  // Remove all non-digit characters (spaces, dashes, parentheses, letters, etc.)
  let digits = phone.replace(/\D/g, "");
  
  if (!digits) return "";
  
  // If number already has country code (more than 10 digits), preserve it
  if (digits.length > 10) {
    // Return with just digits, no + sign
    return digits;
  }
  
  // If exactly 10 digits, add default country code 91
  if (digits.length === 10) {
    return "91" + digits;
  }
  
  // For shorter numbers, still add 91 prefix
  return "91" + digits;
}

// Public mutation that can be called from the client
export const normalizeAllPhoneNumbers = mutation({
  args: {},
  handler: async (ctx) => {
    try {
      // Get all leads
      const allLeads = await ctx.db.query("leads").collect();
      
      let updatedCount = 0;
      let errorCount = 0;
      
      for (const lead of allLeads) {
        try {
          const patch: Record<string, any> = {};
          
          // Normalize mobileNo
          if (lead.mobileNo) {
            const normalized = normalizePhoneNumber(lead.mobileNo);
            if (normalized !== lead.mobileNo) {
              patch.mobileNo = normalized;
            }
          }
          
          // Normalize altMobileNo
          if (lead.altMobileNo) {
            const normalized = normalizePhoneNumber(lead.altMobileNo);
            if (normalized !== lead.altMobileNo) {
              patch.altMobileNo = normalized;
            }
          }
          
          // Apply patch if there are changes
          if (Object.keys(patch).length > 0) {
            await ctx.db.patch(lead._id, patch);
            updatedCount++;
          }
        } catch (error) {
          console.error(`Error normalizing lead ${lead._id}:`, error);
          errorCount++;
        }
      }
      
      // Also normalize WhatsApp messages
      const allMessages = await ctx.db.query("whatsappMessages").collect();
      
      for (const message of allMessages) {
        try {
          if (message.phoneNumber) {
            const normalized = normalizePhoneNumber(message.phoneNumber);
            if (normalized !== message.phoneNumber) {
              await ctx.db.patch(message._id, { phoneNumber: normalized });
              updatedCount++;
            }
          }
        } catch (error) {
          console.error(`Error normalizing message ${message._id}:`, error);
          errorCount++;
        }
      }
      
      return {
        success: true,
        updatedCount,
        errorCount,
        message: `Normalized ${updatedCount} phone numbers with ${errorCount} errors`,
      };
    } catch (error: any) {
      console.error("Error in normalizeAllPhoneNumbers:", error);
      return {
        success: false,
        updatedCount: 0,
        errorCount: 1,
        message: `Failed to normalize phone numbers: ${error.message || "Unknown error"}`,
      };
    }
  },
});