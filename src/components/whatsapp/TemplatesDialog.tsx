import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Loader2, Send, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useCrmAuth } from "@/hooks/use-crm-auth";

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
  const navigate = useNavigate();
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col h-[80vh]">
        <DialogHeader>
          <DialogTitle>WhatsApp Templates</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex gap-4 min-h-0">
          {/* Template List */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 pr-4 h-full">
              {!templates ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : templates.length === 0 ? (
                <div className="text-center p-8 text-gray-500">No templates found.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3 pb-4">
                  {templates.map((template: any) => (
                    <Card 
                      key={template._id} 
                      className={`cursor-pointer transition-all border-2 ${previewTemplate?._id === template._id ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:border-gray-200'}`}
                      onClick={() => setPreviewTemplate(template)}
                    >
                      <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between space-y-0">
                        <div className="font-semibold truncate text-sm">{template.name}</div>
                        <Badge className={`${getStatusColor(template.status)} text-white border-none`}>{template.status}</Badge>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 text-xs text-gray-500">
                        <div className="flex gap-2 mb-2">
                          <Badge variant="outline" className="text-[10px] h-5">{template.language}</Badge>
                          <Badge variant="outline" className="text-[10px] h-5">{template.category}</Badge>
                        </div>
                        <div className="line-clamp-2 text-gray-600">
                          {template.components.find((c: any) => c.type === "BODY")?.text || "No body text"}
                        </div>
                      </CardContent>
                      <CardFooter className="p-3 pt-0 flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/whatsapp/create-template?edit=${template._id}`); }}>
                          <Edit className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onSendTemplate(template); }}>
                          <Send className="w-3 h-3 mr-1" /> Send
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Preview Panel */}
          <div className="w-[320px] bg-[#E5DDD5] rounded-lg p-4 hidden md:flex flex-col overflow-hidden border shadow-inner">
             <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider text-center">Preview</div>
             <ScrollArea className="flex-1">
               {previewTemplate ? (
                 <div className="bg-white rounded-lg p-3 shadow-sm max-w-[90%] mx-auto relative">
                   {/* Triangle for message bubble */}
                   <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent"></div>
                   
                   {/* Header */}
                   {previewTemplate.components.find((c: any) => c.type === "HEADER") && (
                     <div className="mb-2 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                       {previewTemplate.components.find((c: any) => c.type === "HEADER").format === "TEXT" ? (
                         <div className="w-full p-2 font-bold text-gray-800 text-sm">
                           {previewTemplate.components.find((c: any) => c.type === "HEADER").text}
                         </div>
                       ) : (
                         <div className="w-full h-24 bg-gray-200 flex items-center justify-center text-gray-400">
                           <span className="text-xs font-bold">{previewTemplate.components.find((c: any) => c.type === "HEADER").format}</span>
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
                     <div className="text-[10px] text-gray-400 mt-1 pt-1">
                       {previewTemplate.components.find((c: any) => c.type === "FOOTER").text}
                     </div>
                   )}
                   
                   {/* Timestamp */}
                   <div className="text-[10px] text-gray-400 text-right mt-1">
                     {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </div>
                 </div>
               ) : (
                 <div className="h-40 flex items-center justify-center text-gray-500 text-sm italic">
                   Select a template to preview
                 </div>
               )}
               
               {/* Buttons Preview (Outside bubble) */}
               {previewTemplate && previewTemplate.components.find((c: any) => c.type === "BUTTONS") && (
                 <div className="mt-2 space-y-1 max-w-[90%] mx-auto">
                   {previewTemplate.components.find((c: any) => c.type === "BUTTONS").buttons.map((btn: any, idx: number) => (
                     <div key={idx} className="bg-white rounded text-center py-2 text-[#00a884] text-sm font-medium shadow-sm">
                       {btn.type === "URL" && "🔗 "}
                       {btn.type === "PHONE_NUMBER" && "📞 "}
                       {btn.type === "COPY_CODE" && "📋 "}
                       {btn.type === "FLOW" && "⚡ "}
                       {btn.type === "QUICK_REPLY" && "↩️ "}
                       {btn.text}
                     </div>
                   ))}
                 </div>
               )}
             </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
