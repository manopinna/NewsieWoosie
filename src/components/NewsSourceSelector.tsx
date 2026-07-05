import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Volume2, FileText, ExternalLink, Pause, Mail, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PopularSource {
  id: string;
  name: string;
  url: string;
}

interface Newsletter {
  id: string;
  subject: string;
  from: string;
  fromFull: string;
  date: string;
  snippet: string;
}

interface NewsSourceSelectorProps {
  popularSources: PopularSource[];
  selectedSourceIds: string[];
  onToggleSource: (id: string) => void;
  customUrl: string;
  onCustomUrlChange: (url: string) => void;
  onGenerateSummaries: () => void;
  onAudioSummary: () => void;
  onPauseAudio: () => void;
  onTextSummary: () => void;
  onSendEmail: (email: string, frequency: "once" | "daily") => void;
  selectedNewsletters: string[];
  onToggleNewsletter: (senderName: string) => void;
  onProviderTokenChange: (token: string | null) => void;
}

type SectionKey = "current-events" | "economy" | "tech" | "india" | "fintech" | "sports";

interface SectionDef {
  key: SectionKey;
  title: string;
  // Match popular sources by id
  popularIds?: string[];
  // Match newsletters by sender name (case-insensitive substring, any match)
  newsletterMatchers?: string[];
}

const SECTIONS: SectionDef[] = [
  { key: "current-events", title: "Current Events", popularIds: ["nyt"], newsletterMatchers: ["npr", "morning brew"] },
  { key: "economy", title: "Economy", popularIds: ["ft"], newsletterMatchers: ["wsj", "what's news", "whats news", "wall street journal", "brew markets"] },
  { key: "tech", title: "Tech", newsletterMatchers: ["tldr", "ben's bites", "bens bites"] },
  { key: "india", title: "India", newsletterMatchers: ["bloomberg india", "india edition"] },
  { key: "fintech", title: "Fintech", newsletterMatchers: ["tldr fintech", "fintech"] },
  { key: "sports", title: "Sports", popularIds: ["foxsports", "cricinfo"], newsletterMatchers: [] },
];

const matchesNewsletter = (sender: string, section: SectionDef) => {
  const matchers = section.newsletterMatchers || [];
  if (!matchers.length) return false;
  const s = sender.toLowerCase();
  // Tech section: exclude fintech variants so TLDR Fintech stays out
  if (section.key === "tech" && s.includes("fintech")) return false;
  return matchers.some((m) => s.includes(m.toLowerCase()));
};

