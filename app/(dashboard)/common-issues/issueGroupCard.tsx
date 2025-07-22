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
    <div className="group relative cursor-pointer h-full" style={{ perspective: "1000px" }}>
      {/* Stacked cards effect with subtle rotation inspired by Figma design */}
      {/* Bottom card - most rotated and darkest */}
      <div className="absolute inset-0 transform translate-x-2 translate-y-1.5 rotate-[-0.6deg] origin-bottom-left group-hover:translate-x-2.5 group-hover:translate-y-2 group-hover:rotate-[-0.8deg] transition-all duration-300 ease-out opacity-80">
        <Card className="h-full border border-gray-300/50 shadow-md bg-gray-100/70" />
      </div>
      {/* Middle card */}
      <div className="absolute inset-0 transform translate-x-1 translate-y-0.5 rotate-[0.2deg] origin-bottom-right group-hover:translate-x-1.3 group-hover:translate-y-0.8 group-hover:rotate-[0.3deg] transition-all duration-300 ease-out opacity-90">
        <Card className="h-full border border-gray-200/40 shadow-sm bg-gray-50/60" />
      </div>

      {/* Main card */}
      <Card className="relative z-10 transition-all duration-300 ease-out flex flex-col hover:shadow-xl hover:-translate-y-0.5 hover:rotate-[0.05deg] cursor-pointer h-full bg-white border border-gray-200 shadow-sm">
        <CardHeader className="pb-3 flex-1">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-lg font-semibold line-clamp-2 flex-1">
                  <Link href={`/all?issueGroupId=${group.id}&status=open`} className="hover:underline">
                    {affectedUsers} {cleanTitle}
                  </Link>
                </CardTitle>
              </div>

              {group.description && (
                <CardDescription className="line-clamp-2 text-sm mb-2">{group.description}</CardDescription>
              )}
            </div>
            <div className="flex items-center">
              <PinButton isPinned={isPinned} onPin={() => onPin(group.id)} onUnpin={() => onUnpin(group.id)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <VolumeBadge todayCount={group.todayCount} weekCount={group.weekCount} monthCount={group.monthCount} />
              <VipBadge vipCount={group.vipCount} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Pin button component
function PinButton({ isPinned, onPin, onUnpin }: { isPinned: boolean; onPin: () => void; onUnpin: () => void }) {
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
