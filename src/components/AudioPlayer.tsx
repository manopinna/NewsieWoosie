import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";

interface AudioPlayerProps {
  title: string;
  duration?: string;
  audioUrl?: string;
  text?: string; // Text to convert to speech
}

export const AudioPlayer = ({ title, duration = "0:00", audioUrl, text }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [volume, setVolume] = useState([80]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const togglePlayPause = () => {
    console.log("Play button clicked", { text, audioUrl, isSpeaking });
    
    // Handle text-to-speech
    if (text && !audioUrl) {
      if (isSpeaking) {
        console.log("Stopping speech synthesis");
        speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsPlaying(false);
      } else {
        console.log("Starting speech synthesis with text:", text);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = volume[0] / 100;
        
        utterance.onstart = () => {
          console.log("Speech synthesis started");
          setIsSpeaking(true);
          setIsPlaying(true);
        };
        
        utterance.onend = () => {
          console.log("Speech synthesis ended");
          setIsSpeaking(false);
          setIsPlaying(false);
        };
        
        utterance.onerror = (event) => {
          console.log("Speech synthesis error:", event);
          setIsSpeaking(false);
          setIsPlaying(false);
        };
        
        utteranceRef.current = utterance;
        console.log("Speaking utterance");
        speechSynthesis.speak(utterance);
      }
      return;
    }

    // Handle regular audio files
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setTotalDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  // Update speech volume when volume changes
  useEffect(() => {
    if (utteranceRef.current && isSpeaking) {
      // Note: Volume changes during speech aren't supported by Web Speech API
      // This is just for future utterances
    }
  }, [volume, isSpeaking]);

  return (
    <Card className="p-6 bg-background-secondary border-border shadow-card">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
        />
      )}
      
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {formatTime(currentTime)} / {totalDuration ? formatTime(totalDuration) : duration}
          </p>
        </div>

        {/* Waveform visualization placeholder */}
        <div className="h-20 bg-gradient-audio rounded-lg flex items-end justify-center gap-1 p-2">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="bg-audio-wave/60 rounded-full transition-all duration-300 hover:bg-audio-wave"
              style={{
                width: '2px',
                height: `${Math.random() * 60 + 20}%`,
                animation: isPlaying ? `pulse ${Math.random() * 2 + 1}s infinite` : 'none',
              }}
            />
          ))}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[totalDuration ? (currentTime / totalDuration) * 100 : 0]}
            onValueChange={(value) => {
              if (audioRef.current && totalDuration) {
                const newTime = (value[0] / 100) * totalDuration;
                audioRef.current.currentTime = newTime;
                setCurrentTime(newTime);
              }
            }}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" size="sm">
            <SkipBack className="h-5 w-5" />
          </Button>
          
          <Button
            size="lg"
            onClick={togglePlayPause}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300 rounded-full w-12 h-12"
          >
            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
          </Button>
          
          <Button variant="ghost" size="sm">
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* Dedicated Pause Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={togglePlayPause}
            disabled={!isPlaying}
            className="gap-2"
          >
            <Pause className="h-4 w-4" />
            Pause audio summary
          </Button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-3">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={volume}
            onValueChange={(value) => {
              setVolume(value);
              if (audioRef.current) {
                audioRef.current.volume = value[0] / 100;
              }
            }}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground w-8">
            {volume[0]}%
          </span>
        </div>
      </div>
    </Card>
  );
};