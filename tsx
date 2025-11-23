import { TemplatesDialog } from "./TemplatesDialog";

interface ChatAreaProps {
  // ...
  onSendTemplate: (template: any) => void;
}

export function ChatArea({
  // ...
  onSendTemplate,
}: ChatAreaProps) {
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  const handleSendWelcomeMessage = async () => {
    // ...
  };

  const handleSendTemplateWrapper = async (template: any) => {
    // ... implementation
  };

  // Inside your component function or where the templates are handled:
  {selectedLeadId && (
    <>
      <Button
        onClick={() => setIsTemplatesOpen(true)}
        variant="outline"
        size="sm"
        className="ml-2"
      >
        Templates
      </Button>
      <TemplatesDialog 
        open={isTemplatesOpen} 
        onOpenChange={setIsTemplatesOpen}
        onSendTemplate={(template) => {
          onSendTemplate(template);
          setIsTemplatesOpen(false);
        }}
      />
    </>
  )}

  {selectedLeadId && !lead?.welcomeMessageSent && (
    <Button
      onClick={handleSendWelcomeMessage}
      variant="outline"
      size="sm"
      className="ml-2"
    >
      Send Welcome Message
    </Button>
  )}
}