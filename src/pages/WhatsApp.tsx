import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery as useConvexQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { Layout } from "@/components/Layout";
import { toast } from "sonner";
import { LeadList } from "@/components/whatsapp/LeadList";
import { ChatArea } from "@/components/whatsapp/ChatArea";

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const sendMediaMessage = useAction(api.whatsapp.sendMediaMessage);
  const sendReaction = useAction(api.whatsapp.sendReaction);
  const markAsRead = useAction(api.whatsapp.markAsRead);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  // Mark messages as read when lead is selected or new messages arrive
  useEffect(() => {
    if (selectedLeadId && authReady && messages) {
      const hasUnread = messages.some((msg: any) => msg.direction === "inbound" && msg.status !== "read");
      const lead = leadsWithMessages?.find((l: any) => l._id === selectedLeadId);
      
      if (hasUnread || (lead && lead.unreadCount > 0)) {
        markAsRead({ leadId: selectedLeadId as any });
      }
    }
  }, [selectedLeadId, authReady, messages, leadsWithMessages, markAsRead]);

  // Clear reply when changing leads
  useEffect(() => {
    if (selectedLeadId) {
      setReplyingTo(null);
    }
  }, [selectedLeadId]);

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

  // Helper function to get media type from file
  const getMediaType = (file: File): string => {
    const mimeType = file.type;
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    return "document";
  };

  // Helper function to handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      
      // Validate file size (max 16MB for most media, 100MB for videos)
      const validFiles = newFiles.filter(file => {
        const maxSize = file.type.startsWith("video/") ? 100 * 1024 * 1024 : 16 * 1024 * 1024;
        if (file.size > maxSize) {
          toast.error(`File ${file.name} too large. Max size: ${maxSize / (1024 * 1024)}MB`);
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...validFiles]);

        // Automatically set message as caption if present (only if caption is empty)
        if (messageInput.trim() && !caption) {
          setCaption(messageInput);
          setMessageInput("");
        }
      }
    }
    
    // Reset input value to allow selecting the same file again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Helper function to remove a file
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Helper function to send media message
  const handleSendMedia = async () => {
    if (selectedFiles.length === 0 || !selectedLeadId || !currentUser) return;

    const lead = filteredLeads.find((l: any) => l._id === selectedLeadId);
    if (!lead?.mobileNo) {
      toast.error("Lead has no phone number");
      return;
    }

    setIsUploading(true);
    try {
      // Loop through all selected files
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // 1. Get upload URL
        const postUrl = await generateUploadUrl();
        
        // 2. Upload file
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        
        if (!result.ok) {
          throw new Error(`Upload failed for ${file.name}: ${result.statusText}`);
        }
        
        const { storageId } = await result.json();

        // 3. Send message with storage ID
        const mediaType = getMediaType(file);
        
        // Attach caption only to the first file
        const fileCaption = i === 0 ? caption : undefined;

        await sendMediaMessage({
          phoneNumber: lead.mobileNo,
          mediaType,
          mediaStorageId: storageId,
          caption: fileCaption,
          filename: file.name,
          leadId: selectedLeadId as any,
        });
      }
      
      console.log("[WhatsApp] All media messages sent successfully");
      setSelectedFiles([]);
      setCaption("");
      toast.success("All media sent successfully!");
    } catch (error: any) {
      console.error("[WhatsApp] Failed to send media:", error);
      toast.error(error?.message || "Failed to send media");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendReaction = async (messageId: string, emoji: string) => {
    if (!selectedLeadId || !currentUser) return;
    const lead = filteredLeads.find((l: any) => l._id === selectedLeadId);
    if (!lead?.mobileNo) return;

    try {
      await sendReaction({
        phoneNumber: lead.mobileNo,
        messageId,
        emoji,
        leadId: selectedLeadId as any,
      });
      toast.success("Reaction sent");
    } catch (error: any) {
      console.error("[WhatsApp] Failed to send reaction:", error);
      toast.error("Failed to send reaction");
    }
  };

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
        replyToMessageId: replyingTo?.messageId,
      });
      
      console.log("[WhatsApp] Message sent successfully:", result);
      setMessageInput("");
      setReplyingTo(null);
      toast.success("Message sent successfully!");
    } catch (error: any) {
      console.error("[WhatsApp] Failed to send message:", error);
      toast.error(error?.message || "Failed to send message");
    }
  }

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
          <LeadList
            leads={filteredLeads}
            selectedLeadId={selectedLeadId}
            onSelectLead={setSelectedLeadId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />

          <ChatArea
            selectedLeadId={selectedLeadId}
            lead={filteredLeads.find((l: any) => l._id === selectedLeadId)}
            messages={messages}
            messageInput={messageInput}
            setMessageInput={setMessageInput}
            handleSendMessage={handleSendMessage}
            handleSendWelcomeMessage={handleSendWelcomeMessage}
            isMessagingAllowed={isMessagingAllowed}
            selectedFiles={selectedFiles}
            handleRemoveFile={handleRemoveFile}
            caption={caption}
            setCaption={setCaption}
            isUploading={isUploading}
            handleFileSelect={handleFileSelect}
            handleSendMedia={handleSendMedia}
            handleSendReaction={handleSendReaction}
            fileInputRef={fileInputRef}
            messagesEndRef={messagesEndRef}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
          />
        </div>
      </div>
    </Layout>
  );
}