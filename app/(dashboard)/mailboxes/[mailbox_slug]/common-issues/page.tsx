"use client";

import {
  ArrowUpDown,
  MoreHorizontal,
  Pin,
  PinOff,
  Search,
  Share2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfirmationDialog } from "@/components/confirmationDialog";
import { useIsMobile } from "@/components/hooks/use-mobile";
import { toast } from "@/components/hooks/use-toast";
import { PageHeader } from "@/components/pageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { issueGroupsChannelId } from "@/lib/realtime/channels";
import { useRealtimeEventOnce } from "@/lib/realtime/hooks";
import { api } from "@/trpc/react";

export default function CommonIssuesPage() {
  const params = useParams();
  const mailboxSlug = params.mailbox_slug as string;
  const isMobile = useIsMobile();
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"frequency" | "recent">("frequency");
  const limit = 20;

  const { data, isLoading, error, refetch } = api.mailbox.issueGroups.list.useQuery({
    mailboxSlug,
    limit,
    offset: page * limit,
  });

  const { data: pinnedData, refetch: refetchPinned } = api.mailbox.issueGroups.pinnedList.useQuery({
    mailboxSlug,
  });

  const pinMutation = api.mailbox.issueGroups.pin.useMutation({
    onSuccess: () => {
      toast({
        title: "Pinned",
        description: "Issue group added to sidebar",
      });
      refetchPinned();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unpinMutation = api.mailbox.issueGroups.unpin.useMutation({
    onSuccess: () => {
      toast({
        title: "Unpinned",
        description: "Issue group removed from sidebar",
      });
      refetchPinned();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter and sort groups based on search and sort criteria
  const filteredAndSortedGroups = useMemo(() => {
    if (!data?.groups) return [];

    let filtered = data.groups;

    // Client-side search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (group) =>
          group.title.toLowerCase().includes(query) ||
          (group.description && group.description.toLowerCase().includes(query)),
      );
    }

    // Sort by frequency (open count) or recent updates
    filtered.sort((a, b) => {
      if (sortBy === "frequency") {
        return b.openCount - a.openCount;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return filtered;
  }, [data?.groups, searchQuery, sortBy]);

  const bulkCloseAllMutation = api.mailbox.issueGroups.bulkCloseAll.useMutation({
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: `Closed ${result.updatedCount} conversations`,
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

  const handleBulkCloseAll = (groupId: number, cleanTitle: string, openCount: number) => {
    bulkCloseAllMutation.mutate({ mailboxSlug, id: groupId });
  };

  const handleShareGroup = (groupId: number, cleanTitle: string) => {
    const url = `${window.location.origin}/mailboxes/${mailboxSlug}/all?issueGroupId=${groupId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Issue group link copied to clipboard",
    });
  };


  const handlePinGroup = (groupId: number, cleanTitle: string) => {
    pinMutation.mutate({ mailboxSlug, id: groupId });
  };

  const handleUnpinGroup = (groupId: number, cleanTitle: string) => {
    unpinMutation.mutate({ mailboxSlug, id: groupId });
  };


  // Listen for realtime updates
  useRealtimeEventOnce(issueGroupsChannelId(mailboxSlug), "issueGroupUpdated", () => {
    refetch();
  });

  if (error) {
    return (
      <div className="flex flex-col h-full">
        {isMobile && <PageHeader title="Common Issues" variant="mahogany" />}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-medium">Error loading issue groups</h3>
            <p className="text-muted-foreground mt-2">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {isMobile && <PageHeader title="Common Issues" variant="mahogany" />}

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Header with title and controls */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Common Issues</h1>
              <p className="text-muted-foreground">Groups of conversations about similar topics</p>
            </div>
            {/* Search bar centered */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={`Search ${data?.groups.length || 0} issues`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Sort control in top right */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outlined" className="gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  {sortBy === "frequency" ? "Frequency" : "Recent"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy("frequency")}>Sort by Frequency</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("recent")}>Sort by Recent</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAndSortedGroups.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">{searchQuery ? "No issues found" : "No issue groups yet"}</h3>
              <p className="mt-2 text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search terms"
                  : "Issue groups will appear here as conversations are automatically clustered by topic."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredAndSortedGroups.map((group) => {
                  const isPinned = pinnedData?.groups.some(p => p.id === group.id) ?? false;

                  // Use actual open count from the group data
                  const affectedUsers = group.openCount;

                  // Clean title by removing any existing number prefix
                  const cleanTitle = group.title.replace(/^\d+\s+/, "");

                  return (
                    <Card key={group.id} className={`hover:shadow-md transition-shadow flex flex-col h-full ${isPinned ? 'ring-1 ring-orange-200 bg-orange-50/30' : ''}`}>
                      <CardHeader className="pb-3 flex-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-lg line-clamp-2 flex-1">
                                <Link
                                  href={`/mailboxes/${mailboxSlug}/all?issueGroupId=${group.id}`}
                                  className="hover:underline"
                                >
                                  {affectedUsers} {cleanTitle}
                                </Link>
                              </CardTitle>
                              {isPinned && (
                                <Pin className="h-3 w-3 text-orange-600 flex-shrink-0" />
                              )}
                            </div>

                            {/* Always reserve space for description to maintain consistent height */}
                            <div className="h-10 mb-2">
                              {group.description && (
                                <CardDescription className="line-clamp-2 text-sm">{group.description}</CardDescription>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleShareGroup(group.id, cleanTitle)}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => isPinned ? handleUnpinGroup(group.id, cleanTitle) : handlePinGroup(group.id, cleanTitle)}
                            >
                              {isPinned ? (
                                <PinOff className="h-4 w-4 text-orange-600" />
                              ) : (
                                <Pin className="h-4 w-4" />
                              )}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <ConfirmationDialog
                                  message={`Are you sure you want to close all ${group.openCount} conversation${group.openCount !== 1 ? "s" : ""} in "${cleanTitle}"?`}
                                  onConfirm={() => handleBulkCloseAll(group.id, cleanTitle, group.openCount)}
                                  confirmLabel="Yes, close all"
                                  confirmVariant="bright"
                                >
                                  <DropdownMenuItem
                                    disabled={group.openCount === 0 || bulkCloseAllMutation.isPending}
                                    onSelect={(e) => e.preventDefault()}
                                  >
                                    <X className="mr-2 h-4 w-4" />
                                    Close all ({group.openCount})
                                  </DropdownMenuItem>
                                </ConfirmationDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 mt-auto">
                        {/* Time-based and VIP badges like Figma */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {(() => {
                            // Ensure numeric values
                            const todayCount = Number(group.todayCount ?? 0);
                            const weekCount = Number(group.weekCount ?? 0);
                            const monthCount = Number(group.monthCount ?? 0);

                            // Priority: today → week → month (like Figma design)
                            if (todayCount > 0) {
                              const badgeClass =
                                todayCount >= 10
                                  ? "bg-red-50 text-red-700 border-red-200" // High volume
                                  : "bg-orange-50 text-orange-700 border-orange-200"; // Medium/low volume

                              return (
                                <Badge variant="gray" className={`${badgeClass} text-xs`}>
                                  📅 {todayCount} new ticket{todayCount !== 1 ? "s" : ""} today
                                </Badge>
                              );
                            } else if (weekCount > 0) {
                              return (
                                <Badge variant="gray" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">
                                  📅 {weekCount} new ticket{weekCount !== 1 ? "s" : ""} this week
                                </Badge>
                              );
                            } else if (monthCount > 0) {
                              return (
                                <Badge variant="gray" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">
                                  📅 {monthCount} new ticket{monthCount !== 1 ? "s" : ""} this month
                                </Badge>
                              );
                            }
                            return (
                              <Badge variant="gray" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">
                                📅 No new tickets
                              </Badge>
                            );
                          })()}

                          {/* VIP badge - only show if there are VIP users */}
                          {(() => {
                            const vipCount = Number(group.vipCount ?? 0);
                            if (vipCount > 0) {
                              return (
                                <Badge
                                  variant="gray"
                                  className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"
                                >
                                  ⭐ {vipCount} VIP user{vipCount !== 1 ? "s" : ""}
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {data?.groups && data.groups.length === limit && !searchQuery && (
                <div className="flex justify-center mt-6">
                  <Button onClick={() => setPage(page + 1)} variant="outlined">
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
