"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VipBadge } from "./vipBadge";
import { VolumeBadge } from "./volumeBadge";

interface IssueGroupCardProps {
  group: {
    id: number;
    title: string;
    description?: string | null;
    openCount: number;
    todayCount?: number;
    weekCount?: number;
    monthCount?: number;
    vipCount?: number;
  };
  isPinned: boolean;
  onPin: (groupId: number) => void;
  onUnpin: (groupId: number) => void;
}

export function IssueGroupCard({ group, isPinned, onPin, onUnpin }: IssueGroupCardProps) {
  const affectedUsers = group.openCount;
  const cleanTitle = group.title.replace(/^\d+\s+/, "");

  return (
    <div
      className="group relative cursor-pointer h-full"
      style={{
        perspective: "1200px",
        transformStyle: "preserve-3d",
      }}
    >
      {/* Subtle stacked cards effect */}
      <div className="absolute inset-0 transform translate-x-1 translate-y-1 opacity-20 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform duration-300">
        <Card className="h-full border shadow-xs bg-muted/20" />
      </div>
      <div className="absolute inset-0 transform translate-x-0.5 translate-y-0.5 opacity-30 group-hover:translate-x-1 group-hover:translate-y-1 transition-transform duration-300">
        <Card className="h-full border shadow-xs bg-muted/30" />
      </div>

      <Card className="relative z-10 transition-shadow duration-200 flex flex-col hover:shadow-md cursor-pointer h-full">
        <CardHeader className="pb-3 flex-1">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-lg font-semibold line-clamp-2 flex-1">
                  <Link href={`/all?issueGroupId=${group.id}`} className="hover:underline">
                    {affectedUsers} {cleanTitle}
                  </Link>
                </CardTitle>
              </div>

              {group.description && (
                <CardDescription className="line-clamp-2 text-sm mb-2">
                  {group.description}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center">
              <PinButton
                isPinned={isPinned}
                onPin={() => onPin(group.id)}
                onUnpin={() => onUnpin(group.id)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <VolumeBadge
                todayCount={group.todayCount}
                weekCount={group.weekCount}
                monthCount={group.monthCount}
              />
              <VipBadge vipCount={group.vipCount} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Pin button component
function PinButton({
  isPinned,
  onPin,
  onUnpin,
}: {
  isPinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 hover:bg-muted transition-colors"
      onClick={isPinned ? onUnpin : onPin}
    >
      {isPinned ? (
        <BookmarkCheck className="h-4 w-4 text-yellow-600" />
      ) : (
        <Bookmark className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}