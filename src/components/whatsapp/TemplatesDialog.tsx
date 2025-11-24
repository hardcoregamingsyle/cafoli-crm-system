import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { Loader2, Send, Edit, RefreshCw, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const deleteTemplate = useAction(api.whatsappTemplateActions.deleteTemplate);
  const navigate = useNavigate();
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<any | null>(null);

  // Auto-select first template if none selected
  useEffect(() => {
    if (templates && templates.length > 0 && !previewTemplate) {
      setPreviewTemplate(templates[0]);
    }
  }, [templates, previewTemplate]);

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

  const handleDeleteClick = (e: React.MouseEvent, template: any) => {
    e.stopPropagation();
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteTemplate({
        templateId: templateToDelete._id,
        name: templateToDelete.name,
      });
      toast.success("Template deleted successfully");
      if (previewTemplate?._id === templateToDelete._id) {
        setPreviewTemplate(null);
      }
    } catch (error: any) {
      console.error("Delete failed:", error);
      toast.error("Failed to delete template: " + error.message);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[90vw] w-[1200px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white rounded-xl shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0 bg-white shrink-0">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-xl font-bold text-gray-800">WhatsApp Templates</DialogTitle>
              <Badge variant="secondary" className="hidden sm:flex bg-blue-50 text-blue-700 hover:bg-blue-100">
                {templates?.length || 0} Templates
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-64 hidden sm:block">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSync} 
                disabled={isSyncing}
                className="gap-2 h-9 border-gray-200 hover:bg-gray-50 hover:text-blue-600"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync from Meta"}
              </Button>
            </div>
          </DialogHeader>
          
          <div className="flex-1 flex overflow-hidden bg-gray-50/50">
            {/* Template List */}
            <div className="w-1/3 min-w-[350px] max-w-[450px] border-r bg-white h-full flex flex-col">
              <div className="p-4 sm:hidden border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-gray-50"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {!templates ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <span className="text-sm">Loading templates...</span>
                    </div>
                  ) : filteredTemplates?.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p>No templates found.</p>
                      <Button variant="link" onClick={handleSync} className="mt-2">Try Syncing from Meta</Button>
                    </div>
                  ) : (
                    filteredTemplates?.map((template: any) => (
                      <div 
                        key={template._id} 
                        className={`
                          group relative p-3 rounded-lg border cursor-pointer transition-all duration-200
                          ${previewTemplate?._id === template._id 
                            ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/20' 
                            : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                          }
                        `}
                        onClick={() => setPreviewTemplate(template)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-semibold text-sm text-gray-900 truncate pr-2">{template.name}</h3>
                          <Badge className={`${getStatusColor(template.status)} text-white border-none text-[10px] h-5 px-1.5 capitalize shadow-none`}>
                            {template.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-white text-gray-500 border-gray-200">{template.language}</Badge>
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-white text-gray-500 border-gray-200">{template.category}</Badge>
                        </div>

                        <p className="text-xs text-gray-500 line-clamp-2 mb-2 min-h-[2.5em]">
                          {template.components.find((c: any) => c.type === "BODY")?.text || "No body text"}
                        </p>

                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-gray-400 hover:text-blue-600 hover:bg-blue-50" 
                            onClick={(e) => { e.stopPropagation(); navigate(`/whatsapp/create-template?edit=${template._id}`); }}
                            title="Edit Template"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50" 
                            onClick={(e) => handleDeleteClick(e, template)}
                            title="Delete Template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Preview Panel */}
            <div className="flex-1 bg-[#F0F2F5] flex flex-col relative">
              {previewTemplate ? (
                <div className="flex-1 flex flex-col h-full">
                  {/* Preview Header */}
                  <div className="p-4 border-b bg-white flex items-center justify-between shadow-sm z-10 shrink-0">
                      <div>
                        <h2 className="font-semibold text-gray-800">{previewTemplate.name}</h2>
                        <p className="text-xs text-gray-500">Previewing template message</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          onClick={(e) => handleDeleteClick(e, previewTemplate)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-[#00a884] hover:bg-[#008f6f] text-white shadow-sm" 
                          onClick={() => onSendTemplate(previewTemplate)}
                        >
                          <Send className="w-4 h-4 mr-2" /> 
                          Send Template
                        </Button>
                      </div>
                   </div>

                  {/* Preview Content */}
                  <ScrollArea className="flex-1 bg-[#efeae2] relative">
                    <div className="p-8 flex items-center justify-center min-h-full">
                      {/* WhatsApp Background Pattern */}
                      <div className="absolute inset-0 opacity-40 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat pointer-events-none"></div>
                     
                      <div className="w-full max-w-[380px] z-10 animate-in zoom-in-95 duration-200">
                        <div className="bg-white rounded-lg p-1 shadow-md relative rounded-tl-none ml-2 filter">
                          {/* Triangle for message bubble */}
                          <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent filter drop-shadow-sm"></div>
                         
                          <div className="p-3 pb-1">
                            {/* Header */}
                            {previewTemplate.components.find((c: any) => c.type === "HEADER") && (
                              <div className="mb-2 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                                {previewTemplate.components.find((c: any) => c.type === "HEADER").format === "TEXT" ? (
                                  <div className="w-full font-bold text-gray-800 text-sm p-2">
                                    {previewTemplate.components.find((c: any) => c.type === "HEADER").text}
                                  </div>
                                ) : (
                                  <div className="w-full h-40 bg-gray-200 flex items-center justify-center text-gray-400 rounded-lg">
                                    <div className="flex flex-col items-center gap-2">
                                      <span className="text-3xl">📷</span>
                                      <span className="text-xs font-bold uppercase tracking-wider">{previewTemplate.components.find((c: any) => c.type === "HEADER").format}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                           
                            {/* Body */}
                            <div className="text-[15px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {previewTemplate.components.find((c: any) => c.type === "BODY")?.text}
                            </div>
                            
                            {/* Footer */}
                            {previewTemplate.components.find((c: any) => c.type === "FOOTER") && (
                              <div className="text-[11px] text-gray-400 mt-2 pt-1">
                                {previewTemplate.components.find((c: any) => c.type === "FOOTER").text}
                              </div>
                            )}
                          </div>

                          {/* Timestamp */}
                          <div className="text-[10px] text-gray-400 text-right px-2 pb-1 select-none">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        {/* Buttons Preview (Outside bubble) */}
                        {previewTemplate.components.find((c: any) => c.type === "BUTTONS") && (
                          <div className="space-y-2 pt-2">
                            {previewTemplate.components.find((c: any) => c.type === "BUTTONS").buttons.map((btn: any, idx: number) => (
                              <div key={idx} className="bg-white rounded-lg text-center py-2.5 text-[#00a884] text-sm font-medium shadow-sm cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 border border-gray-100">
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
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center bg-gray-50/50">
                   <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                     <Send className="w-8 h-8 text-gray-300 ml-1" />
                   </div>
                   <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a template</h3>
                  <p className="text-sm text-gray-500 max-w-[250px]">Choose a template from the list to preview and send it to your lead.</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template <strong>{templateToDelete?.name}</strong> from both your database and Meta WhatsApp Manager. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {isDeleting ? "Deleting..." : "Delete Template"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}