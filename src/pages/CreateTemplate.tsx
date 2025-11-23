import { useState } from "react";
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
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
type ButtonType = "NONE" | "QUICK_REPLY" | "CALL_TO_ACTION";

interface TemplateButton {
  type: "QUICK_REPLY" | "PHONE_NUMBER" | "URL";
  text: string;
  phoneNumber?: string;
  url?: string;
}

export default function CreateTemplatePage() {
  const { currentUser } = useCrmAuth();
  const createTemplate = useMutation(api.whatsappTemplates.createTemplate);
  const navigate = useNavigate();
  
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [subCategory, setSubCategory] = useState("DEFAULT");
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

  // Reset sub-category when category changes
  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setSubCategory("DEFAULT");
  };

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

  // Helper to format WhatsApp text for preview
  const formatWhatsAppText = (text: string) => {
    if (!text) return null;
    
    // Split by newlines to handle paragraphs
    return text.split('\n').map((line, i) => {
      // Basic formatting replacement
      let formattedLine = line
        // Bold *text*
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
        // Italic _text_
        .replace(/_(.*?)_/g, '<em>$1</em>')
        // Strikethrough ~text~
        .replace(/~(.*?)~/g, '<del>$1</del>')
        // Monospace 
        .replace(/`([^`]+)`/g, '<code>$1</code>');

      return (
        <div key={i} dangerouslySetInnerHTML={{ __html: formattedLine || '&nbsp;' }} />
      );
    });
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
        subCategory,
        language,
        components,
        visibility,
        currentUserId: currentUser._id,
      });

      toast.success("Template created successfully (Pending Approval)");
      navigate("/whatsapp");
    } catch (error: any) {
      toast.error(error.message || "Failed to create template");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/whatsapp")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Create New WhatsApp Template</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 overflow-hidden">
          {/* Left Column: Form */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full px-6 pb-6">
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
                        <Select value={category} onValueChange={handleCategoryChange}>
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
                        <Label>Sub Category</Label>
                        <Select value={subCategory} onValueChange={setSubCategory}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DEFAULT">Default</SelectItem>
                            {category === "MARKETING" && (
                              <>
                                <SelectItem value="CATALOGUE">Catalogue</SelectItem>
                                <SelectItem value="FLOWS">Flows</SelectItem>
                                <SelectItem value="CALLING_PERMISSION">Calling Permission</SelectItem>
                              </>
                            )}
                            {category === "UTILITY" && (
                              <>
                                <SelectItem value="FLOWS">Flows</SelectItem>
                                <SelectItem value="CALLING_PERMISSION">Calling Permission</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                      <div className="grid gap-2">
                        <Label>Visibility</Label>
                        <Select value={visibility} onValueChange={setVisibility}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="private">Private</SelectItem>
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
                        className="h-32 font-mono text-sm"
                      />
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>Variables: {"{{1}}"}, {"{{2}}"}, etc.</p>
                        <p>Formatting: *bold*, _italics_, ~strikethrough~, 
                          <code>monospace</code> (no line breaks)</p>
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
                        className="h-16 font-mono text-sm"
                      />
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-base font-semibold">Buttons (Optional)</Label>
                    <div className="grid gap-2">
                      <Label>Button Type</Label>
                      <Select value={buttonType} onValueChange={handleButtonTypeChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">None</SelectItem>
                          <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                          <SelectItem value="CALL_TO_ACTION">Call to Action</SelectItem>
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
            </CardContent>
          </Card>

          {/* Right Column: Preview */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>Template Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full px-6 pb-6">
                <div className="space-y-4">
                  <div className="text-sm text-gray-500">
                    <strong>Template Name:</strong> {name || "Untitled"}
                  </div>
                  
                  {headerType !== "NONE" && (
                    <div className="border rounded p-4 bg-gray-50">
                      {headerType === "TEXT" && (
                        <p className="text-lg font-semibold">{headerText || "Header Text"}</p>
                      )}
                      {headerType === "IMAGE" && (
                        <div className="text-center">
                          <div className="w-16 h-16 bg-gray-300 rounded mx-auto mb-2"></div>
                          <p className="text-sm text-gray-600">Image Header</p>
                        </div>
                      )}
                      {headerType === "VIDEO" && (
                        <div className="text-center">
                          <div className="w-16 h-16 bg-gray-300 rounded mx-auto mb-2"></div>
                          <p className="text-sm text-gray-600">Video Header</p>
                        </div>
                      )}
                      {headerType === "DOCUMENT" && (
                        <div className="text-center">
                          <div className="w-16 h-16 bg-gray-300 rounded mx-auto mb-2"></div>
                          <p className="text-sm text-gray-600">Document Header</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border rounded p-4 bg-white">
                    <div className="text-sm text-gray-500 mb-2">
                      <strong>Body:</strong> {bodyText || "No body text"}
                    </div>
                    <div className="text-sm text-gray-700">
                      {formatWhatsAppText(bodyText)}
                    </div>
                  </div>

                  {footerText && (
                    <div className="border rounded p-4 bg-gray-50">
                      <p className="text-sm text-gray-600">Footer: {footerText}</p>
                    </div>
                  )}

                  {buttonType !== "NONE" && buttons.length > 0 && (
                    <div className="border rounded p-4 bg-white">
                      <div className="text-sm text-gray-500 mb-2">
                        <strong>Buttons:</strong> {buttons.length} {buttons.length === 1 ? "button" : "buttons"}
                      </div>
                      <div className="space-y-2">
                        {buttons.map((button, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="flex-1">
                              <p className="text-sm text-gray-700">{button.text || "Button Text"}</p>
                              {button.type === "URL" && button.url && (
                                <p className="text-xs text-blue-600">{button.url}</p>
                              )}
                              {button.type === "PHONE_NUMBER" && button.phoneNumber && (
                                <p className="text-xs text-green-600">{button.phoneNumber}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end mt-6">
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || !name || !bodyText}
            className="px-6 py-3"
          >
            {isSubmitting ? "Creating Template..." : "Create Template"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}