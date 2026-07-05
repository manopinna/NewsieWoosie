import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { X, ExternalLink, Globe } from "lucide-react";

interface NewsSource {
  id: string;
  url: string;
  name: string;
  type: 'website' | 'newsletter' | 'substack';
}

interface NewsSourceManagerProps {
  sources: NewsSource[];
  setSources: (sources: NewsSource[]) => void;
}

export const NewsSourceManager = ({ sources, setSources }: NewsSourceManagerProps) => {
  const { toast } = useToast();

  const removeSource = (id: string) => {
    setSources(sources.filter(s => s.id !== id));
    toast({
      title: "Source Removed",
      description: "News source has been removed.",
    });
  };

  const getTypeColor = (type: NewsSource['type']) => {
    switch (type) {
      case 'substack': return 'bg-primary/20 text-primary';
      case 'newsletter': return 'bg-success/20 text-success';
      default: return 'bg-accent/20 text-accent';
    }
  };

  return (
    <Card className="p-6 bg-background-secondary border-border shadow-card">
      <div className="flex items-center gap-3 mb-6">
        <Globe className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-semibold">News Sources</h2>
      </div>

      {/* Sources List */}
      <div className="space-y-3">
        {sources.map((source) => (
          <div
            key={source.id}
            className="flex items-center justify-between p-4 rounded-lg bg-background-tertiary border border-border hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{source.name}</span>
                  <Badge className={getTypeColor(source.type)}>
                    {source.type}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Top 5 stories
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{source.url}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(source.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSource(source.id)}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {sources.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No news sources added yet.</p>
        </div>
      )}
    </Card>
  );
};
