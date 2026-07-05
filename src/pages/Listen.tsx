import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, Headphones } from "lucide-react";

interface PodcastSummary {
  id: string;
  title: string;
  text_content: string;
  audio_url: string | null;
  duration: string | null;
  created_at: string;
}

const Listen = () => {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<PodcastSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("podcast_summaries")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) {
        setError("Summary not found");
      } else {
        setSummary(data as PodcastSummary);
      }
      setLoading(false);
    };
    fetchSummary();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-semibold mb-2">Summary not found</h1>
          <p className="text-muted-foreground">
            This summary link may have expired or been removed.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background-secondary px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Headphones className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-3xl md:text-4xl font-bold">{summary.title}</h1>
          {summary.duration && (
            <p className="text-muted-foreground">🎧 {summary.duration}</p>
          )}
        </div>

        {summary.audio_url ? (
          <Card className="p-6 shadow-card">
            <audio controls className="w-full" src={summary.audio_url}>
              Your browser does not support the audio element.
            </audio>
          </Card>
        ) : (
          <Card className="p-6 text-center text-muted-foreground">
            Audio is not available for this summary.
          </Card>
        )}

        <Card className="p-6 shadow-card">
          <h2 className="text-xl font-semibold mb-4">Transcript</h2>
          <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
            {summary.text_content}
          </div>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Sent with care by Podcastify 🦔
        </p>
      </div>
    </div>
  );
};

export default Listen;
