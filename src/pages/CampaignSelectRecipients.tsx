import { Layout } from "@/components/Layout";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Filter, ArrowLeft } from "lucide-react";
import { ROLES, LEAD_STATUS } from "@/convex/schema";

export default function CampaignSelectRecipientsPage() {
  const { currentUser, initializeAuth } = useCrmAuth();
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedHeats, setSelectedHeats] = useState<string[]>([]);

  useEffect(() => {
    initializeAuth();
    const timer = setTimeout(() => setAuthReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const availableLeads = useQuery(
    api.campaigns.getLeadsForCampaign,
    authReady && currentUser ? { currentUserId: currentUser._id } : "skip"
  );

  const campaign = useQuery(
    api.campaigns.getCampaignById,
    authReady && currentUser && campaignId ? { currentUserId: currentUser._id, campaignId: campaignId as any } : "skip"
  );

  const updateCampaign = useMutation(api.campaigns.updateCampaign);

  useEffect(() => {
    if (campaign?.recipientIds) {
      setSelectedLeadIds(campaign.recipientIds.map((id: any) => String(id)));
    }
  }, [campaign]);

  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    (availableLeads ?? []).forEach((lead: any) => {
      if (lead?.source) sources.add(lead.source);
    });
    return Array.from(sources).sort();
  }, [availableLeads]);

  const filteredLeads = useMemo(() => {
    const list: Array<any> = availableLeads ?? [];
    const q = (search || "").trim().toLowerCase();

    return list.filter((lead: any) => {
      if (q) {
        const fields = [
          lead?.name,
          lead?.subject,
          lead?.message,
          lead?.mobileNo,
          lead?.email,
          lead?.country,
        ];
        const matchesSearch = fields.some((f: any) => String(f || "").toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      if (selectedStatuses.length > 0) {
        const leadStatus = lead?.status || LEAD_STATUS.YET_TO_DECIDE;
        if (!selectedStatuses.includes(leadStatus)) return false;
      }

      if (selectedSources.length > 0) {
        const leadSource = lead?.source || "";
        if (!selectedSources.includes(leadSource)) return false;
      }

      if (selectedHeats.length > 0) {
        const leadHeat = lead?.heat || "";
        if (!selectedHeats.includes(leadHeat)) return false;
      }

      return true;
    });
  }, [availableLeads, search, selectedStatuses, selectedSources, selectedHeats]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleSource = (source: string) => {
    setSelectedSources(prev => 
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    );
  };

  const toggleHeat = (heat: string) => {
    setSelectedHeats(prev => 
      prev.includes(heat) ? prev.filter(h => h !== heat) : [...prev, heat]
    );
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedSources([]);
    setSelectedHeats([]);
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const selectAll = () => {
    setSelectedLeadIds(filteredLeads.map((lead: any) => String(lead._id)));
  };

  const deselectAll = () => {
    setSelectedLeadIds([]);
  };

  const handleSaveRecipients = async () => {
    if (!campaignId || !currentUser) return;
    
    try {
      await updateCampaign({
        currentUserId: currentUser._id,
        campaignId: campaignId as any,
        recipientIds: selectedLeadIds as any,
      });
      toast.success("Recipients updated");
      navigate("/campaigns");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update recipients");
    }
  };

  if (!authReady || !currentUser) {
    return <Layout><div>Loading...</div></Layout>;
  }

  if (currentUser.role !== ROLES.ADMIN && currentUser.role !== ROLES.MANAGER) {
    return <Layout><div>Access Denied</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Campaigns
          </Button>
          <h1 className="text-2xl font-bold">Select Recipients</h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{selectedLeadIds.length} selected</Badge>
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All ({filteredLeads.length})
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-56">
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                  {(selectedStatuses.length > 0 || selectedSources.length > 0 || selectedHeats.length > 0) && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedStatuses.length + selectedSources.length + selectedHeats.length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter Leads</SheetTitle>
                  <SheetDescription>
                    Select multiple filters to refine your leads
                  </SheetDescription>
                </SheetHeader>
                
                <div className="mt-6 space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Status</h3>
                      {selectedStatuses.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setSelectedStatuses([])}>
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="status-relevant"
                          checked={selectedStatuses.includes(LEAD_STATUS.RELEVANT)}
                          onCheckedChange={() => toggleStatus(LEAD_STATUS.RELEVANT)}
                        />
                        <Label htmlFor="status-relevant" className="cursor-pointer">Relevant</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="status-yet-to-decide"
                          checked={selectedStatuses.includes(LEAD_STATUS.YET_TO_DECIDE)}
                          onCheckedChange={() => toggleStatus(LEAD_STATUS.YET_TO_DECIDE)}
                        />
                        <Label htmlFor="status-yet-to-decide" className="cursor-pointer">Yet to Decide</Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Lead Source</h3>
                      {selectedSources.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setSelectedSources([])}>
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {uniqueSources.map((source) => (
                        <div key={source} className="flex items-center space-x-2">
                          <Checkbox
                            id={`source-${source}`}
                            checked={selectedSources.includes(source)}
                            onCheckedChange={() => toggleSource(source)}
                          />
                          <Label htmlFor={`source-${source}`} className="cursor-pointer capitalize">
                            {source}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Lead Type</h3>
                      {selectedHeats.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setSelectedHeats([])}>
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="heat-hot"
                          checked={selectedHeats.includes("hot")}
                          onCheckedChange={() => toggleHeat("hot")}
                        />
                        <Label htmlFor="heat-hot" className="cursor-pointer">Hot</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="heat-cold"
                          checked={selectedHeats.includes("cold")}
                          onCheckedChange={() => toggleHeat("cold")}
                        />
                        <Label htmlFor="heat-cold" className="cursor-pointer">Cold</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="heat-matured"
                          checked={selectedHeats.includes("matured")}
                          onCheckedChange={() => toggleHeat("matured")}
                        />
                        <Label htmlFor="heat-matured" className="cursor-pointer">Mature</Label>
                      </div>
                    </div>
                  </div>

                  {(selectedStatuses.length > 0 || selectedSources.length > 0 || selectedHeats.length > 0) && (
                    <Button variant="outline" className="w-full" onClick={clearFilters}>
                      Clear All Filters
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Available Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredLeads.map((lead: any) => (
                <div
                  key={lead._id}
                  className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleLeadSelection(String(lead._id))}
                >
                  <Checkbox
                    checked={selectedLeadIds.includes(String(lead._id))}
                    onCheckedChange={() => toggleLeadSelection(String(lead._id))}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-sm text-gray-600">{lead.email} • {lead.mobileNo}</div>
                    <div className="text-xs text-gray-500">{lead.subject}</div>
                  </div>
                  <div className="flex gap-2">
                    {lead.heat && <Badge variant="secondary" className="capitalize">{lead.heat}</Badge>}
                    <Badge variant="outline" className="capitalize">{lead.source}</Badge>
                  </div>
                </div>
              ))}
              {filteredLeads.length === 0 && (
                <div className="text-center py-8 text-gray-500">No leads found</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/campaigns")}>
            Cancel
          </Button>
          <Button onClick={handleSaveRecipients}>
            Save Recipients ({selectedLeadIds.length})
          </Button>
        </div>
      </div>
    </Layout>
  );
}
