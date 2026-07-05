import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, FileText, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface TranscriptDisplayProps {
  title: string;
  content: string;
  onClose: () => void;
}

export const TranscriptDisplay = ({ title, content, onClose }: TranscriptDisplayProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Transcript copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="px-3 py-4 md:px-6 md:py-8">
      <Card className="max-w-4xl mx-auto p-4 md:p-8 bg-background/80 backdrop-blur-sm border-border shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-6">
          {(() => {
            const lines = content.split('\n').filter(l => l.trim());
            const sections: { header: string; articles: { headline: string; url: string; context: string; takeaway: string }[] }[] = [];
            let currentSection: { header: string; articles: { headline: string; url: string; context: string; takeaway: string }[] } | null = null;
            let currentArticle: { headline: string; url: string; context: string; takeaway: string } | null = null;

            for (const line of lines) {
              const trimmed = line.trim();
              
              // Detect source headers: starts with 📰 or looks like a source header (e.g. **WSJ** or ## Source)
              if (trimmed.startsWith('📰') || /^#{1,3}\s/.test(trimmed) || /^\*\*[^*]+\*\*$/.test(trimmed)) {
                if (currentArticle && currentSection) currentSection.articles.push(currentArticle);
                currentArticle = null;
                const headerText = trimmed.replace(/^#{1,3}\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
                currentSection = { header: headerText.startsWith('📰') ? headerText : `📰 ${headerText}`, articles: [] };
                sections.push(currentSection);
                continue;
              }

              // Detect headline: starts with • or - or numbered
              if (/^[•\-\*]\s/.test(trimmed) || /^\d+[\.\)]\s/.test(trimmed)) {
                if (currentArticle && currentSection) currentSection.articles.push(currentArticle);
                const headline = trimmed.replace(/^[•\-\*]\s*/, '').replace(/^\d+[\.\)]\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
                currentArticle = { headline, url: '', context: '', takeaway: '' };
                if (!currentSection) {
                  currentSection = { header: '📰 News', articles: [] };
                  sections.push(currentSection);
                }
                continue;
              }

              // Detect URL line
              if (/^url:/i.test(trimmed) && currentArticle) {
                currentArticle.url = trimmed.replace(/^url:\s*/i, '').trim();
                continue;
              }
              // Detect context/takeaway lines
              if (/^context:/i.test(trimmed) && currentArticle) {
                currentArticle.context = trimmed.replace(/^context:\s*/i, '').trim();
                continue;
              }
              if (/^takeaway:/i.test(trimmed) && currentArticle) {
                currentArticle.takeaway = trimmed.replace(/^takeaway:\s*/i, '').trim();
                continue;
              }

              // Append to current article context if we have one and line looks like continuation
              if (currentArticle && !currentArticle.takeaway) {
                currentArticle.context += (currentArticle.context ? ' ' : '') + trimmed;
              }
            }
            if (currentArticle && currentSection) currentSection.articles.push(currentArticle);

            // If no structured sections found, fall back to paragraph display
            if (sections.length === 0) {
              return content.split('\n\n').filter(s => s.trim()).map((para, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed">{para}</p>
              ));
            }

            return sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="bg-muted/50 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-primary mb-4">{section.header}</h3>
                <div className="space-y-5">
                  {section.articles.map((article, articleIndex) => (
                    <div key={articleIndex} className="space-y-1">
                      {article.url ? (
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground font-bold hover:text-primary hover:underline transition-colors block"
                        >
                          {article.headline}
                        </a>
                      ) : (
                        <p className="text-foreground font-bold">{article.headline}</p>
                      )}
                      {article.context && (
                        <p className="text-muted-foreground text-sm leading-relaxed">{article.context}</p>
                      )}
                      {article.takeaway && (
                        <p className="text-primary/80 text-sm italic">Takeaway: {article.takeaway}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      </Card>
    </section>
  );
};