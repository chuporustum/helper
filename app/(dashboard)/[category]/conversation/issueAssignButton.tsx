"use client";

import { GitBranch, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { useConversationContext } from "./conversationContext";

export const IssueAssignButton = ({ initialIssueGroupId }: { initialIssueGroupId: number | null }) => {
  const { conversationSlug, data: conversationInfo } = useConversationContext();
  const [selectedIssueId, setSelectedIssueId] = useState<string>(
    initialIssueGroupId ? initialIssueGroupId.toString() : "none",
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueDescription, setNewIssueDescription] = useState("");

  const { data: issueGroups } = api.mailbox.issueGroups.listAll.useQuery();
  const utils = api.useUtils();

  const assignMutation = api.mailbox.issueGroups.assignConversation.useMutation({
    onSuccess: () => {
      toast.success("Issue assignment updated successfully");
      utils.mailbox.conversations.get.invalidate({ conversationSlug });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createMutation = api.mailbox.issueGroups.create.useMutation({
    onSuccess: async (newGroup) => {
      toast.success("Issue group created successfully");
      await utils.mailbox.issueGroups.listAll.invalidate();
      setCreateDialogOpen(false);
      setNewIssueTitle("");
      setNewIssueDescription("");

      // Assign the conversation to the newly created issue group
      if (conversationInfo?.id) {
        assignMutation.mutate({
          conversationId: conversationInfo.id,
          issueGroupId: newGroup.id,
        });
        setSelectedIssueId(newGroup.id.toString());
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const currentIssue = issueGroups?.groups.find((group) => group.id === initialIssueGroupId);

  const handleAssign = (issueGroupId: string) => {
    if (issueGroupId === "create-new") {
      setCreateDialogOpen(true);
      return;
    }
    setSelectedIssueId(issueGroupId);

    const issueId = issueGroupId === "none" ? null : parseInt(issueGroupId);

    if (conversationInfo?.id) {
      assignMutation.mutate({
        conversationId: conversationInfo.id,
        issueGroupId: issueId,
      });
    }
  };

  const handleClear = () => {
    setSelectedIssueId("none");
    if (conversationInfo?.id) {
      assignMutation.mutate({
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
        <SelectTrigger className="w-full h-8 text-sm min-w-0">
          <div className="flex items-center gap-1 min-w-0 overflow-hidden">
            <GitBranch className="h-3 w-3 flex-shrink-0" />
            <SelectValue placeholder="Assign to issue..." className="truncate min-w-0" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground text-sm">No issue assigned</span>
          </SelectItem>
          <SelectItem value="create-new">
            <div className="flex items-center gap-1">
              <Plus className="h-3 w-3" />
              <span className="text-sm">Create new issue</span>
            </div>
          </SelectItem>
          {issueGroups.groups.map((group) => (
            <SelectItem key={group.id} value={group.id.toString()}>
              <span className="text-sm truncate block max-w-[200px]" title={group.title}>
                {group.title}
              </span>
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Issue Group</DialogTitle>
            <DialogDescription>Create a new issue group to categorize similar conversations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newIssueTitle}
                onChange={(e) => setNewIssueTitle(e.target.value)}
                placeholder="e.g., Login & Authentication Issues"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={newIssueDescription}
                onChange={(e) => setNewIssueDescription(e.target.value)}
                placeholder="Describe the type of issues in this group..."
                maxLength={1000}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outlined"
              onClick={() => {
                setCreateDialogOpen(false);
                setNewIssueTitle("");
                setNewIssueDescription("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newIssueTitle.trim()) {
                  createMutation.mutate({
                    title: newIssueTitle.trim(),
                    description: newIssueDescription.trim() || undefined,
                  });
                }
              }}
              disabled={!newIssueTitle.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Issue Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
