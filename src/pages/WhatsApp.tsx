import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery as useConvexQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";

// @ts-ignore - TS2589: Known Convex type inference limitation
const getLeadsWithMessagesQuery: any = (() => api.whatsappPortal.getLeadsWithMessages)();
// @ts-ignore - TS2589: Known Convex type inference limitation
const getLeadMessagesQuery: any = (() => api.whatsappQueries.getLeadMessages)();

export default function WhatsAppPage() {
  const { currentUser, initializeAuth } = useCrmAuth();

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
    selectedLeadId && authReady
      ? { leadId: selectedLeadId as any }
      : "skip"
  );

  const sendMessage = useAction(api.whatsapp.sendMessage);
  const sendTemplateMessage = useAction(api.whatsapp.sendTemplateMessage);

  // Log webhook data to console for debugging
  useEffect(() => {
    if (leadsWithMessages) {
      console.log("[WhatsApp Portal] Leads with messages:", leadsWithMessages);
    }
  }, [leadsWithMessages]);

  useEffect(() => {
    if (messages) {
      console.log("[WhatsApp Portal] Messages for selected lead:", messages);
    }
  }, [messages]);

  // Check if messaging is allowed (lead sent message within 24 hours)
  const isMessagingAllowed = useMemo(() => {
    if (!messages || messages.length === 0) return false;
    
    // Find the last inbound message from the lead
    const inboundMessages = messages.filter((msg: any) => msg.direction === "inbound");
    if (inboundMessages.length === 0) return false;
    
    const lastInboundMessage = inboundMessages[inboundMessages.length - 1];
    const lastInboundTime = lastInboundMessage.timestamp;
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    return (now - lastInboundTime) <= twentyFourHours;
  }, [messages]);

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
    let filtered = leadsWithMessages;

    if (query) {
      filtered = leadsWithMessages.filter((lead: any) => {
        const name = (lead?.name || "").toLowerCase();
        const phone = (lead?.mobileNo || "").toLowerCase();
        const subject = (lead?.subject || "").toLowerCase();
        const message = (lead?.message || "").toLowerCase();
        
        return name.includes(query) || 
               phone.includes(query) || 
               subject.includes(query) || 
               message.includes(query);
      });
    }

    // Sort by lastActivityTime (most recent first), fallback to lastMessageTime, then _creationTime
    return filtered.sort((a: any, b: any) => {
      const aTime = a?.lastActivityTime ?? a?.lastMessageTime ?? a?._creationTime ?? 0;
      const bTime = b?.lastActivityTime ?? b?.lastMessageTime ?? b?._creationTime ?? 0;
      return bTime - aTime;
    });
  }, [leadsWithMessages, searchQuery]);

  // Auth initialization
  useEffect(() => {
    initializeAuth();
    setAuthReady(true);
  }, [initializeAuth]);

  if (!currentUser) return <Layout><div /></Layout>;

  // Helper function to render read receipt icons
  const renderReadReceipt = (status: string | undefined) => {
    if (!status || status === "sent") {
      // Single tick - sent but not delivered
      return <Check className="h-3 w-3 inline ml-1" />;
    } else if (status === "delivered") {
      // Double tick - delivered but not read
      return <CheckCheck className="h-3 w-3 inline ml-1" />;
    } else if (status === "read") {
      // Blue double tick - read
      return <CheckCheck className="h-3 w-3 inline ml-1 text-blue-400" />;
    }
    return null;
  };

  // Helper function to send welcome message
  const handleSendWelcomeMessage = async () => {
    if (!selectedLeadId || !currentUser) return;

    const lead = filteredLeads.find((l: any) => l._id === selectedLeadId);
    if (!lead?.mobileNo) {
      toast.error("Lead has no phone number");
      return;
    }

    try {
      const result = await sendTemplateMessage({
        phoneNumber: lead.mobileNo,
        templateName: "cafoliwelcomemessage",
        languageCode: "en",
        leadId: selectedLeadId as any,
      });
      
      console.log("[WhatsApp] Welcome message sent successfully:", result);
      toast.success("Welcome message sent successfully!");
    } catch (error: any) {
      console.error("[WhatsApp] Failed to send welcome message:", error);
      toast.error(error?.message || "Failed to send welcome message");
    }
  };

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
          <Card className="md:col-span-2 flex flex-col overflow-hidden bg-gray-50">
            {selectedLeadId ? (
              <>
                <CardHeader className="pb-3 border-b bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {filteredLeads.find((l: any) => l._id === selectedLeadId)?.name || "Chat"}
                      </CardTitle>
                      <div className="text-sm text-gray-500">
                        {filteredLeads.find((l: any) => l._id === selectedLeadId)?.mobileNo}
                      </div>
                    </div>
                    {selectedLeadId && !filteredLeads.find((l: any) => l._id === selectedLeadId)?.welcomeMessageSent && (
                      <Button
                        onClick={handleSendWelcomeMessage}
                        variant="outline"
                        size="sm"
                        className="ml-2"
                      >
                        Send Welcome Message
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 bg-[#e5ddd5]">
                  <div className="space-y-2">
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
                            className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
                              msg.direction === "outbound"
                                ? "bg-[#dcf8c6]"
                                : "bg-white"
                            }`}
                          >
                            <div className="text-sm break-words text-gray-900">{msg.message}</div>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[10px] text-gray-500">
                                {new Date(msg.timestamp).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                              {msg.direction === "outbound" && (
                                <span className="text-gray-500">
                                  {renderReadReceipt(msg.status)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </CardContent>
                <div className="p-4 border-t bg-white">
                  {!isMessagingAllowed && (
                    <div className="mb-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      ⚠️ Messaging disabled: Lead hasn't sent a message in the last 24 hours
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder={isMessagingAllowed ? "Type a message..." : "Messaging disabled"}
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && isMessagingAllowed) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="bg-white"
                      disabled={!isMessagingAllowed}
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={!messageInput.trim() || !isMessagingAllowed} 
                      className="bg-[#25d366] hover:bg-[#20bd5a] disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center bg-gray-50">
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
      const result = await sendMessage({
        phoneNumber: lead.mobileNo,
        message: messageInput.trim(),
        leadId: selectedLeadId as any,
      });
      
      console.log("[WhatsApp] Message sent successfully:", result);
      setMessageInput("");
      toast.success("Message sent successfully!");
    } catch (error: any) {
      console.error("[WhatsApp] Failed to send message:", error);
      toast.error(error?.message || "Failed to send message");
    }
  }
}