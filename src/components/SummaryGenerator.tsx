import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Download, Play, Pause, Volume2, FileText } from "lucide-react";
import { fetchNews, fetchNewsBySource, generateSummary, estimateDuration } from "@/lib/newsService";
import { supabase } from "@/integrations/supabase/client";
import { ArticlesBySource } from "./ArticlesBySource";

interface Summary {
  id: string;
  title: string;
  content: string;
  textContent: string;
  audioUrl?: string;
  createdAt: Date;
  duration: string;
  sources: string[];
}

interface NewsSource {
  id: string;
  url: string;
  name: string;
  type: 'website' | 'newsletter' | 'substack';
}

interface SummaryGeneratorProps {
  onPlaySummary: (summary: { title: string; content: string; duration: string }) => void;
  sources: NewsSource[];
  onGenerateRef?: (generateFn: () => Promise<void>) => void;
  onPlayAudioRef?: (playFn: () => Promise<void>) => void;
  onPauseAudioRef?: (pauseFn: () => void) => void;
  onSendEmailRef?: (sendFn: (email: string, frequency: "once" | "daily") => Promise<void>) => void;
  onSummaryGenerated?: (summary: { title: string; audioContent: string; textContent: string; duration: string }) => void;
  showGenerateCard?: boolean;
  selectedNewsletters?: string[];
  providerToken?: string | null;
}


