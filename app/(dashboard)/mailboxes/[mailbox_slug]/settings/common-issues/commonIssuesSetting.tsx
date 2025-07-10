"use client";

import { GitBranch, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/confirmationDialog";
import { toast } from "@/components/hooks/use-toast";
import LoadingSpinner from "@/components/loadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import SectionWrapper from "../sectionWrapper";

type CommonIssuesSettingProps = {
  mailboxSlug: string;
};

const CommonIssuesSetting = ({ mailboxSlug }: CommonIssuesSettingProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueDescription, setNewIssueDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const { data, isLoading, refetch } = api.mailbox.issueGroups.listAll.useQuery({ mailboxSlug });
  const issueGroups = data?.groups ?? [];

  const createMutation = api.mailbox.issueGroups.create.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Issue group created successfully",
      });
      setIsCreating(false);
      setNewIssueTitle("");
      setNewIssueDescription("");
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = api.mailbox.issueGroups.update.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Issue group updated successfully",
      });
      setEditingId(null);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = api.mailbox.issueGroups.delete.useMutation({
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: `Issue group deleted. ${result.unassignedConversations} conversations unassigned.`,
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredIssueGroups = issueGroups.filter((group) => {
    const searchString = searchTerm.toLowerCase();
    return group.title.toLowerCase().includes(searchString) || group.description?.toLowerCase().includes(searchString);
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueTitle.trim()) return;

    createMutation.mutate({
      mailboxSlug,
      title: newIssueTitle.trim(),
      description: newIssueDescription.trim() || undefined,
    });
  };

  const handleEditSubmit = (id: number) => {
    if (!editTitle.trim()) return;

    updateMutation.mutate({
      mailboxSlug,
      id,
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
    });
  };

  const handleEdit = (group: (typeof issueGroups)[0]) => {
    setEditingId(group.id);
    setEditTitle(group.title);
    setEditDescription(group.description || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ mailboxSlug, id });
  };

  if (isLoading) {
    return (
      <SectionWrapper
        title="Common Issues"
        description="Manage predefined issue categories for manual assignment"
        fullWidth
      >
        <LoadingSpinner />
      </SectionWrapper>
    );
  }

  return (
    <SectionWrapper
      title={
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Common Issues
        </div>
      }
      description="Create and manage predefined issue categories. Support staff can manually assign conversations to these specific issues for better organization and bulk handling."
      fullWidth
    >
      <div className="space-y-6">
        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overview</CardTitle>
            <CardDescription>Current issue groups and their usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{issueGroups.length}</div>
                <div className="text-sm text-muted-foreground">Total Issues</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {issueGroups.reduce((sum, group) => sum + (group.conversationCount || 0), 0)}
                </div>
                <div className="text-sm text-muted-foreground">Assigned Conversations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {issueGroups.filter((group) => (group.conversationCount || 0) > 0).length}
                </div>
                <div className="text-sm text-muted-foreground">Active Issues</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add New Issue Form */}
        {isCreating ? (
          <Card>
            <CardHeader>
              <CardTitle>Create New Issue</CardTitle>
              <CardDescription>
                Define a specific, actionable issue category that support agents can assign conversations to
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newIssueTitle}
                    onChange={(e) => setNewIssueTitle(e.target.value)}
                    placeholder="e.g., Cannot receive 2FA SMS codes"
                    maxLength={200}
                    required
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Be specific and actionable. Good: "Password reset email not arriving". Bad: "Login issues".
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newIssueDescription}
                    onChange={(e) => setNewIssueDescription(e.target.value)}
                    placeholder="Additional details about this issue type, common causes, or resolution steps..."
                    maxLength={1000}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending || !newIssueTitle.trim()}>
                    {createMutation.isPending ? "Creating..." : "Create Issue"}
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => {
                      setIsCreating(false);
                      setNewIssueTitle("");
                      setNewIssueDescription("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="flex justify-between items-center">
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Search issues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                iconsPrefix={<Search className="h-4 w-4 text-muted-foreground" />}
              />
            </div>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Issue
            </Button>
          </div>
        )}

        {/* Issues Table */}
        {filteredIssueGroups.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Conversations</TableHead>
                  <TableHead className="text-center">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIssueGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">
                      {editingId === group.id ? (
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          maxLength={200}
                          className="font-medium"
                        />
                      ) : (
                        <div className="max-w-xs truncate" title={group.title}>
                          {group.title}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === group.id ? (
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          maxLength={1000}
                          rows={2}
                          className="text-sm"
                        />
                      ) : (
                        <div className="max-w-sm text-sm text-muted-foreground">
                          {group.description ? (
                            <div className="truncate" title={group.description}>
                              {group.description}
                            </div>
                          ) : (
                            <span className="italic">No description</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">{group.conversationCount || 0}</span>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {new Date(group.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {editingId === group.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleEditSubmit(group.id)}
                              disabled={updateMutation.isPending || !editTitle.trim()}
                            >
                              {updateMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                            <Button size="sm" variant="outlined" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outlined" onClick={() => handleEdit(group)}>
                              Edit
                            </Button>
                            <ConfirmationDialog
                              message={`Are you sure you want to delete "${group.title}"? ${group.conversationCount || 0} conversations will be unassigned from this issue.`}
                              onConfirm={() => handleDelete(group.id)}
                              confirmLabel="Delete Issue"
                              confirmVariant="destructive"
                            >
                              <Button size="sm" variant="destructive" disabled={deleteMutation.isPending}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </ConfirmationDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{searchTerm ? "No issues found" : "No issue groups yet"}</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm
                  ? "Try adjusting your search terms"
                  : "Create specific issue categories to help organize and prioritize support conversations"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Issue
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </SectionWrapper>
  );
};

export default CommonIssuesSetting;
