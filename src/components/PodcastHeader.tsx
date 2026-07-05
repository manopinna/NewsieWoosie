import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Plus, Mic, Rss } from "lucide-react";
import heroImage from "@/assets/podcast-hero.jpg";

interface PodcastHeaderProps {
  onAddSourcesClick?: () => void;
  onGenerateSummaryClick?: () => void;
}

export const PodcastHeader = ({ onAddSourcesClick, onGenerateSummaryClick }: PodcastHeaderProps) => {
  return (
    <div className="relative overflow-hidden">
      {/* Hero Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-primary opacity-80" />
      
      {/* Content */}
      <div className="relative z-10 px-6 py-16 text-center">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-background-secondary/50 p-4 shadow-glow">
              <Mic className="h-12 w-12 text-primary" />
            </div>
          </div>
          
          <h1 className="mb-4 text-5xl font-bold tracking-tight">
            AI News <span className="text-primary-glow">Podcast</span>
          </h1>
          
          <p className="mb-8 text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your daily news into personalized audio summaries from your favorite sources
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg" 
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              onClick={onAddSourcesClick}
            >
              <Plus className="mr-2 h-5 w-5" />
              Add News Sources
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="border-primary/30 hover:bg-primary/10"
              onClick={onGenerateSummaryClick}
            >
              <Rss className="mr-2 h-5 w-5" />
              Generate Today's Summary
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};