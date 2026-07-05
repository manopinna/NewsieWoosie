import { useState, useRef } from "react";
import { HeroSection } from "@/components/HeroSection";
import { FeatureCards } from "@/components/FeatureCards";
import { NewsSourceSelector } from "@/components/NewsSourceSelector";
import { SummaryGenerator } from "@/components/SummaryGenerator";
import { TranscriptDisplay } from "@/components/TranscriptDisplay";
import { useToast } from "@/hooks/use-toast";

interface CurrentSummary {
  title: string;
  content: string;
  duration: string;
}

interface NewsSource {
  id: string;
  url: string;
  name: string;
  type: 'website' | 'newsletter' | 'substack';
}

const popularSources = [
  { id: 'nyt', name: 'The New York Times', url: 'https://nytimes.com' },
  { id: 'foxsports', name: 'Fox Sports', url: 'https://www.foxsports.com' },
  { id: 'cricinfo', name: 'ESPNcricinfo', url: 'https://www.espncricinfo.com' },
  { id: 'ft', name: 'Financial Times', url: 'https://www.ft.com' },
];

const Index = () => {
  const { toast } = useToast();
  const [currentSummary, setCurrentSummary] = useState<CurrentSummary | null>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(['nyt']);
  const [customUrl, setCustomUrl] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptContent, setTranscriptContent] = useState<CurrentSummary | null>(null);
  const [selectedNewsletters, setSelectedNewsletters] = useState<string[]>([]);
  const [providerToken, setProviderToken] = useState<string | null>(null);
  
  const generateSummaryRef = useRef<(() => Promise<void>) | null>(null);
  const playAudioRef = useRef<(() => Promise<void>) | null>(null);
  const pauseAudioRef = useRef<(() => void) | null>(null);
  const sendEmailRef = useRef<((email: string, frequency: "once" | "daily") => Promise<void>) | null>(null);

  const scrollToSources = () => {
    const sourcesSection = document.getElementById('sources-section');
    if (sourcesSection) {
      sourcesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGenerateSummary = () => {
    if (generateSummaryRef.current) {
      generateSummaryRef.current();
    }
  };

  const handleAudioSummary = () => {
    if (playAudioRef.current) {
      playAudioRef.current();
    }
  };

  const handlePauseAudio = () => {
    if (pauseAudioRef.current) {
      pauseAudioRef.current();
    }
    // Also pause any browser speech as a safety net
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
  };

  const handleTextSummary = async () => {
    if (generateSummaryRef.current) {
      await generateSummaryRef.current();
    }
  };

  const handleSendEmail = async (email: string, frequency: "once" | "daily") => {
    if (sendEmailRef.current) {
      await sendEmailRef.current(email, frequency);
    }
  };

  // Update transcript content when summary changes and show it
  const handlePlaySummary = (summary: CurrentSummary) => {
    setCurrentSummary(summary);
    setTranscriptContent(summary);
    setShowTranscript(true);
  };

  const toggleSource = (id: string) => {
    setSelectedSourceIds(prev => 
      prev.includes(id) 
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const toggleNewsletter = (senderName: string) => {
    setSelectedNewsletters(prev =>
      prev.includes(senderName)
        ? prev.filter(s => s !== senderName)
        : [...prev, senderName]
    );
  };

  // Convert selected IDs to source objects for the SummaryGenerator
  const sources = selectedSourceIds.map(id => {
    const popular = popularSources.find(s => s.id === id);
    if (popular) {
      return {
        id: popular.id,
        url: popular.url,
        name: popular.name,
        type: 'website' as const,
      };
    }
    return null;
  }).filter(Boolean) as NewsSource[];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <HeroSection />
      
      {/* Feature Cards */}
      <FeatureCards />
      
      {/* Scroll Indicator */}
      <div className="flex flex-col items-center py-4 md:py-8">
        <p className="text-muted-foreground text-sm md:text-lg font-medium mb-1 md:mb-2">Get started below</p>
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center animate-bounce-slow">
          <svg 
            className="w-4 h-4 md:w-5 md:h-5 text-primary" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
      
      {/* News Source Selector */}
      <div id="sources-section">
        <NewsSourceSelector
          popularSources={popularSources}
          selectedSourceIds={selectedSourceIds}
          onToggleSource={toggleSource}
          customUrl={customUrl}
          onCustomUrlChange={setCustomUrl}
          onGenerateSummaries={handleGenerateSummary}
          onAudioSummary={handleAudioSummary}
          onPauseAudio={handlePauseAudio}
          onTextSummary={handleTextSummary}
          onSendEmail={handleSendEmail}
          selectedNewsletters={selectedNewsletters}
          onToggleNewsletter={toggleNewsletter}
          onProviderTokenChange={setProviderToken}
        />
      </div>

      {/* Transcript Display */}
      {showTranscript && transcriptContent && (
        <TranscriptDisplay
          title={transcriptContent.title}
          content={transcriptContent.content}
          onClose={() => setShowTranscript(false)}
        />
      )}
      
      {/* Summary Generator */}
      <div className="px-3 pb-6 md:px-6 md:pb-12">
        <div className="max-w-4xl mx-auto">
          <SummaryGenerator 
            onPlaySummary={handlePlaySummary} 
            sources={sources} 
            onGenerateRef={(generateFn) => { generateSummaryRef.current = generateFn; }}
            onPlayAudioRef={(playFn) => { playAudioRef.current = playFn; }}
            onPauseAudioRef={(pauseFn) => { pauseAudioRef.current = pauseFn; }}
            onSendEmailRef={(sendFn) => { sendEmailRef.current = sendFn; }}
            showGenerateCard={false}
            selectedNewsletters={selectedNewsletters}
            providerToken={providerToken}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;