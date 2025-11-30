import { Layout } from "@/components/Layout";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PlusCircle, Play, Trash2, Mail, MessageSquare, MessageCircle, Clock, GitBranch, Search } from "lucide-react";

type BlockType = "whatsapp" | "email" | "sms" | "wait" | "query_repeat" | "query_email" | "query_sms" | "query_whatsapp";

export default function CampaignsPage() {
  const { currentUser, initializeAuth } = useCrmAuth();
  const [authReady, setAuthReady] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectLeadsDialogOpen, setSelectLeadsDialogOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    initializeAuth();
    const timer = setTimeout(() => setAuthReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const campaigns = useQuery(
    (api as any).campaigns.getCampaigns,
    authReady && currentUser?._id ? { currentUserId: currentUser._id } : "skip"
  );

  const availableLeads = useQuery(
    (api as any).campaigns.getLeadsForCampaign,
    authReady && currentUser?._id ? { currentUserId: currentUser._id } : "skip"
  );

  const createCampaign = useMutation((api as any).campaigns.createCampaign);
  const deleteCampaign = useMutation((api as any).campaigns.deleteCampaign);
  const startCampaign = useMutation((api as any).campaigns.startCampaign);

  if (!authReady || !currentUser) {
    return <Layout><div>Loading...</div></Layout>;
  }

  const handleCreateCampaign = async () => {
    try {
      if (!campaignName.trim()) {
        toast.error("Please enter a campaign name");
        return;
      }

      if (selectedLeads.length === 0) {
        toast.error("Please select at least one lead");
        return;
      }

      await createCampaign({
        currentUserId: currentUser._id,
        name: campaignName,
        recipientIds: selectedLeads as any,
        workflow: { blocks: [], connections: [] },
      });

      toast.success("Campaign created successfully");
      setCreateDialogOpen(false);
      setSelectLeadsDialogOpen(false);
      setCampaignName("");
      setSelectedLeads([]);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create campaign");
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

  const filteredLeads = (availableLeads || []).filter((lead: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(search) ||
      lead.email?.toLowerCase().includes(search) ||
      lead.mobileNo?.includes(search)
    );
  });

  const blockTypes = [
    { type: "whatsapp" as BlockType, label: "Send WhatsApp", icon: MessageCircle, color: "bg-green-500" },
    { type: "email" as BlockType, label: "Send Email", icon: Mail, color: "bg-blue-500" },
    { type: "sms" as BlockType, label: "Send SMS/RCS", icon: MessageSquare, color: "bg-purple-500" },
    { type: "wait" as BlockType, label: "Wait", icon: Clock, color: "bg-gray-500" },
    { type: "query_repeat" as BlockType, label: "Repeat Query", icon: GitBranch, color: "bg-orange-500" },
    { type: "query_email" as BlockType, label: "Email Received", icon: Mail, color: "bg-cyan-500" },
    { type: "query_sms" as BlockType, label: "SMS Received", icon: MessageSquare, color: "bg-pink-500" },
    { type: "query_whatsapp" as BlockType, label: "WhatsApp Received", icon: MessageCircle, color: "bg-teal-500" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>

        {/* Campaign List */}
        <div className="grid gap-4">
          {campaigns?.map((campaign: any) => (
            <Card key={campaign._id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{campaign.name}</CardTitle>
                    <CardDescription>
                      Created {new Date(campaign.createdAt).toLocaleDateString()} • {campaign.recipientIds.length} recipients
                    </CardDescription>
                  </div>
                  <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                    {campaign.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end gap-2">
                  {campaign.status === "draft" && (
                    <Button size="sm" onClick={() => handleStartCampaign(campaign._id)}>
                      <Play className="w-4 h-4 mr-2" />
                      Start
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => toast.info("Edit workflow coming soon")}>
                    Edit Workflow
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteCampaign(campaign._id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {campaigns?.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No campaigns yet. Create your first campaign to get started!
              </CardContent>
            </Card>
          )}
        </div>

        {/* Create Campaign Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Campaign Name</Label>
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Enter campaign name"
                />
              </div>
              <div>
                <Label>Selected Leads: {selectedLeads.length}</Label>
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => setSelectLeadsDialogOpen(true)}
                >
                  Select Leads
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateCampaign}>
                Create & Build Workflow
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Select Leads Dialog */}
        <Dialog open={selectLeadsDialogOpen} onOpenChange={setSelectLeadsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Select Leads for Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, email, or mobile..."
                  className="pl-10"
                />
              </div>
              <div className="border rounded-lg max-h-96 overflow-y-auto">
                {filteredLeads.map((lead: any) => (
                  <div key={lead._id} className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0">
                    <Checkbox
                      checked={selectedLeads.includes(lead._id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedLeads([...selectedLeads, lead._id]);
                        } else {
                          setSelectedLeads(selectedLeads.filter(id => id !== lead._id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-sm text-gray-500">{lead.email} • {lead.mobileNo}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>{selectedLeads.length} leads selected</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedLeads.length === filteredLeads.length) {
                      setSelectedLeads([]);
                    } else {
                      setSelectedLeads(filteredLeads.map((l: any) => l._id));
                    }
                  }}
                >
                  {selectedLeads.length === filteredLeads.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectLeadsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setSelectLeadsDialogOpen(false)}>
                Confirm Selection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Block Types Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Available Workflow Blocks</CardTitle>
            <CardDescription>These blocks will be available in the drag-and-drop workflow builder</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {blockTypes.map((block) => {
                const Icon = block.icon;
                return (
                  <div key={block.type} className={`${block.color} text-white p-3 rounded-lg flex items-center gap-2`}>
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{block.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}