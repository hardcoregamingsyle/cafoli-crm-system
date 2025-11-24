import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, ArrowLeft, ArrowUp, ArrowDown } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

interface TemplateButton {
  type: "QUICK_REPLY" | "PHONE_NUMBER" | "URL" | "COPY_CODE" | "FLOW";
  text: string;
  phoneNumber?: string;
  url?: string;
  example?: string; // For URL variables or Copy Code
  flowId?: string;
  flowAction?: "navigate" | "data_exchange";
  navigateScreen?: string;
}

export default function CreateTemplatePage() {
  const { currentUser } = useCrmAuth();
  const createTemplate = useMutation(api.whatsappTemplates.createTemplate);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editTemplateId = searchParams.get("edit");
  
  const templates = useQuery(
    api.whatsappTemplates.getTemplates,
    currentUser ? { currentUserId: currentUser._id } : "skip"
  );
  
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [subCategory, setSubCategory] = useState("CUSTOM");
  const [language, setLanguage] = useState("en");
  const [bodyText, setBodyText] = useState("");
  const [visibility, setVisibility] = useState("public");
  
  // New fields
  const [headerType, setHeaderType] = useState<HeaderType>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load template data when editing
  useEffect(() => {
    if (editTemplateId && templates) {
      const templateToEdit = templates.find((t: any) => t._id === editTemplateId);
      if (templateToEdit) {
        setName(templateToEdit.name || "");
        setCategory(templateToEdit.category || "MARKETING");
        setSubCategory(templateToEdit.subCategory || "CUSTOM");
        setLanguage(templateToEdit.language || "en");
        setVisibility(templateToEdit.visibility || "public");
        
        // Parse components
        const headerComp = templateToEdit.components.find((c: any) => c.type === "HEADER");
        if (headerComp) {
          setHeaderType(headerComp.format || "NONE");
          if (headerComp.format === "TEXT") {
            setHeaderText(headerComp.text || "");
          }
        } else {
          setHeaderType("NONE");
          setHeaderText("");
        }
        
        const bodyComp = templateToEdit.components.find((c: any) => c.type === "BODY");
        if (bodyComp) {
          setBodyText(bodyComp.text || "");
        } else {
          setBodyText("");
        }
        
        const footerComp = templateToEdit.components.find((c: any) => c.type === "FOOTER");
        if (footerComp) {
          setFooterText(footerComp.text || "");
        } else {
          setFooterText("");
        }
        
        const buttonsComp = templateToEdit.components.find((c: any) => c.type === "BUTTONS");
        if (buttonsComp && buttonsComp.buttons) {
          const parsedButtons = buttonsComp.buttons.map((btn: any) => {
            const button: TemplateButton = {
              type: btn.type,
              text: btn.text || (btn.type === "COPY_CODE" ? "Copy Code" : "Button"),
            };
            
            if (btn.type === "URL") {
              button.url = btn.url || "";
              // Extract example from URL if it contains variables
              if (btn.example && btn.example.length > 0) {
                button.example = btn.example[0];
              }
            } else if (btn.type === "PHONE_NUMBER") {
              button.phoneNumber = btn.phone_number || "";
            } else if (btn.type === "COPY_CODE") {
              button.example = btn.example || "";
            } else if (btn.type === "FLOW") {
              button.flowId = btn.flow_id || "";
              button.flowAction = btn.flow_action || "navigate";
              button.navigateScreen = btn.navigate_screen || "screen_01";
            }
            
            return button;
          });
          setButtons(parsedButtons);
        } else {
          setButtons([]);
        }
      }
    }
  }, [editTemplateId, templates]);

  // Reset sub-category and buttons when category changes
  const handleCategoryChange = (val: string) => {
    setCategory(val);
    if (val === "AUTHENTICATION") {
      setSubCategory("ONE_TIME_PASSWORD");
      setButtons([{ type: "COPY_CODE", text: "Copy Code" }]);
      setHeaderType("NONE");
      setFooterText("");
    } else {
      setSubCategory("CUSTOM");
      setButtons([]);
    }
  };

  const handleAddButton = (type: TemplateButton["type"]) => {
    if (buttons.length >= 10) {
      toast.error("Maximum 10 buttons allowed");
      return;
    }

    const newButton: TemplateButton = { type, text: "" };
    
    if (type === "URL") newButton.url = "";
    if (type === "PHONE_NUMBER") newButton.phoneNumber = "";
    if (type === "COPY_CODE") newButton.text = "Copy Code";
    if (type === "FLOW") {
      newButton.flowAction = "navigate";
      newButton.navigateScreen = "screen_01";
    }

    setButtons([...buttons, newButton]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleMoveButton = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === buttons.length - 1) return;

    const newButtons = [...buttons];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newButtons[index], newButtons[targetIndex]] = [newButtons[targetIndex], newButtons[index]];
    setButtons(newButtons);
  };

  const handleButtonChange = (index: number, field: keyof TemplateButton, value: string) => {
    const newButtons = [...buttons];
    
    // Validation for CTA types
    if (field === "type" && value === "PHONE_NUMBER") {
      // Check if a phone number button already exists
      const hasPhone = newButtons.some((b, i) => i !== index && b.type === "PHONE_NUMBER");
      if (hasPhone) {
        toast.error("Only one Phone Number button is allowed per template.");
        return;
      }
    }

    // Cast value to any to avoid type errors with specific field types
    newButtons[index] = { ...newButtons[index], [field]: value as any };
    setButtons(newButtons);
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

    // Validation
    if (headerType === "TEXT" && headerText.length > 60) {
        toast.error("Header text exceeds 60 characters");
        return;
    }
    if (bodyText.length > 1024) {
        toast.error("Body text exceeds 1024 characters");
        return;
    }
    if (footerText.length > 60) {
        toast.error("Footer text exceeds 60 characters");
        return;
    }
    if (buttons.some(b => b.text.length > 25)) {
        toast.error("Button text exceeds 25 characters");
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
      if (buttons.length > 0) {
        const buttonsComponent: any = {
          type: "BUTTONS",
          buttons: buttons.map(b => {
            if (b.type === "QUICK_REPLY") {
              return { type: "QUICK_REPLY", text: b.text };
            } else if (b.type === "URL") {
              return { type: "URL", text: b.text, url: b.url };
            } else if (b.type === "PHONE_NUMBER") {
              return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phoneNumber };
            } else if (b.type === "COPY_CODE") {
              return { type: "COPY_CODE", example: "123456" }; // WhatsApp requires example for copy code
            } else if (b.type === "FLOW") {
              return { 
                type: "FLOW", 
                text: b.text, 
                flow_id: b.flowId, 
                flow_action: b.flowAction, 
                navigate_screen: b.navigateScreen 
              };
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

      if (currentUser.role === "admin") {
        toast.success("Template submitted to Meta for approval");
      } else {
        toast.success("Template created successfully (Pending Internal Approval)");
      }
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
          <h1 className="text-2xl font-bold">
            {editTemplateId ? "Edit WhatsApp Template" : "Create New WhatsApp Template"}
          </h1>
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
                        onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
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
                            {category === "MARKETING" && (
                              <>
                                <SelectItem value="CUSTOM">Default (Custom)</SelectItem>
                                <SelectItem value="CATALOGUE">Catalogue</SelectItem>
                                <SelectItem value="FLOW">Flows</SelectItem>
                                <SelectItem value="CALLING_PERMISSION">Calling Permission</SelectItem>
                                <SelectItem value="PRODUCT_RECOMMENDATION">Product Recommendation</SelectItem>
                              </>
                            )}
                            {category === "UTILITY" && (
                              <>
                                <SelectItem value="CUSTOM">Default (Custom)</SelectItem>
                                <SelectItem value="FLOW">Flows</SelectItem>
                                <SelectItem value="CALLING_PERMISSION">Calling Permission</SelectItem>
                                <SelectItem value="ORDER_DETAILS">Order Details</SelectItem>
                                <SelectItem value="ORDER_STATUS">Order Status</SelectItem>
                                <SelectItem value="ACCOUNT_UPDATE">Account Update</SelectItem>
                                <SelectItem value="ALERT_UPDATE">Alert Update</SelectItem>
                              </>
                            )}
                            {category === "AUTHENTICATION" && (
                              <SelectItem value="ONE_TIME_PASSWORD">One Time Password</SelectItem>
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
                  {category !== "AUTHENTICATION" && (
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
                          <div className="flex justify-between">
                            <Label>Header Text</Label>
                            <span className={`text-xs ${headerText.length > 60 ? 'text-red-500' : 'text-gray-500'}`}>
                              {headerText.length}/60
                            </span>
                          </div>
                          <Input 
                            value={headerText} 
                            onChange={(e) => setHeaderText(e.target.value)}
                            placeholder="Enter header text"
                            maxLength={60}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-base font-semibold">Body</Label>
                      <span className={`text-xs ${bodyText.length > 1024 ? 'text-red-500' : 'text-gray-500'}`}>
                        {bodyText.length}/1024
                      </span>
                    </div>
                    <div className="grid gap-2">
                      <Textarea
                        id="body"
                        value={bodyText}
                        onChange={(e) => setBodyText(e.target.value)}
                        placeholder={category === "AUTHENTICATION" ? "Your verification code is {{1}}." : "Enter your message text here..."}
                        className="h-32 font-mono text-sm"
                      />
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>Variables: {"{{1}}"}, {"{{2}}"}, etc.</p>
                        <p>Formatting: *bold*, _italics_, ~strikethrough~, <code>monospace</code></p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  {category !== "AUTHENTICATION" && (
                    <div className="space-y-3 border-t pt-4">
                      <div className="flex justify-between items-center">
                        <Label className="text-base font-semibold">Footer (Optional)</Label>
                        <span className={`text-xs ${footerText.length > 60 ? 'text-red-500' : 'text-gray-500'}`}>
                          {footerText.length}/60
                        </span>
                      </div>
                      <div className="grid gap-2">
                        <Textarea
                          value={footerText}
                          onChange={(e) => setFooterText(e.target.value)}
                          placeholder="Enter footer text (optional)"
                          className="h-16 font-mono text-sm"
                          maxLength={60}
                        />
                      </div>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-base font-semibold">Buttons (Max 10)</Label>
                      <span className="text-xs text-gray-500">{buttons.length}/10</span>
                    </div>

                    <div className="space-y-3">
                      {buttons.map((btn, idx) => (
                        <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 rounded-md border group">
                          <div className="flex flex-col gap-1 pt-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveButton(idx, "up")}
                              disabled={idx === 0}
                            >
                              <ArrowUp className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleMoveButton(idx, "down")}
                              disabled={idx === buttons.length - 1}
                            >
                              <ArrowDown className="w-3 h-3" />
                            </Button>
                          </div>

                          <div className="grid gap-2 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {btn.type.replace("_", " ")}
                              </span>
                            </div>
                            
                            {btn.type === "COPY_CODE" ? (
                              <Input value="Copy Code" disabled />
                            ) : (
                              <div className="grid gap-1">
                                <Input
                                  value={btn.text}
                                  onChange={(e) => handleButtonChange(idx, "text", e.target.value)}
                                  placeholder="Button Text"
                                  maxLength={25}
                                />
                                <span className="text-[10px] text-gray-400 text-right">{btn.text.length}/25</span>
                              </div>
                            )}

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

                            {btn.type === "FLOW" && (
                              <div className="grid gap-2">
                                <Input
                                  value={btn.flowId}
                                  onChange={(e) => handleButtonChange(idx, "flowId", e.target.value)}
                                  placeholder="Flow ID"
                                />
                                <Input
                                  value={btn.navigateScreen}
                                  onChange={(e) => handleButtonChange(idx, "navigateScreen", e.target.value)}
                                  placeholder="Initial Screen (e.g. screen_01)"
                                />
                              </div>
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
                      
                      {buttons.length < 10 && category !== "AUTHENTICATION" && (
                        <div className="flex gap-2 flex-wrap">
                          <Select onValueChange={(v) => handleAddButton(v as TemplateButton["type"])}>
                            <SelectTrigger className="w-full border-dashed">
                              <div className="flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                <span>Add Button</span>
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="QUICK_REPLY">Custom (Quick Reply)</SelectItem>
                              <SelectItem value="URL">Visit Website</SelectItem>
                              <SelectItem value="PHONE_NUMBER">Call Phone Number</SelectItem>
                              <SelectItem value="FLOW">Complete Flow</SelectItem>
                              <SelectItem value="COPY_CODE">Copy Offer Code</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Right Column: Preview */}
          <Card className="flex flex-col overflow-hidden bg-[#E5DDD5]">
            <CardHeader className="bg-white border-b">
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-4 flex items-center justify-center">
              <div className="w-full max-w-sm bg-white rounded-lg shadow-sm overflow-hidden relative">
                {/* WhatsApp Message Bubble */}
                <div className="p-1">
                  <div className="bg-white p-2 rounded-lg">
                    {/* Header */}
                    {headerType !== "NONE" && (
                      <div className="mb-2 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                        {headerType === "TEXT" && (
                          <div className="w-full p-2 font-bold text-gray-800">{headerText || "{{Header}}"}</div>
                        )}
                        {headerType === "IMAGE" && (
                          <div className="w-full h-32 bg-gray-200 flex items-center justify-center text-gray-400">
                            <span className="text-xs">IMAGE</span>
                          </div>
                        )}
                        {headerType === "VIDEO" && (
                          <div className="w-full h-32 bg-gray-200 flex items-center justify-center text-gray-400">
                            <span className="text-xs">VIDEO</span>
                          </div>
                        )}
                        {headerType === "DOCUMENT" && (
                          <div className="w-full h-16 bg-gray-200 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 m-2 rounded">
                            <span className="text-xs">DOCUMENT</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Body */}
                    <div className="text-sm text-gray-800 whitespace-pre-wrap mb-1">
                      {bodyText ? formatWhatsAppText(bodyText) : <span className="text-gray-400 italic">Body text...</span>}
                    </div>

                    {/* Footer */}
                    {footerText && (
                      <div className="text-[10px] text-gray-500 mt-1">
                        {footerText}
                      </div>
                    )}
                    
                    {/* Timestamp */}
                    <div className="text-[10px] text-gray-400 text-right mt-1">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Buttons */}
                  {buttons.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {buttons.map((btn, idx) => (
                        <div key={idx} className="bg-white rounded text-center py-2 text-[#00a884] text-sm font-medium cursor-pointer shadow-sm hover:bg-gray-50 flex items-center justify-center gap-2">
                          {btn.type === "URL" && <span className="text-xs">🔗</span>}
                          {btn.type === "PHONE_NUMBER" && <span className="text-xs">📞</span>}
                          {btn.type === "COPY_CODE" && <span className="text-xs">📋</span>}
                          {btn.type === "FLOW" && <span className="text-xs">⚡</span>}
                          {btn.type === "QUICK_REPLY" && <span className="text-xs">↩️</span>}
                          {btn.text || "Button"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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