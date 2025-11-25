import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, CheckCheck } from "lucide-react";

interface LeadListProps {
  leads: any[];
  selectedLeadId: string | null;
  onSelectLead: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showAssignment?: boolean;
}

export function LeadList({
  leads,
  selectedLeadId,
  onSelectLead,
  searchQuery,
  setSearchQuery,
  showAssignment,
}: LeadListProps) {
  const renderReadReceipt = (status: string | undefined) => {
    if (!status || status === "sent") {
      return <Check className="h-3 w-3 inline" />;
    } else if (status === "delivered") {
      return <CheckCheck className="h-3 w-3 inline" />;
    } else if (status === "read") {
      return <CheckCheck className="h-3 w-3 inline text-blue-400" />;
    }
    return null;
  };

  const formatLastMessageTime = (timestamp: number | undefined) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  };

  const truncateMessage = (message: string | undefined, maxLength: number = 37) => {
    if (!message) return "";
    return message.length > maxLength ? message.substring(0, maxLength) + "..." : message;
  };

  return (
    <Card className="md:col-span-1 flex flex-col overflow-hidden h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Leads</CardTitle>
        <Input
          placeholder="Search leads..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mt-2"
        />
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0">
        <div className="space-y-1">
          {leads.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? "No leads match your search" : "No leads available"}
            </div>
          )}
          {leads.map((lead) => (
            <button
              key={lead._id}
              onClick={() => onSelectLead(lead._id)}
              className={`w-full text-left p-3 hover:bg-gray-50 border-b transition-colors ${
                selectedLeadId === lead._id
                  ? "bg-blue-50 border-l-4 border-l-blue-500"
                  : lead.unreadCount > 0
                  ? "bg-green-50 border-l-4 border-l-green-500"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${lead.unreadCount > 0 ? "font-bold" : ""}`}>
                    {lead.name || "Unnamed Lead"}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{lead.mobileNo || "No phone"}</div>
                  {showAssignment && (
                    <div className="text-xs text-purple-600 truncate mt-0.5 font-medium">
                      Assigned: {lead.assignedUserName || "Unassigned"}
                    </div>
                  )}
                  {lead.lastMessage && (
                    <div className={`text-xs mt-1 flex items-center gap-1 ${lead.unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                      <span className="truncate flex-1">
                        {truncateMessage(String(lead.lastMessage), 37)}
                      </span>
                      {lead.lastMessageDirection === "outbound" && (
                        <span className="text-gray-400 shrink-0">
                          {renderReadReceipt(lead.lastMessageStatus)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {lead.unreadCount > 0 && (
                    <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                      {lead.unreadCount}
                    </Badge>
                  )}
                  {lead.lastMessageTime && (
                    <div className="text-xs text-gray-400">
                      {formatLastMessageTime(lead.lastMessageTime)}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}