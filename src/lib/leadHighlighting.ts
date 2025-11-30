// Lead highlighting and sorting utilities

export interface LeadHighlight {
  borderColor: string;
  priority: number;
}

export function getLeadHighlight(lead: any): LeadHighlight | null {
  const now = Date.now();
  
  // Check for inactivity highlighting (highest priority)
  if (lead.assignedTo && lead.lastActivityTime) {
    const timeSinceActivity = now - lead.lastActivityTime;
    const daysSinceActivity = timeSinceActivity / (24 * 60 * 60 * 1000);
    
    let inactivityThreshold = 0;
    if (lead.status === "relevant") {
      inactivityThreshold = 3;
    } else if (lead.status === "yet_to_decide") {
      inactivityThreshold = 2;
    } else if (lead.heat === "matured") {
      inactivityThreshold = 15;
    } else if (lead.heat === "hot") {
      inactivityThreshold = 5;
    }
    
    if (inactivityThreshold > 0 && daysSinceActivity >= inactivityThreshold) {
      return { borderColor: "border-l-4 border-l-orange-500 bg-orange-50", priority: 0 };
    }
  }
  
  // Check for followup highlighting
  if (lead.nextFollowup) {
    const timeUntilFollowup = lead.nextFollowup - now;
    const minutesUntilFollowup = timeUntilFollowup / (60 * 1000);
    
    if (timeUntilFollowup < 0) {
      // Overdue
      return { borderColor: "border-l-4 border-l-red-500 bg-red-50", priority: 1 };
    } else if (minutesUntilFollowup <= 15) {
      // 15 minutes or less
      return { borderColor: "border-l-4 border-l-yellow-400 bg-yellow-50", priority: 2 };
    } else if (minutesUntilFollowup <= 30) {
      // 30 minutes or less
      return { borderColor: "border-l-4 border-l-green-400 bg-green-50", priority: 3 };
    }
  }
  
  return null;
}

export function sortLeadsForMyLeads(leads: any[]): any[] {
  return [...leads].sort((a, b) => {
    const aHighlight = getLeadHighlight(a);
    const bHighlight = getLeadHighlight(b);
    
    // Sort by highlight priority first
    if (aHighlight && bHighlight) {
      if (aHighlight.priority !== bHighlight.priority) {
        return aHighlight.priority - bHighlight.priority;
      }
    } else if (aHighlight) {
      return -1;
    } else if (bHighlight) {
      return 1;
    }
    
    // Then sort by followup time
    const aHasFollowup = a.nextFollowup ? 1 : 0;
    const bHasFollowup = b.nextFollowup ? 1 : 0;
    
    if (aHasFollowup !== bHasFollowup) {
      return bHasFollowup - aHasFollowup; // Leads with followup first
    }
    
    if (aHasFollowup && bHasFollowup) {
      // Both have followups: sort by closest first
      return a.nextFollowup - b.nextFollowup;
    }
    
    // No followups: sort by creation time (newest first)
    return b._creationTime - a._creationTime;
  });
}