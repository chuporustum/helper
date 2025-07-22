"use client";

import { ArrowUpDown, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useIsMobile } from "@/components/hooks/use-mobile";
import { PageHeader } from "@/components/pageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { IssueGroupCard } from "./issueGroupCard";

export default function CommonIssuesPage() {
  const isMobile = useIsMobile();
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"frequency" | "recent">("frequency");
  const limit = 20;

  // Reset page when search or sort changes
  useEffect(() => {
    setPage(0);
  }, [searchQuery, sortBy]);

  const { data, isLoading, error } = api.mailbox.issueGroups.list.useQuery({
    limit: limit * (page + 1),
    offset: 0,
  });

  const { data: pinnedData, refetch: refetchPinned } = api.mailbox.issueGroups.pinnedList.useQuery();

  const pinMutation = api.mailbox.issueGroups.pin.useMutation({
    onSuccess: () => {
      toast.success("Issue group bookmarked");
      refetchPinned();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unpinMutation = api.mailbox.issueGroups.unpin.useMutation({
    onSuccess: () => {
      toast.success("Issue group unbookmarked");
      refetchPinned();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const filteredAndSortedGroups = useMemo(() => {
    if (!data?.groups) return [];

    let filtered = data.groups;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (group) => group.title.toLowerCase().includes(query) || group.description?.toLowerCase().includes(query),
      );
    }

    filtered.sort((a, b) => {
      if (sortBy === "frequency") {
        return b.openCount - a.openCount;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return filtered;
  }, [data?.groups, searchQuery, sortBy]);

  const handlePinGroup = (groupId: number) => {
    pinMutation.mutate({ id: groupId });
  };

  const handleUnpinGroup = (groupId: number) => {
    unpinMutation.mutate({ id: groupId });
  };

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
        <div className="border-b">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-semibold">Common Issues</h1>
              </div>

              <div className="flex-1 flex justify-center px-8">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder={`Search ${data?.groups.length || 0} issues`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
              </div>

              <div className="flex-1 flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2">
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
            </div>
          </div>
        </div>

        <div className="p-4 pl-6 space-y-4">
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-stretch">
                {filteredAndSortedGroups.map((group) => {
                  const isPinned = pinnedData?.groups.some((p) => p.id === group.id) ?? false;

                  return (
                    <IssueGroupCard
                      key={group.id}
                      group={group}
                      isPinned={isPinned}
                      onPin={handlePinGroup}
                      onUnpin={handleUnpinGroup}
                    />
                  );
                })}
              </div>

              {data?.groups?.length === limit * (page + 1) && !searchQuery && (
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
