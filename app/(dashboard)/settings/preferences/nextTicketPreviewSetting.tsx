"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/trpc/react";

export const NextTicketPreviewSetting = () => {
  const { data: mailbox, isLoading } = api.mailbox.get.useQuery();
  const { mutate: update } = api.mailbox.update.useMutation();

  const [nextTicketPreviewEnabled, setNextTicketPreviewEnabled] = useState(
    mailbox?.preferences?.showNextTicketPreview ?? true,
  );

  const handleSwitchChange = (checked: boolean) => {
    setNextTicketPreviewEnabled(checked);
    update({
      preferences: {
        ...mailbox?.preferences,
        showNextTicketPreview: checked,
      },
    });
  };

  if (isLoading) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="next-ticket-preview">Show Next Ticket Preview</Label>
          <p className="text-sm text-muted-foreground">
            Display a preview of the next ticket while answering the current one. This helps agents prepare for the next
            conversation and work more efficiently.
          </p>
        </div>
        <Switch id="next-ticket-preview" checked={nextTicketPreviewEnabled} onCheckedChange={handleSwitchChange} />
      </div>
    </div>
  );
};
