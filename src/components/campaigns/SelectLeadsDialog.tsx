import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import { LEAD_STATUS } from "@/convex/schema";

interface SelectLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allLeads: any[];
  selectedLeads: string[];
  setSelectedLeads: (leads: string[]) => void;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMoreLeads: () => void;
}

export function SelectLeadsDialog({
  open,
  onOpenChange,
  allLeads,
  selectedLeads,
  setSelectedLeads,
  isLoadingMore,
  hasMore,
  loadMoreLeads,
}: SelectLeadsDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedHeats, setSelectedHeats] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const uniqueSources = useMemo(() => {
    if (!allLeads || allLeads.length === 0) return [];
    const sources = new Set<string>();
    allLeads.forEach((lead: any) => {
      if (lead?.source) {
        sources.add(lead.source);
      }
    });
    return Array.from(sources).sort();
  }, [allLeads]);

  const filteredLeads = useMemo(() => {
    if (!allLeads || allLeads.length === 0) return [];
    let leads = allLeads;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      leads = leads.filter((lead: any) => {
        return (
          lead.name?.toLowerCase().includes(search) ||
          lead.email?.toLowerCase().includes(search) ||
          lead.mobileNo?.includes(search) ||
          lead.agencyName?.toLowerCase().includes(search) ||
          lead.state?.toLowerCase().includes(search) ||
          lead.district?.toLowerCase().includes(search)
        );
      });
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      leads = leads.filter((lead: any) => {
        const leadStatus = lead?.status || LEAD_STATUS.YET_TO_DECIDE;
        return selectedStatuses.includes(leadStatus);
      });
    }

    // Source filter
    if (selectedSources.length > 0) {
      leads = leads.filter((lead: any) => {
        const leadSource = lead?.source || "";
        return selectedSources.includes(leadSource);
      });
    }

    // Heat filter
    if (selectedHeats.length > 0) {
      leads = leads.filter((lead: any) => {
        const leadHeat = lead?.heat || "";
        return selectedHeats.includes(leadHeat);
      });
    }

    return leads;
  }, [allLeads, searchTerm, selectedStatuses, selectedSources, selectedHeats]);

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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    
    if (bottom && hasMore && !isLoadingMore) {
      loadMoreLeads();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Leads for Campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, mobile, agency..."
                className="pl-10"
              />
            </div>
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                  {(selectedStatuses.length > 0 || selectedSources.length > 0 || selectedHeats.length > 0) && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedStatuses.length + selectedSources.length + selectedHeats.length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter Leads</SheetTitle>
                  <SheetDescription>
                    Select multiple filters to refine your lead selection
                  </SheetDescription>
                </SheetHeader>
                
                <div className="mt-6 space-y-6">
                  {/* Status Filters */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Status</h3>
                      {selectedStatuses.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedStatuses([])}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="filter-status-relevant"
                          checked={selectedStatuses.includes(LEAD_STATUS.RELEVANT)}
                          onCheckedChange={() => toggleStatus(LEAD_STATUS.RELEVANT)}
                        />
                        <Label htmlFor="filter-status-relevant" className="cursor-pointer">
                          Relevant
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="filter-status-yet-to-decide"
                          checked={selectedStatuses.includes(LEAD_STATUS.YET_TO_DECIDE)}
                          onCheckedChange={() => toggleStatus(LEAD_STATUS.YET_TO_DECIDE)}
                        />
                        <Label htmlFor="filter-status-yet-to-decide" className="cursor-pointer">
                          Yet to Decide
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Source Filters */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Lead Source</h3>
                      {selectedSources.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedSources([])}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {uniqueSources.map((source) => (
                        <div key={source} className="flex items-center space-x-2">
                          <Checkbox
                            id={`filter-source-${source}`}
                            checked={selectedSources.includes(source)}
                            onCheckedChange={() => toggleSource(source)}
                          />
                          <Label htmlFor={`filter-source-${source}`} className="cursor-pointer capitalize">
                            {source}
                          </Label>
                        </div>
                      ))}
                      {uniqueSources.length === 0 && (
                        <p className="text-sm text-gray-500">No sources available</p>
                      )}
                    </div>
                  </div>

                  {/* Heat Filters */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Lead Type</h3>
                      {selectedHeats.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedHeats([])}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="filter-heat-hot"
                          checked={selectedHeats.includes("hot")}
                          onCheckedChange={() => toggleHeat("hot")}
                        />
                        <Label htmlFor="filter-heat-hot" className="cursor-pointer">
                          Hot
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="filter-heat-cold"
                          checked={selectedHeats.includes("cold")}
                          onCheckedChange={() => toggleHeat("cold")}
                        />
                        <Label htmlFor="filter-heat-cold" className="cursor-pointer">
                          Cold
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="filter-heat-matured"
                          checked={selectedHeats.includes("matured")}
                          onCheckedChange={() => toggleHeat("matured")}
                        />
                        <Label htmlFor="filter-heat-matured" className="cursor-pointer">
                          Mature
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Clear All Button */}
                  {(selectedStatuses.length > 0 || selectedSources.length > 0 || selectedHeats.length > 0) && (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={clearFilters}
                    >
                      Clear All Filters
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          <div 
            className="border rounded-lg max-h-96 overflow-y-auto"
            onScroll={handleScroll}
          >
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
                  <div className="text-sm text-gray-500">
                    {lead.email} • {lead.mobileNo}
                    {lead.source && <span className="ml-2 capitalize">• {lead.source}</span>}
                    {lead.heat && <Badge variant="outline" className="ml-2 capitalize">{lead.heat}</Badge>}
                  </div>
                </div>
              </div>
            ))}
            {isLoadingMore && (
              <div className="p-4 text-center text-gray-500">
                Loading more leads...
              </div>
            )}
            {!hasMore && allLeads.length > 0 && (
              <div className="p-4 text-center text-gray-400 text-sm">
                All leads loaded ({allLeads.length} total)
              </div>
            )}
            {filteredLeads.length === 0 && !isLoadingMore && (
              <div className="p-8 text-center text-gray-500">
                No leads match your filters
              </div>
            )}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Confirm Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
