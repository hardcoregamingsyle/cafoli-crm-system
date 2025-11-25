import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare, Check, CheckCheck, Paperclip, Image, Video, FileText, Music, Smile, Reply, X, Info } from "lucide-react";
import { useState, useEffect } from "react";
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TemplatesDialog } from "./TemplatesDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface ChatAreaProps {
  selectedLeadId: string | null;
  lead: any;
  messages: any[];
  messageInput: string;
  setMessageInput: (val: string) => void;
  handleSendMessage: () => void;
  isMessagingAllowed: boolean;
  selectedFiles: File[];
  handleRemoveFile: (index: number) => void;
  caption: string;
  setCaption: (val: string) => void;
  isUploading: boolean;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSendMedia: () => void;
  handleSendReaction: (messageId: string, emoji: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  replyingTo: any | null;
  setReplyingTo: (msg: any | null) => void;
  onSendTemplate: (template: any) => void;
  currentUser: any;
}

export function ChatArea({
  selectedLeadId,
  lead,
  messages,
  messageInput,
  setMessageInput,
  handleSendMessage,
  isMessagingAllowed,
  selectedFiles,
  handleRemoveFile,
  caption,
  setCaption,
  isUploading,
  handleFileSelect,
  handleSendMedia,
  handleSendReaction,
  fileInputRef,
  messagesEndRef,
  replyingTo,
  setReplyingTo,
  onSendTemplate,
  currentUser,
}: ChatAreaProps) {
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  const comments = useQuery((api as any).comments.getLeadComments, 
    selectedLeadId && currentUser 
      ? { leadId: selectedLeadId, currentUserId: currentUser._id } 
      : "skip"
  ) || [];

  // Close reaction picker when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setReactingTo(null);
    if (reactingTo) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [reactingTo]);

  // Helper function to check if two timestamps are on different days
  const isDifferentDay = (timestamp1: number, timestamp2: number): boolean => {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    return date1.toDateString() !== date2.toDateString();
  };

  // Helper function to format date separator
  const formatDateSeparator = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  };
  
  const renderReadReceipt = (status: string | undefined) => {
    if (!status || status === "sent") {
      return <Check className="h-3 w-3 inline ml-1" />;
    } else if (status === "delivered") {
      return <CheckCheck className="h-3 w-3 inline ml-1" />;
    } else if (status === "read") {
      return <CheckCheck className="h-3 w-3 inline ml-1 text-blue-400" />;
    }
    return null;
  };

  const renderMediaMessage = (msg: any) => {
    if (!msg.mediaType) return null;

    const mediaType = msg.mediaType;
    const mediaUrl = msg.mediaUrl;

    if (mediaType === "image") {
      return (
        <div className="mt-2">
          <img src={mediaUrl} alt="Shared image" className="max-w-full rounded-lg" />
          {msg.caption && <p className="text-sm mt-1">{msg.caption}</p>}
        </div>
      );
    }

    if (mediaType === "video") {
      return (
        <div className="mt-2">
          <video controls className="max-w-full rounded-lg">
            <source src={mediaUrl} />
          </video>
          {msg.caption && <p className="text-sm mt-1">{msg.caption}</p>}
        </div>
      );
    }

    if (mediaType === "audio") {
      return (
        <div className="mt-2">
          <audio controls className="w-full">
            <source src={mediaUrl} />
          </audio>
        </div>
      );
    }

    if (mediaType === "document") {
      return (
        <div className="mt-2 flex items-center gap-2 p-2 bg-gray-100 rounded">
          <FileText className="h-5 w-5" />
          <a href={mediaUrl} download className="text-sm text-blue-600 hover:underline">
            Download Document
          </a>
        </div>
      );
    }

    return null;
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setMessageInput(messageInput + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const onReactionEmojiClick = (emojiData: EmojiClickData, messageId: string) => {
    handleSendReaction(messageId, emojiData.emoji);
    setReactingTo(null);
  };

  if (!selectedLeadId) {
    return (
      <Card className="md:col-span-2 flex flex-col overflow-hidden bg-gray-50 h-full">
        <CardContent className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-500">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Select a lead to start chatting</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="md:col-span-2 flex flex-col overflow-hidden bg-gray-50 h-full">
      <CardHeader className="pb-3 border-b bg-white">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              {lead?.name || "Chat"}
            </CardTitle>
            <div className="text-sm text-gray-500">
              {lead?.mobileNo}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedLeadId && (
              <>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" title="Lead Info">
                      <Info className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Lead Details</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-6">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Subject</h3>
                        <p className="text-sm bg-gray-50 p-2 rounded">{lead?.subject || "No subject"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Message</h3>
                        <p className="text-sm bg-gray-50 p-2 rounded whitespace-pre-wrap">{lead?.message || "No message"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Comments</h3>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                          {comments.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">No comments yet</p>
                          ) : (
                            comments.map((c: any) => (
                              <div key={c._id} className="bg-blue-50 p-3 rounded-lg text-sm border border-blue-100">
                                <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                                  <span className="font-semibold text-blue-700">{c.userName}</span>
                                  <span>{new Date(c.timestamp).toLocaleDateString()}</span>
                                </div>
                                <p className="text-gray-700">{c.content}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                <Button
                  onClick={() => setIsTemplatesOpen(true)}
                  variant="outline"
                  size="sm"
                  className="ml-2"
                >
                  Templates
                </Button>
                <TemplatesDialog 
                  open={isTemplatesOpen} 
                  onOpenChange={setIsTemplatesOpen}
                  onSendTemplate={(template) => {
                    onSendTemplate(template);
                    setIsTemplatesOpen(false);
                  }}
                />
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-4 bg-[#e5ddd5]">
        <div className="space-y-2">
          {!messages || messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg: any, index: number) => {
              const showDateSeparator = index === 0 || isDifferentDay(messages[index - 1].timestamp, msg.timestamp);
              
              return (
                <div key={msg._id}>
                  {/* Date Separator */}
                  {showDateSeparator && (
                    <div className="flex justify-center my-4">
                      <div className="bg-white/90 shadow-sm rounded-lg px-3 py-1 text-xs text-gray-600 font-medium">
                        {formatDateSeparator(msg.timestamp)}
                      </div>
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"} group relative`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
                        msg.direction === "outbound"
                          ? "bg-[#dcf8c6]"
                          : "bg-white"
                      } relative mb-4`}
                    >
                      {/* Reply Context Display */}
                      {msg.replyToMessageId && (
                        <div className={`mb-2 p-2 rounded border-l-4 text-xs ${
                          msg.direction === "outbound" ? "bg-[#cfe9ba] border-[#a6c98c]" : "bg-gray-100 border-gray-300"
                        }`}>
                          <div className="font-semibold text-gray-600 mb-0.5">
                            {msg.replyToSender === lead?.mobileNo ? lead?.name || lead?.mobileNo : "You"}
                          </div>
                          <div className="truncate text-gray-500">
                            {msg.replyToBody || "Original message"}
                          </div>
                        </div>
                      )}

                      <div className="text-sm break-words text-gray-900 whitespace-pre-wrap">{String(msg.message)}</div>
                      {renderMediaMessage(msg)}
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
                      
                      {/* Reaction Display */}
                      {(msg.reactions && msg.reactions.length > 0) || msg.reaction ? (
                        <div className="absolute -bottom-3 right-0 flex gap-1 z-10">
                          {/* Legacy support */}
                          {msg.reaction && !msg.reactions && (
                            <div className="bg-white rounded-full p-0.5 shadow-md border border-gray-100 text-xs">
                              {msg.reaction}
                            </div>
                          )}
                          {/* New reactions array support */}
                          {msg.reactions?.map((r: any, idx: number) => (
                            <div key={idx} className="bg-white rounded-full p-0.5 shadow-md border border-gray-100 text-xs" title={r.from === 'outbound' ? 'You' : 'Lead'}>
                              {r.emoji}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {/* Message Actions (Reply & React) */}
                      {msg.messageId && (
                        <div className={`absolute top-0 ${msg.direction === "outbound" ? "-left-16" : "-right-16"} flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                          <button
                            className="p-1 text-gray-400 hover:text-gray-600 bg-white/50 rounded-full hover:bg-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplyingTo(msg);
                            }}
                            title="Reply"
                          >
                            <Reply className="h-4 w-4" />
                          </button>
                          <button
                            className="p-1 text-gray-400 hover:text-gray-600 bg-white/50 rounded-full hover:bg-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReactingTo(reactingTo === msg._id ? null : msg._id);
                            }}
                            title="React"
                          >
                            <Smile className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {/* Emoji Picker for Reactions */}
                      {reactingTo === msg._id && (
                        <div 
                          className={`absolute top-8 ${msg.direction === "outbound" ? "right-0" : "left-0"} z-50`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="bg-white shadow-xl rounded-lg border border-gray-200">
                            <EmojiPicker 
                              onEmojiClick={(data: EmojiClickData) => onReactionEmojiClick(data, msg.messageId)}
                              width={300}
                              height={350}
                              previewConfig={{ showPreview: false }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
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

        {/* Reply Preview Banner */}
        {replyingTo && (
          <div className="mb-2 p-2 bg-gray-100 rounded border-l-4 border-blue-500 flex justify-between items-center">
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-blue-600 mb-0.5">
                Replying to {replyingTo.direction === "outbound" ? "You" : (lead?.name || lead?.mobileNo)}
              </div>
              <div className="text-sm text-gray-600 truncate">
                {replyingTo.message}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-gray-200 rounded-full"
              onClick={() => setReplyingTo(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {/* File preview */}
        {selectedFiles.length > 0 && (
          <div className="mb-2 p-2 bg-gray-100 rounded space-y-2 max-h-40 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-white p-2 rounded border shadow-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                  {file.type.startsWith("image/") && <Image className="h-4 w-4 flex-shrink-0 text-blue-500" />}
                  {file.type.startsWith("video/") && <Video className="h-4 w-4 flex-shrink-0 text-purple-500" />}
                  {file.type.startsWith("audio/") && <Music className="h-4 w-4 flex-shrink-0 text-green-500" />}
                  {!file.type.startsWith("image/") && !file.type.startsWith("video/") && !file.type.startsWith("audio/") && <FileText className="h-4 w-4 flex-shrink-0 text-gray-500" />}
                  <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                  <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600 rounded-full"
                  onClick={() => handleRemoveFile(index)}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
        
        {/* Caption input for media */}
        {selectedFiles.length > 0 && (
          <Input
            placeholder="Add a caption (sent with first file)..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="mb-2 bg-white"
          />
        )}
        
        <div className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            onChange={handleFileSelect}
            disabled={!isMessagingAllowed}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isMessagingAllowed || isUploading}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" disabled={!isMessagingAllowed}>
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-none shadow-none" side="top" align="start">
              <EmojiPicker 
                onEmojiClick={onEmojiClick}
                width={300}
                height={400}
                previewConfig={{ showPreview: false }}
              />
            </PopoverContent>
          </Popover>

          <Textarea
            placeholder={
              selectedFiles.length > 0
                ? "Use caption field above..." 
                : (isMessagingAllowed ? "Type a message..." : "Messaging disabled")
            }
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && isMessagingAllowed && selectedFiles.length === 0) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="bg-white min-h-[40px] max-h-[120px] flex-1"
            disabled={!isMessagingAllowed || isUploading || selectedFiles.length > 0}
          />
          <Button 
            onClick={selectedFiles.length > 0 ? handleSendMedia : handleSendMessage}
            disabled={(!messageInput.trim() && selectedFiles.length === 0) || !isMessagingAllowed || isUploading} 
            className="bg-[#25d366] hover:bg-[#20bd5a] disabled:opacity-50"
          >
            {isUploading ? "..." : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}