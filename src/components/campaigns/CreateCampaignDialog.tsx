import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
  selectedLeadsCount: number;
  onSelectLeadsClick: () => void;
}

export function CreateCampaignDialog({
  open,
  onOpenChange,
  onCreate,
  selectedLeadsCount,
  onSelectLeadsClick,
}: CreateCampaignDialogProps) {
  const [campaignName, setCampaignName] = useState("");

  const handleCreate = () => {
    onCreate(campaignName);
    setCampaignName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Label>Selected Leads: {selectedLeadsCount}</Label>
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={onSelectLeadsClick}
            >
              Select Leads
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>
            Create & Build Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
