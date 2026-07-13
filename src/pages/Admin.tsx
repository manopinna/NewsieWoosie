import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Usage {
  tier?: string;
  status?: string;
  used: number;
  limit: number;
  remaining: number;
  next_reset_unix?: number | null;
}

// Rough estimates for a daily episode script
const AVG_CHARS_PER_EPISODE = 6500; // observed script length from summarize-articles
const SHORT_EPISODE = 2000;
const LONG_EPISODE = 10000;

interface EpisodeRow {
  id: string;
  title: string;
  created_at: string;
  tts_chars: number | null;
  script_chars: number | null;
  text_content: string | null;
}


export default function Admin() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customChars, setCustomChars] = useState<string>(String(AVG_CHARS_PER_EPISODE));
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [usageRes, epRes] = await Promise.all([
      supabase.functions.invoke("elevenlabs-usage"),
      supabase
        .from("podcast_summaries")
        .select("id,title,created_at,tts_chars,script_chars,text_content")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    if (usageRes.error) setError(usageRes.error.message);
    else if ((usageRes.data as any)?.error) setError((usageRes.data as any).error);
    else setUsage(usageRes.data as Usage);
    if (!epRes.error && epRes.data) setEpisodes(epRes.data as EpisodeRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pct = usage && usage.limit > 0 ? Math.min(100, (usage.used / usage.limit) * 100) : 0;
  const custom = parseInt(customChars, 10) || 0;
  const episodesLeft = (chars: number) => (chars > 0 && usage ? Math.floor(usage.remaining / chars) : 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin · ElevenLabs Usage</h1>
          <Button onClick={load} disabled={loading} variant="outline">
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6 text-destructive">{error}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Credit balance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!usage ? (
              <p className="text-muted-foreground">{loading ? "Loading..." : "No data"}</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <Stat label="Used" value={usage.used.toLocaleString()} />
                  <Stat label="Remaining" value={usage.remaining.toLocaleString()} />
                  <Stat label="Limit" value={usage.limit.toLocaleString()} />
                </div>
                <Progress value={pct} />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tier: {usage.tier ?? "—"} ({usage.status ?? "—"})</span>
                  {usage.next_reset_unix && (
                    <span>Resets: {new Date(usage.next_reset_unix * 1000).toLocaleDateString()}</span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Estimated credits per episode</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ElevenLabs charges 1 credit per character of the TTS script. Estimates below use typical script lengths.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <EstCard label="Short" chars={SHORT_EPISODE} episodesLeft={episodesLeft(SHORT_EPISODE)} />
              <EstCard label="Average" chars={AVG_CHARS_PER_EPISODE} episodesLeft={episodesLeft(AVG_CHARS_PER_EPISODE)} />
              <EstCard label="Long" chars={LONG_EPISODE} episodesLeft={episodesLeft(LONG_EPISODE)} />
            </div>

            <div className="pt-4 border-t space-y-2">
              <Label htmlFor="custom">Custom script length (characters)</Label>
              <div className="flex gap-2">
                <Input
                  id="custom"
                  type="number"
                  value={customChars}
                  onChange={(e) => setCustomChars(e.target.value)}
                />
                <div className="flex items-center px-4 rounded-md bg-muted text-sm whitespace-nowrap">
                  ≈ {episodesLeft(custom).toLocaleString()} episodes left
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent episodes</CardTitle></CardHeader>
          <CardContent>
            {episodes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No episodes yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-right">Estimated</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {episodes.map((e) => {
                    const est = e.script_chars ?? e.text_content?.length ?? 0;
                    const actual = e.tts_chars;
                    const delta = actual != null ? actual - est : null;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate">{e.title}</TableCell>
                        <TableCell className="text-right tabular-nums">{est.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {actual != null ? actual.toLocaleString() : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${delta == null ? "text-muted-foreground" : delta > 0 ? "text-destructive" : "text-emerald-600"}`}>
                          {delta == null ? "—" : (delta > 0 ? "+" : "") + delta.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              "Actual" is the character count sent to ElevenLabs (1 credit per character). Older episodes may show — because usage wasn't tracked at generation time.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

function EstCard({ label, chars, episodesLeft }: { label: string; chars: number; episodesLeft: number }) {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{chars.toLocaleString()} credits</div>
      <div className="text-xs text-muted-foreground mt-1">{episodesLeft.toLocaleString()} episodes left</div>
    </div>
  );
}
