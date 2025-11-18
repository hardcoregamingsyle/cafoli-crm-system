import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery as useConvexQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

// @ts-ignore - TS2589: Known Convex type inference limitation
const getLeadsWithMessagesQuery: any = (() => api.whatsappPortal.getLeadsWithMessages)();
// @ts-ignore - TS2589: Known Convex type inference limitation
const getLeadMessagesQuery: any = (() => api.whatsappQueries.getLeadMessages)();

export default function WhatsAppPage() {
  const { currentUser, initializeAuth } = useCrmAuth();
  const navigate = useNavigate();

  // Initialize auth state
  const [authReady, setAuthReady] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // @ts-ignore - Convex type inference limitation
  const leadsWithMessages = useConvexQuery(
    getLeadsWithMessagesQuery,
    currentUser && authReady ? { currentUserId: currentUser._id } : "skip"
  );

  // @ts-ignore - Convex type inference limitation
  const messages = useConvexQuery(
    getLeadMessagesQuery,
    selectedLeadId && currentUser && authReady
      ? { leadId: selectedLeadId as any, currentUserId: currentUser._id }
      : "skip"
  );

  const sendMessage = useAction(api.whatsapp.sendMessage);

  // Auto-scroll to bottom when messages change
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messages && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Filter leads based on search query
  const filteredLeads = useMemo(() => {
    if (!leadsWithMessages) return [];
    
    const query = searchQuery.toLowerCase().trim();
    if (!query) return leadsWithMessages;

    return leadsWithMessages.filter((lead: any) => {
      const name = (lead?.name || "").toLowerCase();
      const phone = (lead?.mobileNo || "").toLowerCase();
      const subject = (lead?.subject || "").toLowerCase();
      const message = (lead?.message || "").toLowerCase();
      
      return name.includes(query) || 
             phone.includes(query) || 
             subject.includes(query) || 
             message.includes(query);
    });
  }, [leadsWithMessages, searchQuery]);

  // Auth initialization
  useEffect(() => {
    initializeAuth();
    setAuthReady(true);
  }, [initializeAuth]);

  // Auth redirect
  useEffect(() => {
    if (authReady && !currentUser) {
      navigate("/login");
    }
  }, [authReady, currentUser, navigate]);

  if (!currentUser) return <Layout><div /></Layout>;

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">WhatsApp Portal</h1>
          <div className="text-sm text-gray-600">
            Showing {filteredLeads.length} of {leadsWithMessages?.length || 0} leads
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
          {/* Left sidebar - Leads list */}
          <Card className="md:col-span-1 flex flex-col overflow-hidden">
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
                {filteredLeads.length === 0 && (
                  <div className="p-4 text-center text-gray-500">
                    {searchQuery ? "No leads match your search" : "No leads available"}
                  </div>
                )}
                {filteredLeads.map((lead: any) => (
                  <button
                    key={lead._id}
                    onClick={() => setSelectedLeadId(lead._id)}
                    className={`w-full text-left p-3 hover:bg-gray-50 border-b transition-colors ${
                      selectedLeadId === lead._id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{lead.name || "Unnamed Lead"}</div>
                        <div className="text-xs text-gray-500 truncate">{lead.mobileNo || "No phone"}</div>
                        {lead.lastMessage && (
                          <div className="text-xs text-gray-400 truncate mt-1">
                            {lead.lastMessage}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {lead.unreadCount > 0 && (
                          <Badge variant="default" className="text-xs">
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

          {/* Right side - Chat area */}
          <Card className="md:col-span-2 flex flex-col overflow-hidden">
            {selectedLeadId ? (
              <>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-lg">
                    {filteredLeads.find((l: any) => l._id === selectedLeadId)?.name || "Chat"}
                  </CardTitle>
                  <div className="text-sm text-gray-500">
                    {filteredLeads.find((l: any) => l._id === selectedLeadId)?.mobileNo}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-3">
                    {!messages || messages.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        No messages yet. Start the conversation!
                      </div>
                    ) : (
                      messages.map((msg: any) => (
                        <div
                          key={msg._id}
                          className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              msg.direction === "outbound"
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 text-gray-900"
                            }`}
                          >
                            <div className="text-sm break-words">{msg.body}</div>
                            <div
                              className={`text-xs mt-1 ${
                                msg.direction === "outbound" ? "text-blue-100" : "text-gray-500"
                              }`}
                            >
                              {new Date(msg.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </CardContent>
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button onClick={handleSendMessage} disabled={!messageInput.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Select a lead to start chatting</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );

  async function handleSendMessage() {
    if (!messageInput.trim() || !selectedLeadId || !currentUser) return;

    const lead = filteredLeads.find((l: any) => l._id === selectedLeadId);
    if (!lead?.mobileNo) {
      toast.error("Lead has no phone number");
      return;
    }

    try {
      await sendMessage({
        phoneNumber: lead.mobileNo,
        message: messageInput.trim(),
        leadId: selectedLeadId as any,
      });
      setMessageInput("");
      toast.success("Message sent");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send message");
    }
  }
}