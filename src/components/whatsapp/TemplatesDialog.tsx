import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Loader2, Send, Edit, RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface TemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendTemplate: (template: any) => void;
}

export function TemplatesDialog({ open, onOpenChange, onSendTemplate }: TemplatesDialogProps) {
  const { currentUser } = useCrmAuth();
  const templates = useQuery(api.whatsappTemplates.getTemplates, 
    currentUser ? { currentUserId: currentUser._id } : "skip"
  );
  const syncTemplates = useAction(api.whatsappTemplateActions.syncTemplates);
  const navigate = useNavigate();
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncTemplates();
      toast.success(`Synced ${result.count} templates from Meta`);
    } catch (error: any) {
      console.error("Sync failed:", error);
      toast.error("Failed to sync templates: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved": return "bg-green-500 hover:bg-green-600";
      case "rejected": return "bg-red-500 hover:bg-red-600";
      case "pending": 
      case "pending_approval":
      case "processing": return "bg-yellow-500 hover:bg-yellow-600";
      default: return "bg-gray-500 hover:bg-gray-600";
    }
  };

  const filteredTemplates = templates?.filter((t: any) => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0 bg-white shrink-0">
          <div className="flex items-center gap-4">
            <DialogTitle className="text-xl">WhatsApp Templates</DialogTitle>
            <Badge variant="secondary" className="hidden sm:flex">
              {templates?.length || 0} Templates
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64 hidden sm:block">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSync} 
              disabled={isSyncing}
              className="gap-2 h-9"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync from Meta"}
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex overflow-hidden bg-gray-50/50">
          {/* Template List */}
          <div className="flex-1 flex flex-col min-w-[350px] border-r bg-white h-full overflow-hidden">
            <div className="p-4 sm:hidden border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <ScrollArea className="flex-1 h-full">
              <div className="p-4 space-y-3">
                {!templates ? (
                  <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : filteredTemplates?.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No templates found.</div>
                ) : (
                  filteredTemplates?.map((template: any) => (
                    <Card 
                      key={template._id} 
                      className={`cursor-pointer transition-all hover:shadow-md ${previewTemplate?._id === template._id ? 'ring-2 ring-blue-500 bg-blue-50/30' : 'hover:border-blue-200'}`}
                      onClick={() => setPreviewTemplate(template)}
                    >
                      <CardHeader className="p-3 pb-2 flex flex-row items-start justify-between space-y-0">
                        <div>
                          <div className="font-semibold text-sm truncate max-w-[200px]">{template.name}</div>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">{template.language}</Badge>
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">{template.category}</Badge>
                          </div>
                        </div>
                        <Badge className={`${getStatusColor(template.status)} text-white border-none text-[10px] h-5`}>
                          {template.status}
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-3 pt-1 text-xs text-muted-foreground">
                        <div className="line-clamp-2 text-gray-600">
                          {template.components.find((c: any) => c.type === "BODY")?.text || "No body text"}
                        </div>
                      </CardContent>
                      <CardFooter className="p-3 pt-0 flex justify-end gap-2">
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={(e) => { e.stopPropagation(); navigate(`/whatsapp/create-template?edit=${template._id}`); }}>
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" className="h-7 text-xs px-3 bg-[#00a884] hover:bg-[#008f6f]" onClick={(e) => { e.stopPropagation(); onSendTemplate(template); }}>
                          <Send className="w-3 h-3 mr-1" /> Send
                        </Button>
                      </CardFooter>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Preview Panel */}
          <div className="w-[400px] bg-[#F0F2F5] flex flex-col border-l hidden md:flex shrink-0">
             <div className="p-3 border-b bg-white flex items-center justify-between shadow-sm z-10">
                <span className="font-semibold text-sm text-gray-700">Preview</span>
                {previewTemplate && (
                  <Button size="sm" className="h-7 text-xs bg-[#00a884] hover:bg-[#008f6f]" onClick={() => onSendTemplate(previewTemplate)}>
                    <Send className="w-3 h-3 mr-1" /> Send Template
                  </Button>
                )}
             </div>
             <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center bg-[#efeae2] bg-opacity-50 relative">
               {/* WhatsApp Background Pattern */}
               <div className="absolute inset-0 opacity-10 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat pointer-events-none"></div>
               
               {previewTemplate ? (
                 <div className="w-full max-w-[320px] space-y-2 z-10">
                   <div className="bg-white rounded-lg p-1 shadow-sm relative rounded-tl-none ml-2 filter drop-shadow-sm">
                     {/* Triangle for message bubble */}
                     <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent filter drop-shadow-sm"></div>
                     
                     <div className="p-3 pb-1">
                       {/* Header */}
                       {previewTemplate.components.find((c: any) => c.type === "HEADER") && (
                         <div className="mb-2 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                           {previewTemplate.components.find((c: any) => c.type === "HEADER").format === "TEXT" ? (
                             <div className="w-full font-bold text-gray-800 text-sm">
                               {previewTemplate.components.find((c: any) => c.type === "HEADER").text}
                             </div>
                           ) : (
                             <div className="w-full h-32 bg-gray-200 flex items-center justify-center text-gray-400 rounded">
                               <div className="flex flex-col items-center">
                                 <span className="text-2xl mb-1">📷</span>
                                 <span className="text-xs font-bold uppercase">{previewTemplate.components.find((c: any) => c.type === "HEADER").format}</span>
                               </div>
                             </div>
                           )}
                         </div>
                       )}
                       
                       {/* Body */}
                       <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                         {previewTemplate.components.find((c: any) => c.type === "BODY")?.text}
                       </div>
                       
                       {/* Footer */}
                       {previewTemplate.components.find((c: any) => c.type === "FOOTER") && (
                         <div className="text-[11px] text-gray-400 mt-2">
                           {previewTemplate.components.find((c: any) => c.type === "FOOTER").text}
                         </div>
                       )}
                     </div>

                     {/* Timestamp */}
                     <div className="text-[10px] text-gray-400 text-right px-2 pb-1">
                       {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     </div>
                   </div>

                   {/* Buttons Preview (Outside bubble) */}
                   {previewTemplate.components.find((c: any) => c.type === "BUTTONS") && (
                     <div className="space-y-1.5 pt-1">
                       {previewTemplate.components.find((c: any) => c.type === "BUTTONS").buttons.map((btn: any, idx: number) => (
                         <div key={idx} className="bg-white rounded text-center py-2.5 text-[#00a884] text-sm font-medium shadow-sm cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                           {btn.type === "URL" && <span>🔗</span>}
                           {btn.type === "PHONE_NUMBER" && <span>📞</span>}
                           {btn.type === "COPY_CODE" && <span>📋</span>}
                           {btn.type === "FLOW" && <span>⚡</span>}
                           {btn.type === "QUICK_REPLY" && <span>↩️</span>}
                           {btn.text}
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                   <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                     <Send className="w-8 h-8 text-gray-400 ml-1" />
                   </div>
                   <p className="text-sm font-medium">Select a template to preview</p>
                   <p className="text-xs mt-1 max-w-[200px]">Choose a template from the list on the left to see how it looks.</p>
                 </div>
               )}
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}