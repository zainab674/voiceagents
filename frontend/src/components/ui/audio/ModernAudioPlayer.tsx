import * as React from "react";
import { Play, Pause, Download, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface ModernAudioPlayerProps {
  src: string;
  duration?: string;
  onDownload?: () => void;
  className?: string;
}

export function ModernAudioPlayer({ 
  src, 
  duration = "0:00", 
  onDownload,
  className 
}: ModernAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [totalDuration, setTotalDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  const [isMuted, setIsMuted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    // Check if src is an authenticated endpoint (contains /api/v1/calls/recording)
    const isAuthenticatedEndpoint = src.includes('/api/v1/calls/recording') || src.includes('/api/v1/call/recording');
    
    const loadAudio = async () => {
      try {
        setLoading(true);
        setError(null);

        let audioUrl = src;

        // If it's an authenticated endpoint, fetch as blob with auth headers
        if (isAuthenticatedEndpoint) {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session?.access_token) {
            throw new Error('No authentication token available');
          }

          const response = await fetch(src, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to load audio: ${response.status} ${response.statusText}`);
          }

          const blob = await response.blob();
          audioUrl = URL.createObjectURL(blob);
          objectUrlRef.current = audioUrl; // Store for cleanup
        }

        const audio = new Audio(audioUrl);
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;

        const handleLoadMetadata = () => {
          setTotalDuration(audio.duration);
          setLoading(false);
        };

        const handleTimeUpdate = () => {
          setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
          setIsPlaying(false);
          setCurrentTime(0);
        };

        const handleError = (e: Event) => {
          console.error("Audio playback error:", e);
          setError("Failed to load audio");
          setIsPlaying(false);
          setLoading(false);
        };

        audio.addEventListener("loadedmetadata", handleLoadMetadata);
        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("error", handleError);

        audio.load();

        return () => {
          audio.pause();
          audio.removeEventListener("loadedmetadata", handleLoadMetadata);
          audio.removeEventListener("timeupdate", handleTimeUpdate);
          audio.removeEventListener("ended", handleEnded);
          audio.removeEventListener("error", handleError);
        };
      } catch (err) {
        console.error("Error loading audio:", err);
        setError(err instanceof Error ? err.message : "Failed to load audio");
        setLoading(false);
      }
    };

    loadAudio();

    // Cleanup object URL on unmount
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [src]);

  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(error => {
              console.error("Audio playback failed:", error);
              setIsPlaying(false);
            });
        }
      }
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      const newTime = (value[0] / 100) * totalDuration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0] / 100);
    setIsMuted(value[0] === 0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  if (error) {
    return (
      <div className={cn("w-full p-4 bg-destructive/10 rounded-lg", className)}>
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Main Controls */}
      <div className="flex items-center gap-4">
        <Button
          onClick={togglePlayPause}
          size="lg"
          className="w-12 h-12 rounded-full"
          disabled={loading || !!error}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </Button>

        <div className="flex-1 space-y-2">
          {/* Progress Bar */}
          <div className="space-y-1">
            {loading ? (
              <div className="text-sm text-muted-foreground py-2">
                Loading audio...
              </div>
            ) : (
              <>
                <Slider
                  value={[progress]}
                  onValueChange={handleSeek}
                  max={100}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{duration || formatTime(totalDuration)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Volume Controls */}
        <div className="flex items-center gap-2">
          <Button
            onClick={toggleMute}
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
          <div className="w-20">
            <Slider
              value={[isMuted ? 0 : volume * 100]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        {/* Download Button */}
        {onDownload && (
          <Button
            onClick={onDownload}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        )}
      </div>
    </div>
  );
}

