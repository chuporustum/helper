import { GitBranch } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/trpc/react";

export const IssueGroupFilter = memo(function IssueGroupFilter({
  issueGroupId,
  onChange,
}: {
  issueGroupId: number | null;
  onChange: (issueGroupId: number | null) => void;
}) {
  const { data: issueGroups, isLoading } = api.mailbox.issueGroups.listAll.useQuery();

  const selectedGroup = issueGroups?.groups.find((group) => group.id === issueGroupId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={issueGroupId ? "bright" : "outlined_subtle"} className="whitespace-nowrap">
          <GitBranch className="h-4 w-4 mr-2" />
          {selectedGroup ? selectedGroup.title : "Issue Group"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-xs">
        <DropdownMenuRadioGroup
          value={issueGroupId?.toString() ?? "all"}
          onValueChange={(value) => onChange(value === "all" ? null : parseInt(value))}
          className="flex flex-col"
        >
          <DropdownMenuRadioItem value="all">All conversations</DropdownMenuRadioItem>
          {isLoading ? (
            <DropdownMenuRadioItem value="loading" disabled>
              Loading...
            </DropdownMenuRadioItem>
          ) : (
            issueGroups?.groups.map((group) => (
              <DropdownMenuRadioItem key={group.id} value={group.id.toString()}>
                <span className="truncate">{group.title}</span>
              </DropdownMenuRadioItem>
            ))
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});