export const NewsSourceSelector = ({
  popularSources,
  selectedSourceIds,
  onToggleSource,
  onAudioSummary,
  onPauseAudio,
  onTextSummary,
  onSendEmail,
  selectedNewsletters,
  onToggleNewsletter,
}: NewsSourceSelectorProps) => {
  const { toast } = useToast();
  const [emailInput, setEmailInput] = useState("manopinna12@gmail.com");
  const [emailFrequency, setEmailFrequency] = useState<"once" | "daily">("once");
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [isLoadingNewsletters, setIsLoadingNewsletters] = useState(false);

  const fetchNewsletters = async () => {
    setIsLoadingNewsletters(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-gmail-newsletters", { body: {} });
      if (error) {
        console.error("Newsletter fetch error:", error);
        toast({ title: "Error", description: "Failed to fetch newsletters from Gmail.", variant: "destructive" });
        return;
      }
      setNewsletters(data?.newsletters || []);
    } catch (e) {
      console.error("Newsletter fetch exception:", e);
    } finally {
      setIsLoadingNewsletters(false);
    }
  };

  useEffect(() => {
    fetchNewsletters();
  }, []);

  const handleSendEmailClick = () => {
    const email = emailInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    onSendEmail(email, emailFrequency);
  };

  // Deduplicate newsletters by sender name (from)
  const uniqueNewsletters = Array.from(
    new Map(newsletters.map((n) => [n.from, n])).values()
  );

  // Compute section contents
  const sectionContents = SECTIONS.map((section) => {
    const popular = popularSources.filter((p) => section.popularIds?.includes(p.id));
    const matchedNl = uniqueNewsletters.filter((n) => matchesNewsletter(n.from, section));
    return { section, popular, newsletters: matchedNl };
  });

  const matchedNewsletterIds = new Set(
    sectionContents.flatMap((s) => s.newsletters.map((n) => n.from))
  );
  const unmatchedNewsletters = uniqueNewsletters.filter((n) => !matchedNewsletterIds.has(n.from));

  return (
    <section className="px-3 py-6 md:px-6 md:py-12">
      <Card className="max-w-4xl mx-auto p-4 md:p-8 bg-background/80 backdrop-blur-sm border-border shadow-card">
        <div className="text-center mb-4 md:mb-8">
          <h2 className="text-lg md:text-2xl font-bold mb-1 md:mb-2">Select Your News Sources</h2>
          <p className="text-muted-foreground text-xs md:text-base">
            Organized by category — choose what you want to hear about
          </p>
        </div>

        <div className="flex items-center justify-end mb-3">
          <Button variant="ghost" size="sm" onClick={fetchNewsletters} disabled={isLoadingNewsletters} className="gap-1 text-xs">
            <RefreshCw className={`w-3 h-3 ${isLoadingNewsletters ? "animate-spin" : ""}`} />
            Refresh newsletters
          </Button>
        </div>

        {isLoadingNewsletters && newsletters.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Scanning Gmail for newsletters...
          </div>
        )}

        {/* Sections */}
        <div className="space-y-5 mb-6">
          {sectionContents.map(({ section, popular, newsletters: nls }) => {
            const isEmpty = popular.length === 0 && nls.length === 0;
            return (
              <div key={section.key}>
                <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-3">{section.title}</h3>
                {isEmpty ? (
                  <p className="text-xs md:text-sm text-muted-foreground italic">No sources available yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {popular.map((source) => {
                      const isSelected = selectedSourceIds.includes(source.id);
                      return (
                        <div key={source.id} className="flex items-center gap-1">
                          <button
                            onClick={() => onToggleSource(source.id)}
                            className={`news-source-chip flex items-center gap-2 ${isSelected ? "selected" : ""}`}
                          >
                            {isSelected && <Check className="w-4 h-4" />}
                            {source.name}
                          </button>
                          <button
                            onClick={() => {
                              if (!isSelected) onToggleSource(source.id);
                              window.open(source.url, "_blank");
                            }}
                            className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title={`Visit ${source.name}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                    {nls.map((nl) => {
                      const isSelected = selectedNewsletters.includes(nl.from);
                      return (
                        <button
                          key={nl.id}
                          onClick={() => onToggleNewsletter(nl.from)}
                          className={`news-source-chip flex items-center gap-2 ${isSelected ? "selected" : ""}`}
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
                )}
              </div>
            );
          })}

          {unmatchedNewsletters.length > 0 && (
            <div>
              <h3 className="text-sm md:text-lg font-semibold mb-2 md:mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Other Newsletters
              </h3>
              <div className="flex flex-wrap gap-2 md:gap-3">
                {unmatchedNewsletters.map((nl) => {
                  const isSelected = selectedNewsletters.includes(nl.from);
                  return (
                    <button
                      key={nl.id}
                      onClick={() => onToggleNewsletter(nl.from)}
                      className={`news-source-chip flex items-center gap-2 ${isSelected ? "selected" : ""}`}
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
            </div>
          )}
        </div>

        {/* Generate Buttons */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={onAudioSummary}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-4 md:py-6 text-sm md:text-lg gap-2"
              disabled={selectedSourceIds.length === 0 && selectedNewsletters.length === 0}
            >
              <Volume2 className="w-5 h-5" />
              Play Podcast
            </Button>
            <Button
              onClick={onPauseAudio}
              className="w-full bg-muted hover:bg-muted/80 text-muted-foreground font-semibold py-4 md:py-6 text-sm md:text-lg gap-2"
            >
              <Pause className="w-5 h-5" />
              Pause Podcast
            </Button>
          </div>
          <Button
            onClick={onTextSummary}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-4 md:py-6 text-sm md:text-lg gap-2"
            disabled={selectedSourceIds.length === 0 && selectedNewsletters.length === 0}
          >
            <FileText className="w-5 h-5" />
            Quick Read
          </Button>
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="Enter email address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                maxLength={255}
                className="flex-1 py-4 md:py-6 text-sm md:text-base"
              />
              <Button
                onClick={handleSendEmailClick}
                className="w-full sm:w-auto bg-fuchsia-400 hover:bg-fuchsia-500 text-white font-semibold py-4 md:py-6 text-sm md:text-lg gap-2"
                disabled={selectedSourceIds.length === 0 && selectedNewsletters.length === 0}
              >
                <Mail className="w-5 h-5" />
                {emailFrequency === "daily" ? "Subscribe to Daily Email" : "Send Email Summary"}
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="email-frequency"
                  value="once"
                  checked={emailFrequency === "once"}
                  onChange={() => setEmailFrequency("once")}
                  className="accent-primary"
                />
                <span>Send once now</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="email-frequency"
                  value="daily"
                  checked={emailFrequency === "daily"}
                  onChange={() => setEmailFrequency("daily")}
                  className="accent-primary"
                />
                <span>Daily at 8 AM ET</span>
              </label>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
};
