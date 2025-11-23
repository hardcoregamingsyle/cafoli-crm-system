import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface LeadListProps {
  leads: any[];
  selectedLeadId: string | null;
  onSelectLead: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function LeadList({
  leads,
  selectedLeadId,
  onSelectLead,
  searchQuery,
  setSearchQuery,
}: LeadListProps) {
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
                  {lead.lastMessage && (
                    <div className={`text-xs truncate mt-1 ${lead.unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                      {String(lead.lastMessage)}
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
                      {new Date(lead.lastMessageTime).toLocaleDateString()}
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
