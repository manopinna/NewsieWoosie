import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Mail, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Newsletter {
  id: string;
  subject: string;
  from: string;
  fromFull: string;
  date: string;
  snippet: string;
}

interface GmailNewsletterSelectorProps {
  selectedNewsletters: string[];
  onToggleNewsletter: (senderName: string) => void;
  onProviderTokenChange?: (token: string | null) => void;
}

export const GmailNewsletterSelector = ({
  selectedNewsletters,
  onToggleNewsletter,
}: GmailNewsletterSelectorProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);

  const fetchNewsletters = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-gmail-newsletters', {
        body: {},
      });

      if (error) {
        console.error("Newsletter fetch error:", error);
        toast({
          title: "Error",
          description: "Failed to fetch newsletters from Gmail.",
          variant: "destructive",
        });
        return;
      }

      setNewsletters(data?.newsletters || []);
      if ((data?.newsletters || []).length === 0) {
        toast({
          title: "No Newsletters Found",
          description: "No newsletter emails found in the last 7 days.",
        });
      }
    } catch (e) {
      console.error("Newsletter fetch exception:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNewsletters();
  }, []);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Gmail Newsletters
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchNewsletters}
          disabled={isLoading}
          className="gap-1 text-xs"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading && newsletters.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Scanning for newsletters...
        </div>
      ) : newsletters.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {newsletters.map((nl) => {
            const isSelected = selectedNewsletters.includes(nl.from);
            return (
              <button
                key={nl.id}
                onClick={() => onToggleNewsletter(nl.from)}
                className={`news-source-chip flex items-center gap-2 ${isSelected ? 'selected' : ''}`}
              >
                {isSelected && <Check className="w-4 h-4" />}
                <span>{nl.from}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  newsletter
                </Badge>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No newsletters found in the last 7 days.
        </p>
      )}
    </div>
  );
};
