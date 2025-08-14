import { ChevronDown, ChevronRight, ChevronUp, Clock, User } from "lucide-react";
import { useState } from "react";
import { useConversationListContext } from "@/app/(dashboard)/[category]/list/conversationListContext";
import HumanizedTime from "@/components/humanizedTime";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export const NextTicketPreview = ({ className }: { className?: string }) => {
  const { conversationListData, currentIndex } = useConversationListContext();
  const { data: mailboxPreferences } = api.mailbox.get.useQuery();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Check if the feature is enabled
  const showNextTicketPreview = mailboxPreferences?.preferences?.showNextTicketPreview ?? true; // Default to true

  if (!conversationListData?.conversations || !showNextTicketPreview) return null;

  const conversations = conversationListData.conversations;
  const nextConversation = conversations[currentIndex + 1] || conversations[0];

  // Don't show preview if there's only one conversation or no next conversation
  if (conversations.length <= 1 || !nextConversation) return null;

  const isLastConversation = currentIndex === conversations.length - 1;

  return (
    <div className={cn("border rounded-lg bg-muted/30 transition-all duration-200", className)}>
      <div
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted/50"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-medium text-muted-foreground">{isLastConversation ? "First ticket" : "Next"}:</h4>
          <span
            className="text-xs font-medium truncate max-w-[200px]"
            title={nextConversation.subject || "(no subject)"}
          >
            {nextConversation.subject || "(no subject)"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          {isCollapsed ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="px-2 pb-2 space-y-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[150px]" title={nextConversation.from}>
                {nextConversation.from}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <HumanizedTime time={new Date(nextConversation.createdAt)} />
            </div>
          </div>

          {nextConversation.latestMessage && (
            <div className="text-xs text-muted-foreground line-clamp-1">{nextConversation.latestMessage}</div>
          )}
        </div>
      )}
    </div>
  );
};
