import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Clock } from "lucide-react";

interface NewsArticle {
  title: string;
  description: string;
  source: string;
  publishedAt: string;
  url: string;
}

interface ArticlesBySourceProps {
  articlesBySource: { [sourceName: string]: NewsArticle[] };
}

export const ArticlesBySource = ({ articlesBySource }: ArticlesBySourceProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const openArticle = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (Object.keys(articlesBySource).length === 0) {
    return (
      <Card className="p-6 bg-background-secondary border-border">
        <p className="text-muted-foreground text-center">
          No articles available from your selected sources.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(articlesBySource).map(([sourceName, articles]) => (
        <Card key={sourceName} className="p-6 bg-background-secondary border-border shadow-card">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-foreground">{sourceName}</h3>
              <Badge variant="secondary" className="text-sm">
                {articles.length} article{articles.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
          
          <div className="space-y-4">
            {articles.map((article, index) => (
              <div key={index} className="border-l-2 border-primary/20 pl-4 py-2 hover:border-primary/40 transition-colors">
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground leading-tight">
                    {article.title}
                  </h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {article.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(article.publishedAt)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => openArticle(article.url)}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Read
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
};