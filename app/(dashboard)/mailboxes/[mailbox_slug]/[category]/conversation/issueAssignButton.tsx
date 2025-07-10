"use client";

import { GitBranch, X } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { useConversationContext } from "./conversationContext";

export const IssueAssignButton = ({ initialIssueGroupId }: { initialIssueGroupId: number | null }) => {
  const { mailboxSlug, conversationSlug, data: conversationInfo } = useConversationContext();
  const [selectedIssueId, setSelectedIssueId] = useState<string>(
    initialIssueGroupId ? initialIssueGroupId.toString() : "",
  );

  const { data: issueGroups } = api.mailbox.issueGroups.list.useQuery({ mailboxSlug });
  const utils = api.useUtils();

  const assignMutation = api.mailbox.issueGroups.assignConversation.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Issue assignment updated successfully",
      });
      // Refresh conversation data
      utils.mailbox.conversations.get.invalidate({ mailboxSlug, conversationSlug });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const currentIssue = issueGroups?.groups.find((group) => group.id === initialIssueGroupId);

  const handleAssign = (issueGroupId: string) => {
    setSelectedIssueId(issueGroupId);

    const issueId = issueGroupId === "" ? null : parseInt(issueGroupId);

    if (conversationInfo?.id) {
      assignMutation.mutate({
        mailboxSlug,
        conversationId: conversationInfo.id,
        issueGroupId: issueId,
      });
    }
  };

  const handleClear = () => {
    setSelectedIssueId("");
    if (conversationInfo?.id) {
      assignMutation.mutate({
        mailboxSlug,
        conversationId: conversationInfo.id,
        issueGroupId: null,
      });
    }
  };

  if (!issueGroups?.groups.length) {
    return <span className="text-muted-foreground text-sm">No issues available</span>;
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Select value={selectedIssueId} onValueChange={handleAssign}>
        <SelectTrigger className="w-full h-8 text-sm">
          <div className="flex items-center gap-1 min-w-0">
            <GitBranch className="h-4 w-4 flex-shrink-0" />
            <SelectValue placeholder="Assign to issue..." className="truncate" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">
            <span className="text-muted-foreground">No issue assigned</span>
          </SelectItem>
          {issueGroups.groups.map((group) => (
            <SelectItem key={group.id} value={group.id.toString()}>
              <div className="flex flex-col">
                <span className="truncate">{group.title}</span>
                {group.description && (
                  <span className="text-xs text-muted-foreground truncate">{group.description}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {currentIssue && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={handleClear}
          className="h-8 w-8 flex-shrink-0"
          title="Clear issue assignment"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};
