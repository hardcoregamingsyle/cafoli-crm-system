import { Layout } from "@/components/Layout";
import { useCrmAuth } from "@/hooks/use-crm-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { 
  Mail, 
  MessageSquare, 
  MessageCircle, 
  Clock, 
  GitBranch, 
  Save, 
  Play,
  ArrowLeft,
  Trash2
} from "lucide-react";

type BlockType = "whatsapp" | "email" | "sms" | "wait" | "query_repeat" | "query_email" | "query_sms" | "query_whatsapp";

interface WorkflowBlock {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  config?: any;
}

interface Connection {
  from: string;
  to: string;
}

interface Workflow {
  blocks: WorkflowBlock[];
  connections: Connection[];
}

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

export default function CampaignWorkflowEditor() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { currentUser, initializeAuth } = useCrmAuth();
  const [authReady, setAuthReady] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow>({ blocks: [], connections: [] });
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [draggingBlock, setDraggingBlock] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeAuth();
    const timer = setTimeout(() => setAuthReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const campaign = useQuery(
    (api as any).campaigns.getCampaignById,
    authReady && currentUser?._id && campaignId
      ? { currentUserId: currentUser._id, campaignId: campaignId as any }
      : "skip"
  );

  const updateCampaign = useMutation((api as any).campaigns.updateCampaign);

  useEffect(() => {
    if (campaign?.workflow) {
      setWorkflow(campaign.workflow);
    }
  }, [campaign]);

  const handleSaveWorkflow = async () => {
    if (!currentUser?._id || !campaignId) return;
    
    try {
      await updateCampaign({
        currentUserId: currentUser._id,
        campaignId: campaignId as any,
        workflow,
      });
      toast.success("Workflow saved successfully");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save workflow");
    }
  };

  const addBlock = (type: BlockType) => {
    const newBlock: WorkflowBlock = {
      id: `block-${Date.now()}`,
      type,
      x: 100,
      y: 100,
      config: {},
    };
    setWorkflow(prev => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
    }));
  };

  const deleteBlock = (blockId: string) => {
    setWorkflow(prev => ({
      blocks: prev.blocks.filter(b => b.id !== blockId),
      connections: prev.connections.filter(c => c.from !== blockId && c.to !== blockId),
    }));
    if (selectedBlock === blockId) setSelectedBlock(null);
  };

  const handleBlockMouseDown = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingBlock(blockId);
    setSelectedBlock(blockId);
  };

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingBlock || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setWorkflow(prev => ({
      ...prev,
      blocks: prev.blocks.map(block =>
        block.id === draggingBlock
          ? { ...block, x: x - 75, y: y - 25 }
          : block
      ),
    }));
  }, [draggingBlock]);

  const handleCanvasMouseUp = () => {
    setDraggingBlock(null);
  };

  const handleConnectStart = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnectingFrom(blockId);
  };

  const handleConnectEnd = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectingFrom && connectingFrom !== blockId) {
      const connectionExists = workflow.connections.some(
        c => c.from === connectingFrom && c.to === blockId
      );
      if (!connectionExists) {
        setWorkflow(prev => ({
          ...prev,
          connections: [...prev.connections, { from: connectingFrom, to: blockId }],
        }));
      }
    }
    setConnectingFrom(null);
  };

  if (!authReady || !currentUser) {
    return <Layout><div>Loading...</div></Layout>;
  }

  if (!campaign) {
    return (
      <Layout>
        <div className="text-center py-8">Campaign not found</div>
      </Layout>
    );
  }

  const getBlockInfo = (type: BlockType) => {
    return blockTypes.find(b => b.type === type) || blockTypes[0];
  };

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate("/campaigns")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{campaign.name}</h1>
              <p className="text-sm text-gray-500">Workflow Editor</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveWorkflow}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button>
              <Play className="w-4 h-4 mr-2" />
              Start Campaign
            </Button>
          </div>
        </div>

        {/* Block Palette */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Workflow Blocks</h3>
          <div className="flex flex-wrap gap-2">
            {blockTypes.map((block) => (
              <Button
                key={block.type}
                variant="outline"
                size="sm"
                onClick={() => addBlock(block.type)}
                className="gap-2"
              >
                <div className={`w-3 h-3 rounded ${block.color}`} />
                {block.label}
              </Button>
            ))}
          </div>
        </Card>

        {/* Canvas */}
        <Card className="relative overflow-hidden">
          <div
            ref={canvasRef}
            className="relative bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg"
            style={{ height: "600px", cursor: draggingBlock ? "grabbing" : "default" }}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          >
            {/* Render Connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
              {workflow.connections.map((conn, idx) => {
                const fromBlock = workflow.blocks.find(b => b.id === conn.from);
                const toBlock = workflow.blocks.find(b => b.id === conn.to);
                if (!fromBlock || !toBlock) return null;

                const x1 = fromBlock.x + 75;
                const y1 = fromBlock.y + 25;
                const x2 = toBlock.x + 75;
                const y2 = toBlock.y + 25;

                return (
                  <line
                    key={idx}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#3b82f6"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
                </marker>
              </defs>
            </svg>

            {/* Render Blocks */}
            {workflow.blocks.map((block) => {
              const blockInfo = getBlockInfo(block.type);
              const BlockIcon = blockInfo.icon;
              const isSelected = selectedBlock === block.id;

              return (
                <div
                  key={block.id}
                  className={`absolute ${blockInfo.color} text-white rounded-lg shadow-lg transition-all cursor-move ${
                    isSelected ? "ring-4 ring-blue-400" : ""
                  }`}
                  style={{
                    left: `${block.x}px`,
                    top: `${block.y}px`,
                    width: "150px",
                    padding: "12px",
                    zIndex: 10,
                  }}
                  onMouseDown={(e) => handleBlockMouseDown(block.id, e)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <BlockIcon className="w-4 h-4" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-white hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBlock(block.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="text-xs font-medium mb-2">{blockInfo.label}</div>
                  <div className="flex gap-1">
                    <button
                      className="flex-1 bg-white/20 hover:bg-white/30 rounded px-2 py-1 text-xs"
                      onClick={(e) => handleConnectStart(block.id, e)}
                    >
                      Connect
                    </button>
                    <button
                      className="flex-1 bg-white/20 hover:bg-white/30 rounded px-2 py-1 text-xs"
                      onClick={(e) => handleConnectEnd(block.id, e)}
                    >
                      {connectingFrom === block.id ? "Cancel" : "Receive"}
                    </button>
                  </div>
                </div>
              );
            })}

            {workflow.blocks.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <p className="text-lg font-medium">Empty Canvas</p>
                  <p className="text-sm">Add blocks from the palette above to start building your workflow</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
