import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useNavigate } from "react-router";
import { ArrowLeft, Send, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ComposeEmailPage() {
  const { currentUser } = useCrmAuth();
  const navigate = useNavigate();
  const sendCustomEmail = useAction(api.customEmails.sendCustomEmail);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [textContent, setTextContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState("text");

  const handleSend = async () => {
    if (!currentUser) {
      toast.error("Please log in to send emails");
      return;
    }

    if (!to || !subject) {
      toast.error("Recipient and subject are required");
      return;
    }

    if (!textContent && !htmlContent) {
      toast.error("Email content is required");
      return;
    }

    setIsSending(true);
    try {
      const result = await sendCustomEmail({
        currentUserId: currentUser._id,
        to: to.trim(),
        subject: subject.trim(),
        textContent: textContent.trim() || undefined,
        htmlContent: htmlContent.trim() || undefined,
      });

      if (result.queued) {
        toast.warning(`Email queued: ${result.reason}`);
      } else {
        toast.success("Email sent successfully!");
      }

      // Reset form
      setTo("");
      setSubject("");
      setTextContent("");
      setHtmlContent("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  if (!currentUser) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent>Please log in to compose emails.</CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold">Compose Email</h1>
          </div>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-blue-100">
          <CardHeader>
            <CardTitle>New Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="email"
                placeholder="recipient@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Content</Label>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text">Plain Text</TabsTrigger>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="mt-4">
                  <Textarea
                    placeholder="Enter your email message here..."
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                  />
                </TabsContent>
                <TabsContent value="html" className="mt-4">
                  <Textarea
                    placeholder="<html><body><p>Enter HTML content here...</p></body></html>"
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    You can use HTML tags for formatting
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-gray-600">
                Using Brevo API keys configured in Admin panel
              </p>
              <Button
                onClick={handleSend}
                disabled={isSending || !to || !subject || (!textContent && !htmlContent)}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                {isSending ? "Sending..." : "Send Email"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
