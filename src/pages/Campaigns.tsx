import { Layout } from "@/components/Layout";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PlusCircle, Send, Trash2, Edit } from "lucide-react";
import { ROLES } from "@/convex/schema";

export default function CampaignsPage() {
  const { currentUser, initializeAuth } = useCrmAuth();
  const [authReady, setAuthReady] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    subject: "",
    content: "",
    senderPrefix: "",
    recipientType: "my_leads" as "my_leads" | "all_leads" | "custom",
    selectedLeads: [] as string[],
  });

  useEffect(() => {
    initializeAuth();
    const timer = setTimeout(() => setAuthReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const campaigns = useQuery(
    api.campaigns.getCampaigns,
    authReady && currentUser ? { currentUserId: currentUser._id } : "skip"
  );

  const availableLeads = useQuery(
    api.campaigns.getLeadsForCampaign,
    authReady && currentUser ? { currentUserId: currentUser._id } : "skip"
  );

  const createCampaign = useMutation(api.campaigns.createCampaign);
  const updateCampaign = useMutation(api.campaigns.updateCampaign);
  const deleteCampaign = useMutation(api.campaigns.deleteCampaign);
  const startCampaign = useMutation(api.campaigns.startCampaign);

  if (!authReady || !currentUser) {
    return <Layout><div>Loading...</div></Layout>;
  }

  if (currentUser.role !== ROLES.ADMIN && currentUser.role !== ROLES.MANAGER) {
    return <Layout><div>Access Denied</div></Layout>;
  }

  const handleSaveCampaign = async () => {
    try {
      if (!formData.subject || !formData.content || !formData.senderPrefix) {
        toast.error("Please fill in all required fields");
        return;
      }

      if (formData.selectedLeads.length === 0) {
        toast.error("Please select at least one recipient");
        return;
      }

      if (editingCampaignId) {
        await updateCampaign({
          currentUserId: currentUser._id,
          campaignId: editingCampaignId as any,
          subject: formData.subject,
          content: formData.content,
          senderPrefix: formData.senderPrefix,
          recipientType: formData.recipientType,
          recipientIds: formData.selectedLeads as any,
        });
        toast.success("Campaign updated");
      } else {
        await createCampaign({
          currentUserId: currentUser._id,
          subject: formData.subject,
          content: formData.content,
          senderPrefix: formData.senderPrefix,
          recipientType: formData.recipientType,
          recipientIds: formData.selectedLeads as any,
        });
        toast.success("Campaign created");
      }

      setEditorOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save campaign");
    }
  };

  const handleStartCampaign = async (campaignId: string) => {
    try {
      const confirmed = window.confirm("Are you sure you want to start this campaign?");
      if (!confirmed) return;

      await startCampaign({
        currentUserId: currentUser._id,
        campaignId: campaignId as any,
      });
      toast.success("Campaign started");
    } catch (e: any) {
      toast.error(e?.message || "Failed to start campaign");
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      const confirmed = window.confirm("Are you sure you want to delete this campaign?");
      if (!confirmed) return;

      await deleteCampaign({
        currentUserId: currentUser._id,
        campaignId: campaignId as any,
      });
      toast.success("Campaign deleted");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete campaign");
    }
  };

  const resetForm = () => {
    setFormData({
      subject: "",
      content: "",
      senderPrefix: "",
      recipientType: "my_leads",
      selectedLeads: [],
    });
    setEditingCampaignId(null);
  };

  const openEditor = () => {
    resetForm();
    setEditorOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Email Campaigns</h1>
          <Button onClick={openEditor}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>

        <div className="grid gap-4">
          {campaigns?.map((campaign: any) => (
            <Card key={campaign._id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{campaign.subject}</CardTitle>
                    <CardDescription>
                      From: {campaign.senderPrefix}@mail.skinticals.com
                    </CardDescription>
                  </div>
                  <Badge variant={campaign.status === "sent" ? "default" : "secondary"}>
                    {campaign.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Recipients: {campaign.recipientIds.length} | Sent: {campaign.sentCount} | Failed: {campaign.failedCount}
                  </div>
                  <div className="flex gap-2">
                    {campaign.status === "draft" && (
                      <Button size="sm" onClick={() => handleStartCampaign(campaign._id)}>
                        <Send className="w-4 h-4 mr-2" />
                        Start
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteCampaign(campaign._id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCampaignId ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Subject</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Email subject"
                />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Email content (HTML supported)"
                  rows={10}
                />
              </div>
              <div>
                <Label>Sender Email Prefix</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={formData.senderPrefix}
                    onChange={(e) => setFormData({ ...formData, senderPrefix: e.target.value })}
                    placeholder="e.g., testing"
                  />
                  <span className="text-sm text-gray-600">@mail.skinticals.com</span>
                </div>
              </div>
              <div>
                <Label>Recipients</Label>
                <Select
                  value={formData.recipientType}
                  onValueChange={(v: any) => setFormData({ ...formData, recipientType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="my_leads">My Leads</SelectItem>
                    {currentUser.role === ROLES.ADMIN && (
                      <SelectItem value="all_leads">All Leads</SelectItem>
                    )}
                    <SelectItem value="custom">Custom Selection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.recipientType === "custom" && (
                <div>
                  <Label>Select Leads</Label>
                  <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1">
                    {availableLeads?.map((lead: any) => (
                      <label key={lead._id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.selectedLeads.includes(lead._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                selectedLeads: [...formData.selectedLeads, lead._id],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                selectedLeads: formData.selectedLeads.filter((id) => id !== lead._id),
                              });
                            }
                          }}
                        />
                        <span className="text-sm">{lead.name} ({lead.email})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {formData.recipientType !== "custom" && (
                <div className="text-sm text-gray-600">
                  {formData.recipientType === "my_leads"
                    ? `Will send to all your assigned leads (${availableLeads?.length || 0})`
                    : `Will send to all leads in the system`}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCampaign}>Save Campaign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
