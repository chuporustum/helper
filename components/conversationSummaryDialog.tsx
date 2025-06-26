import { AlertCircle, Clock, MessageCircle, User } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConversationSummary } from "@/types/summarization";

interface ConversationSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ConversationSummary | null;
  isLoading: boolean;
  error: string | null;
}

export function ConversationSummaryDialog({
  open,
  onOpenChange,
  summary,
  isLoading,
  error,
}: ConversationSummaryDialogProps) {
  const getSentimentEmoji = (sentiment: string) => {
    const lowerSentiment = sentiment.toLowerCase();
    if (lowerSentiment.includes("frustrated") || lowerSentiment.includes("angry") || lowerSentiment.includes("upset")) {
      return "😠";
    }
    if (
      lowerSentiment.includes("satisfied") ||
      lowerSentiment.includes("happy") ||
      lowerSentiment.includes("pleased")
    ) {
      return "😊";
    }
    if (lowerSentiment.includes("concerned") || lowerSentiment.includes("worried")) {
      return "😟";
    }
    if (lowerSentiment.includes("urgent") || lowerSentiment.includes("critical")) {
      return "🚨";
    }
    if (lowerSentiment.includes("polite") || lowerSentiment.includes("respectful")) {
      return "🙂";
    }
    if (lowerSentiment.includes("confused") || lowerSentiment.includes("unclear")) {
      return "😕";
    }
    return "😐";
  };

  const splitIntoBullets = (text: string): string[] => {
    if (!text || text.trim().length === 0) {
      return ["No information available"];
    }

    const cleanText = text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/_{2,}/g, "").replace(/`/g, "").trim();

    const dashSeparated = cleanText.split(/\s*-\s+/).filter((item) => item.trim().length > 0);

    if (dashSeparated.length > 1) {
      return dashSeparated.map((item) => {
        const cleaned = item.replace(/^[-•*]\s*/, "").trim();
        return cleaned.length > 0 ? (cleaned.endsWith(".") ? cleaned : `${cleaned}.`) : item.trim();
      });
    }

    const sentences = cleanText
      .split(/\.(?=\s+[A-Za-z0-9]|$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => {
        const cleaned = s.replace(/^[-•*]\s*/, "").trim();
        return cleaned.length > 0 ? (cleaned.endsWith(".") ? cleaned : `${cleaned}.`) : s.trim();
      });

    if (sentences.length > 1) {
      return sentences;
    }

    const parts = cleanText.split(/[,;](?=\s+[A-Za-z0-9])/);
    if (parts.length > 1) {
      return parts
        .map((p) => {
          return p.replace(/^[-•*]\s*/, "").trim();
        })
        .filter((p) => p.length > 0);
    }

    const fallback = cleanText.replace(/^[-•*]\s*/, "").trim();
    return [fallback.length > 0 ? fallback : cleanText];
  };

  const cleanDisplayText = (text: string): string => {
    return text.replace(/^[-•*]\s*/, "").trim();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            Conversation Summary
          </DialogTitle>
          <DialogDescription className="text-sm">
            Quick overview of key points for efficient context understanding.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Generating summary...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Failed to generate summary</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {summary && !isLoading && !error && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <h3 className="font-bold text-foreground">CORE ISSUE:</h3>
              </div>
              <ul className="space-y-2">
                {splitIntoBullets(summary.coreIssue).map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="mt-1 text-sm">•</span>
                    <span className="text-sm leading-relaxed break-words flex-1">{cleanDisplayText(point)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <h3 className="font-bold text-foreground">ACTIONS TAKEN:</h3>
              </div>
              <ul className="space-y-2">
                {splitIntoBullets(summary.actionsTaken).map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="mt-1 text-sm">•</span>
                    <span className="text-sm leading-relaxed break-words flex-1">{cleanDisplayText(point)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <h3 className="font-bold text-foreground">CUSTOMER SENTIMENT:</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getSentimentEmoji(summary.customerSentiment)}</span>
                <span className="text-sm leading-relaxed">
                  {cleanDisplayText(
                    splitIntoBullets(summary.customerSentiment)[0]?.replace(".", "") || summary.customerSentiment,
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <h3 className="font-bold text-foreground">STATUS & NEXT STEPS:</h3>
              </div>
              <ul className="space-y-2">
                {splitIntoBullets(summary.statusAndNextSteps).map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="mt-1 text-sm">•</span>
                    <span className="text-sm leading-relaxed break-words flex-1">{cleanDisplayText(point)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