export const SummaryGenerator = ({ onPlaySummary, sources, onGenerateRef, onPlayAudioRef, onPauseAudioRef, onSendEmailRef, onSummaryGenerated, showGenerateCard = true, selectedNewsletters = [], providerToken }: SummaryGeneratorProps) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [articlesBySource, setArticlesBySource] = useState<{ [sourceName: string]: any[] }>({});
  const [showArticles, setShowArticles] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const latestSummaryRef = useRef<Summary | null>(null);
  const latestAudioBlobRef = useRef<Blob | null>(null);

  const generateAudioFromText = async (text: string): Promise<string | null> => {
    try {
      setIsLoadingAudio(true);

      // Server (elevenlabs-tts) chunks long scripts into multiple TTS calls
      // and concatenates the MP3s, so we send the full text as-is.
      const truncatedText = text;

      // Fetch raw MP3 bytes directly. The functions client tries to parse
      // responses for us, which can corrupt binary audio payloads.
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text: truncatedText }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('TTS request failed:', response.status, errorText);
        return null;
      }

      const audioBlob = await response.blob();
      if (!audioBlob.size) {
        console.error('TTS request returned an empty audio file');
        return null;
      }

      const ttsChars = parseInt(response.headers.get('X-TTS-Chars') || '0', 10);
      if (ttsChars) (audioBlob as any).__ttsChars = ttsChars;
      latestAudioBlobRef.current = audioBlob;
      const audioUrl = URL.createObjectURL(audioBlob);
      return audioUrl;
    } catch (error) {
      console.error('Error generating audio:', error);
      return null;
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const playAudio = async (summary: Summary) => {
    // If we already have audio loaded for this summary and it's paused, just resume
    if (
      audioRef.current &&
      audioRef.current.paused &&
      audioRef.current.dataset.summaryId === summary.id
    ) {
      try {
        await audioRef.current.play();
        setIsPlayingAudio(true);
        toast({ title: "Resumed", description: "Audio playback resumed." });
        return;
      } catch (e) {
        console.warn('Resume failed, regenerating', e);
      }
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      toast({
        title: "Generating Audio",
        description: "Creating high-quality voice narration...",
      });

      const audioUrl = await generateAudioFromText(summary.content);

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.dataset.summaryId = summary.id;
        audioRef.current = audio;

        audio.onended = () => setIsPlayingAudio(false);
        audio.onpause = () => setIsPlayingAudio(false);
        audio.onplay = () => setIsPlayingAudio(true);

        audio.onerror = () => {
          setIsPlayingAudio(false);
          toast({
            title: "Audio Error",
            description: "Failed to play audio. Using browser speech instead.",
            variant: "destructive",
          });
          const utterance = new SpeechSynthesisUtterance(summary.content);
          window.speechSynthesis.speak(utterance);
        };

        await audio.play();
        setIsPlayingAudio(true);

        toast({
          title: "Now Playing",
          description: summary.title,
        });
      } else {
        toast({
          title: "Using Browser Voice",
          description: "ElevenLabs unavailable, using browser speech.",
        });
        const utterance = new SpeechSynthesisUtterance(summary.content);
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      const utterance = new SpeechSynthesisUtterance(summary.content);
      window.speechSynthesis.speak(utterance);
    }
  };

  const pauseAudio = () => {
    let didPause = false;
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      didPause = true;
    }
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      didPause = true;
    }
    if (didPause) {
      setIsPlayingAudio(false);
      toast({ title: "Paused", description: "Audio summary paused." });
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsPlayingAudio(false);
  };

  const fetchNewsletterArticles = async (): Promise<any[]> => {
    console.log('[SummaryGenerator] fetchNewsletterArticles called', { selectedNewsletters });
    
    if (selectedNewsletters.length === 0) {
      console.log('[SummaryGenerator] Skipping newsletters - no selections');
      return [];
    }

    const results = await Promise.all(
      selectedNewsletters.map(async (senderName) => {
        try {
          console.log(`[SummaryGenerator] Fetching newsletter from: ${senderName}`);
          const { data, error } = await supabase.functions.invoke('fetch-newsletter-content', {
            body: { sender_name: senderName },
          });
          console.log(`[SummaryGenerator] Newsletter result for ${senderName}:`, { 
            hasData: !!data, 
            articleCount: data?.articles?.length, 
            error 
          });
          if (error || !data?.articles) return [];
          return data.articles;
        } catch (e) {
          console.warn(`Failed to fetch newsletter from ${senderName}:`, e);
          return [];
        }
      })
    );
    return results.flat();
  };

  const generateNewSummary = async () => {
    setIsGenerating(true);
    setProgress(0);
    latestAudioBlobRef.current = null;

    try {
      // Step 1: Fetching news sources + newsletters
      setProgress(20);
      toast({
        title: "Generating Summary",
        description: "Fetching top stories and newsletters...",
        duration: 2000,
      });

      const sourceNames = sources.map(source => source.name);
      
      // Fetch news articles and newsletter content in parallel
      const hasNewsSources = sourceNames.length > 0;
      const hasNewsletters = selectedNewsletters.length > 0;

      console.log('[SummaryGenerator] Generate summary state:', {
        sourceNames,
        selectedNewsletters,
        hasNewsSources,
        hasNewsletters,
      });

      const [newsArticles, newsletterArticles] = await Promise.all([
        hasNewsSources ? fetchNews(sourceNames).then(r => r.articles).catch(() => []) : Promise.resolve([]),
        hasNewsletters ? fetchNewsletterArticles() : Promise.resolve([]),
      ]);

      console.log('[SummaryGenerator] Fetched results:', {
        newsCount: newsArticles.length,
        newsletterCount: newsletterArticles.length,
      });

      // Cap to max 3 articles per source for the summary
      const perSourceCounts: { [key: string]: number } = {};
      const cappedNewsArticles = newsArticles.filter((a: any) => {
        const src = a.source || 'Unknown';
        perSourceCounts[src] = (perSourceCounts[src] || 0) + 1;
        return perSourceCounts[src] <= 3;
      });
      const allArticles = [...cappedNewsArticles, ...newsletterArticles];

      if (allArticles.length === 0) {
        throw new Error('No articles returned from any source. Please check your sources and try again.');
      }

      // Step 2: Analyzing content
      setProgress(40);
      toast({
        title: "Generating Summary",
        description: `Analyzing ${allArticles.length} articles...`,
        duration: 1000,
      });
      await new Promise(resolve => setTimeout(resolve, 800));

      // Step 3: Generating summary
      setProgress(60);
      toast({
        title: "Generating Summary",
        description: "Creating your personalized summary...",
        duration: 1000,
      });
      
      // Generate both audio and text summaries in parallel
      const [audioContent, textContent] = await Promise.all([
        generateSummary(allArticles, 'audio'),
        generateSummary(allArticles, 'text'),
      ]);
      const duration = estimateDuration(audioContent);

      // Step 4: Finalizing
      setProgress(80);
      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(100);

      const allSourceNames = [...sourceNames, ...selectedNewsletters];

      const newSummary: Summary = {
        id: Date.now().toString(),
        title: `Quick Read - ${new Date().toLocaleDateString()}`,
        content: audioContent,
        textContent: textContent,
        createdAt: new Date(),
        duration: duration,
        sources: allSourceNames,
      };

      setSummaries([newSummary, ...summaries]);
      latestSummaryRef.current = newSummary;

      const generatedSummary = {
        title: newSummary.title,
        content: newSummary.textContent,
        duration: newSummary.duration
      };

      onPlaySummary(generatedSummary);
      onSummaryGenerated?.({
        title: newSummary.title,
        audioContent: newSummary.content,
        textContent: newSummary.textContent,
        duration: newSummary.duration,
      });

      // Group articles by source for display
      const articlesBySourceMap: { [key: string]: any[] } = {};
      allArticles.forEach((article: any) => {
        const src = article.source || 'Unknown';
        if (!articlesBySourceMap[src]) articlesBySourceMap[src] = [];
        if (articlesBySourceMap[src].length < 3) articlesBySourceMap[src].push(article);
      });
      setArticlesBySource(articlesBySourceMap);
      setShowArticles(true);

      toast({
        title: "Summary Generated!",
        description: "Your summary is ready. Click Play for audio or view the text below.",
        duration: 3000,
      });

    } catch (error) {
      console.error('Error generating summary:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Error",
        description: errorMessage.includes('Failed to send') 
          ? "Could not reach the news service. Please wait a minute and try again."
          : `Failed to generate summary: ${errorMessage}`,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  // Use a ref to always have the latest generate function
  const generateRef = useRef(generateNewSummary);
  generateRef.current = generateNewSummary;

  // Triggered by external "Play Podcast" button
  const playLatestOrGenerate = async () => {
    // If audio is already loaded and paused, resume it
    if (audioRef.current && audioRef.current.paused) {
      try {
        await audioRef.current.play();
        setIsPlayingAudio(true);
        toast({ title: "Resumed", description: "Audio summary resumed." });
        return;
      } catch (e) {
        console.warn('Resume failed', e);
      }
    }
    // If audio is currently playing, do nothing
    if (audioRef.current && !audioRef.current.paused) return;

    // If we already have a summary, play it
    if (latestSummaryRef.current) {
      await playAudio(latestSummaryRef.current);
      return;
    }

    // Otherwise generate then play
    await generateRef.current();
    if (latestSummaryRef.current) {
      await playAudio(latestSummaryRef.current);
    }
  };

  const playLatestRef = useRef(playLatestOrGenerate);
  playLatestRef.current = playLatestOrGenerate;

  const pauseAudioRef = useRef(pauseAudio);
  pauseAudioRef.current = pauseAudio;

  const sendEmailWithSummary = async (recipientEmail: string, frequency: "once" | "daily" = "once") => {
    const recipient = (recipientEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }

    // Daily subscription: register/refresh the email and preferences, then stop
    // (the daily cron will send the actual email each morning at 8 AM ET).
    if (frequency === 'daily') {
      try {
        const sourceIds = sources.map((s) => s.id);
        const newsletterSenders = selectedNewsletters;
        const { error } = await supabase.functions.invoke('daily-summary-email', {
          body: {
            action: 'subscribe',
            email: recipient,
            sourceIds,
            newsletterSenders,
          },
        });
        if (error) {
          console.error('subscribe error', error);
          toast({ title: 'Subscription Failed', description: 'Could not subscribe to daily email.', variant: 'destructive' });
          return;
        }
        toast({
          title: 'Preferences Saved 📬',
          description: `${recipient} will receive one daily summary at 8 AM ET with your latest selections.`,
        });
      } catch (e) {
        console.error('subscribe exception', e);
        toast({ title: 'Error', description: 'Failed to subscribe.', variant: 'destructive' });
      }
      return;
    }


    try {
      // Always generate a fresh summary based on current source selections
      // so the email reflects what the user has selected right now.
      toast({ title: 'Generating Summary', description: 'Building summary before sending email...' });
      latestSummaryRef.current = null;
      latestAudioBlobRef.current = null;
      await generateRef.current();

      const summary = latestSummaryRef.current;
      if (!summary) {
        toast({ title: 'Error', description: 'No summary available to send.', variant: 'destructive' });
        return;
      }

      toast({ title: 'Preparing Email', description: 'Generating audio and uploading...' });

      // Ensure we have an MP3 blob (generate if not cached)
      if (!latestAudioBlobRef.current) {
        await generateAudioFromText(summary.content);
      }
      const audioBlob = latestAudioBlobRef.current;

      let audioUrl: string | null = null;
      if (audioBlob) {
        const fileName = `${crypto.randomUUID()}.mp3`;
        const { error: uploadError } = await supabase.storage
          .from('podcast-audio')
          .upload(fileName, audioBlob, { contentType: 'audio/mpeg', upsert: false });
        if (uploadError) {
          console.error('Audio upload failed:', uploadError);
        } else {
          const { data: pub } = supabase.storage.from('podcast-audio').getPublicUrl(fileName);
          audioUrl = pub.publicUrl;
        }
      }

      // Persist summary
      const summaryId = crypto.randomUUID();
      const ttsChars = audioBlob ? ((audioBlob as any).__ttsChars as number | undefined) : undefined;
      const { error: insertError } = await supabase.from('podcast_summaries').insert({
        id: summaryId,
        title: summary.title,
        text_content: summary.textContent,
        audio_url: audioUrl,
        duration: summary.duration,
        sources: summary.sources,
        script_chars: summary.textContent?.length ?? null,
        tts_chars: ttsChars ?? null,
      });
      if (insertError) {
        console.error('Failed to save summary:', insertError);
        toast({ title: 'Error', description: 'Could not save the summary.', variant: 'destructive' });
        return;
      }

      const listenUrl = `${window.location.origin}/listen/${summaryId}`;

      // Send the email
      const { data, error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'podcast-summary',
          recipientEmail: recipient,
          idempotencyKey: `podcast-summary-${summaryId}`,
          templateData: {
            title: summary.title,
            textContent: summary.textContent,
            listenUrl,
            duration: summary.duration,
          },
        },
      });

      if (error) {
        console.error('send-transactional-email error:', error);
        toast({
          title: 'Email Failed',
          description: 'Could not send the email. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Email Sent! 📧',
        description: `Summary sent to ${recipient}`,
      });
    } catch (e) {
      console.error('sendEmailWithSummary error:', e);
      toast({ title: 'Error', description: 'Failed to send email.', variant: 'destructive' });
    }
  };

  const sendEmailRef = useRef(sendEmailWithSummary);
  sendEmailRef.current = sendEmailWithSummary;

  // Expose functions to parent via stable wrappers
  useEffect(() => {
    if (onGenerateRef) {
      onGenerateRef(() => generateRef.current());
    }
  }, [onGenerateRef]);

  useEffect(() => {
    if (onPlayAudioRef) {
      onPlayAudioRef(() => playLatestRef.current());
    }
  }, [onPlayAudioRef]);

  useEffect(() => {
    if (onPauseAudioRef) {
      onPauseAudioRef(() => pauseAudioRef.current());
    }
  }, [onPauseAudioRef]);

  useEffect(() => {
    if (onSendEmailRef) {
      onSendEmailRef((email: string, frequency: "once" | "daily") => sendEmailRef.current(email, frequency));
    }
  }, [onSendEmailRef]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  // Invalidate cached summary/audio whenever the user changes their source
  // or newsletter selections, so the next Play Podcast / Quick Read always
  // regenerates against the current selections (not the previously cached one).
  const selectionKey = [...sources.map(s => s.id), ...selectedNewsletters].sort().join('|');
  useEffect(() => {
    latestSummaryRef.current = null;
    latestAudioBlobRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingAudio(false);
  }, [selectionKey]);

  const loadArticlesBySource = async () => {
    if (sources.length === 0) {
      toast({
        title: "No Sources Selected",
        description: "Please add news sources first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const sourceNames = sources.map(source => source.name);
      const groupedNews = await fetchNewsBySource(sourceNames);
      setArticlesBySource(groupedNews.articlesBySource);
      setShowArticles(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load articles. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {showGenerateCard && (
        <Card className="p-6 bg-background-secondary border-border shadow-card">
          <div className="text-center space-y-4">
            <Sparkles className="h-12 w-12 text-primary mx-auto animate-pulse" />
            <h2 className="text-2xl font-semibold">Generate Daily Summary</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Get the top 5 stories from each selected source with AI-powered audio narration
              {sources.length > 0 && (
                <span className="block text-sm text-primary mt-1">
                  Using {sources.length} source{sources.length !== 1 ? 's' : ''}: {sources.map(s => s.name).join(', ')}
                </span>
              )}
            </p>
            
            {sources.length === 0 && selectedNewsletters.length === 0 && (
              <p className="text-sm text-destructive">
                Please add news sources first to generate summaries
              </p>
            )}
            
            {isGenerating && (
              <div className="space-y-3">
                <Progress value={progress} className="w-full max-w-sm mx-auto" />
                <p className="text-sm text-muted-foreground">Generating summary...</p>
              </div>
            )}
            
            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                onClick={generateNewSummary}
                disabled={isGenerating || (sources.length === 0 && selectedNewsletters.length === 0)}
                size="lg"
                className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Summary
                  </>
                )}
              </Button>
              
            </div>
          </div>
        </Card>
      )}

      {/* Generated Summaries */}
      {summaries.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Recent Summaries</h3>
          
          {summaries.map((summary) => (
            <Card key={summary.id} className="p-6 bg-background-secondary border-border shadow-card hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h4 className="text-lg font-semibold mb-2">{summary.title}</h4>
                  <p className="text-muted-foreground text-sm mb-3 line-clamp-3">
                    {summary.content.substring(0, 200)}...
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {summary.duration}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {summary.createdAt.toLocaleDateString()}
                    </Badge>
                    {summary.sources.map((source) => (
                      <Badge key={source} variant="outline" className="text-xs">
                        {source}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 flex-wrap">
                <Button 
                  variant="default" 
                  size="sm" 
                  className="bg-gradient-primary"
                  onClick={() => isPlayingAudio ? stopAudio() : playAudio(summary)}
                  disabled={isLoadingAudio}
                >
                  {isLoadingAudio ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : isPlayingAudio ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Volume2 className="mr-2 h-4 w-4" />
                      Play Audio
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pauseAudio}
                  disabled={!isPlayingAudio}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pause Podcast
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onPlaySummary({
                    title: summary.title,
                    content: summary.textContent,
                    duration: summary.duration
                  })}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Text
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
};
