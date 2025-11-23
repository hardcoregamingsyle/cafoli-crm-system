import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
type ButtonType = "NONE" | "QUICK_REPLY" | "CALL_TO_ACTION";

interface TemplateButton {
  type: "QUICK_REPLY" | "PHONE_NUMBER" | "URL";
  text: string;
  phoneNumber?: string;
  url?: string;
}

export function CreateTemplateDialog({ open, onOpenChange }: CreateTemplateDialogProps) {
  const { currentUser } = useCrmAuth();
  const createTemplate = useMutation(api.whatsappTemplates.createTemplate);
  
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("en");
  const [bodyText, setBodyText] = useState("");
  const [visibility, setVisibility] = useState("public");
  
  // New fields
  const [headerType, setHeaderType] = useState<HeaderType>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttonType, setButtonType] = useState<ButtonType>("NONE");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddButton = () => {
    if (buttonType === "QUICK_REPLY") {
      if (buttons.length >= 3) return;
      setButtons([...buttons, { type: "QUICK_REPLY", text: "" }]);
    } else if (buttonType === "CALL_TO_ACTION") {
      if (buttons.length >= 2) return;
      // Default to URL for new CTA
      setButtons([...buttons, { type: "URL", text: "", url: "" }]);
    }
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleButtonChange = (index: number, field: keyof TemplateButton, value: string) => {
    const newButtons = [...buttons];
    // Cast value to any to avoid type errors with specific field types
    newButtons[index] = { ...newButtons[index], [field]: value as any };
    setButtons(newButtons);
  };

  const handleButtonTypeChange = (value: string) => {
    setButtonType(value as ButtonType);
    setButtons([]);
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    if (!name || !bodyText) {
      toast.error("Name and Body text are required");
      return;
    }

    setIsSubmitting(true);
    try {
      // Construct components structure for WhatsApp
      const components: any[] = [];

      // Header
      if (headerType !== "NONE") {
        const headerComponent: any = {
          type: "HEADER",
          format: headerType,
        };
        if (headerType === "TEXT") {
          headerComponent.text = headerText;
        }
        components.push(headerComponent);
      }

      // Body
      components.push({
        type: "BODY",
        text: bodyText,
      });

      // Footer
      if (footerText) {
        components.push({
          type: "FOOTER",
          text: footerText,
        });
      }

      // Buttons
      if (buttonType !== "NONE" && buttons.length > 0) {
        const buttonsComponent: any = {
          type: "BUTTONS",
          buttons: buttons.map(b => {
            if (b.type === "QUICK_REPLY") {
              return { type: "QUICK_REPLY", text: b.text };
            } else if (b.type === "URL") {
              return { type: "URL", text: b.text, url: b.url };
            } else if (b.type === "PHONE_NUMBER") {
              return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phoneNumber };
            }
            return null;
          }).filter(Boolean)
        };
        components.push(buttonsComponent);
      }

      await createTemplate({
        name,
        category,
        language,
        components,
        visibility,
        currentUserId: currentUser._id,
      });

      toast.success("Template created successfully (Pending Approval)");
      onOpenChange(false);
      
      // Reset form
      setName("");
      setBodyText("");
      setCategory("MARKETING");
      setVisibility("public");
      setHeaderType("NONE");
      setHeaderText("");
      setFooterText("");
      setButtonType("NONE");
      setButtons([]);
    } catch (error: any) {
      toast.error(error.message || "Failed to create template");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New WhatsApp Template</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="grid gap-6 py-4">
            {/* Basic Info */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                  placeholder="e.g., welcome_message"
                />
                <p className="text-xs text-gray-500">Lowercase, underscores only</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                      <SelectItem value="UTILITY">Utility</SelectItem>
                      <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English (en)</SelectItem>
                      <SelectItem value="en_US">English (US)</SelectItem>
                      <SelectItem value="hi">Hindi (hi)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Header */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold">Header (Optional)</Label>
              <div className="grid gap-2">
                <Label>Header Type</Label>
                <Select value={headerType} onValueChange={(v) => setHeaderType(v as HeaderType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="IMAGE">Image</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                    <SelectItem value="DOCUMENT">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {headerType === "TEXT" && (
                <div className="grid gap-2">
                  <Label>Header Text</Label>
                  <Input 
                    value={headerText} 
                    onChange={(e) => setHeaderText(e.target.value)}
                    placeholder="Enter header text"
                    maxLength={60}
                  />
                </div>
              )}
            </div>

            {/* Body */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold">Body</Label>
              <div className="grid gap-2">
                <Textarea
                  id="body"
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Enter your message text here..."
                  className="h-32"
                />
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Variables: {"{{1}}"}, {"{{2}}"}, etc.</p>
                  <p>Formatting: *bold*, _italics_, ~strikethrough~, 
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold">Footer (Optional)</Label>
              <div className="grid gap-2">
                <Textarea
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="Enter footer text (optional)"
                  className="h-12"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold">Buttons (Optional)</Label>
              <div className="grid gap-2">
                <Label>Button Type</Label>
                <Select 
                  value={buttonType} 
                  onValueChange={handleButtonTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="QUICK_REPLY">Quick Reply (Max 3)</SelectItem>
                    <SelectItem value="CALL_TO_ACTION">Call to Action (Max 2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {buttonType !== "NONE" && (
                <div className="space-y-3">
                  {buttons.map((btn, idx) => (
                    <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 rounded-md border">
                      <div className="grid gap-2 flex-1">
                        {buttonType === "CALL_TO_ACTION" && (
                          <Select 
                            value={btn.type} 
                            onValueChange={(v) => handleButtonChange(idx, "type", v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="URL">Website URL</SelectItem>
                              <SelectItem value="PHONE_NUMBER">Phone Number</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        
                        <Input
                          value={btn.text}
                          onChange={(e) => handleButtonChange(idx, "text", e.target.value)}
                          placeholder="Button Text"
                          maxLength={25}
                        />

                        {btn.type === "URL" && (
                          <Input
                            value={btn.url}
                            onChange={(e) => handleButtonChange(idx, "url", e.target.value)}
                            placeholder="https://example.com"
                          />
                        )}

                        {btn.type === "PHONE_NUMBER" && (
                          <Input
                            value={btn.phoneNumber}
                            onChange={(e) => handleButtonChange(idx, "phoneNumber", e.target.value)}
                            placeholder="+1234567890"
                          />
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveButton(idx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {((buttonType === "QUICK_REPLY" && buttons.length < 3) || 
                    (buttonType === "CALL_TO_ACTION" && buttons.length < 2)) && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAddButton}
                      className="w-full border-dashed"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Button
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}