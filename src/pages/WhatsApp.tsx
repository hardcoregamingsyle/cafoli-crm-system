import { useState, useEffect, useRef } from "react";
import { useQuery as useConvexQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Search, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

// @ts-ignore - TS2589: Known Convex type inference limitation
const getLeadsWithMessagesQuery: any = (() => api.whatsappPortal.getLeadsWithMessages)();
// @ts-ignore - TS2589: Known Convex type inference limitation
const getLeadMessagesQuery: any = (() => api.whatsappQueries.getLeadMessages)();

export default function WhatsAppPage() {
  const { currentUser } = useCrmAuth();
  const [selectedLeadId, setSelectedLeadId] = useState<Id<"leads"> | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // @ts-ignore - TS2589: Known Convex type inference limitation
  const leadsWithMessages: any = useConvexQuery(
    getLeadsWithMessagesQuery,
    currentUser?._id ? { currentUserId: currentUser._id } : ("skip" as any)
  ) as any;

  // @ts-ignore - TS2589: Known Convex type inference limitation
  const messages: any = useConvexQuery(
    getLeadMessagesQuery,
    selectedLeadId ? { leadId: selectedLeadId } : ("skip" as any)
  ) as any;

  const sendMessage = useAction(api.whatsapp.sendMessage);

  const selectedLead = leadsWithMessages?.find((l: any) => l._id === selectedLeadId);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedLead) return;

    try {
      await sendMessage({
        phoneNumber: selectedLead.mobileNo,
        message: messageText,
        leadId: selectedLead._id,
      });
      setMessageText("");
      toast.success("Message sent successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    }
  };

  const filteredLeads = leadsWithMessages?.filter((lead: any) =>
    lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.mobileNo.includes(searchQuery) ||
    lead.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentUser) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <p>Please log in to access WhatsApp portal</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />
            WhatsApp Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentUser.role === "admin"
              ? "Chat with all leads"
              : "Chat with your assigned leads"}
          </p>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Leads List Sidebar */}
          <div className="w-80 border-r flex flex-col">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {filteredLeads && filteredLeads.length > 0 ? (
                <div className="divide-y">
                  {filteredLeads.map((lead: any) => (
                    <div
                      key={lead._id}
                      onClick={() => setSelectedLeadId(lead._id)}
                      className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                        selectedLeadId === lead._id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">{lead.name}</h3>
                            {lead.unreadCount > 0 && (
                              <Badge variant="destructive" className="h-5 min-w-5 px-1.5">
                                {lead.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Phone className="h-3 w-3" />
                            <span>{lead.mobileNo}</span>
                          </div>
                          {lead.lastMessage && (
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {lead.lastMessage.direction === "outbound" ? "You: " : ""}
                              {lead.lastMessage.message}
                            </p>
                          )}
                        </div>
                        {lead.lastMessage && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {new Date(lead.lastMessage.timestamp).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>No leads found</p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedLead ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b bg-muted/30">
                  <h2 className="font-semibold">{selectedLead.name}</h2>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {selectedLead.mobileNo}
                    </span>
                    <span>{selectedLead.email}</span>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages && messages.length > 0 ? (
                      messages.map((msg: any) => (
                        <div
                          key={msg._id}
                          className={`flex ${
                            msg.direction === "outbound" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              msg.direction === "outbound"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm">{msg.message}</p>
                            <span className="text-xs opacity-70 mt-1 block">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>No messages yet. Start a conversation!</p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button onClick={handleSendMessage} disabled={!messageText.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Select a lead to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}