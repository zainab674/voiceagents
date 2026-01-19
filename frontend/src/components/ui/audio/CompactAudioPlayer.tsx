import * as React from "react";
import { cn } from "@/lib/utils";
import { CompactPlayButton } from "./CompactPlayButton";
import { CompactProgress } from "./CompactProgress";
import { supabase } from "@/lib/supabase";

interface CompactAudioPlayerProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string;
  duration?: string;
  title?: string;
}

export function CompactAudioPlayer({
  src,
  duration,
  title,
  className,
  ...props
}: CompactAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [totalDuration, setTotalDuration] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const progressRef = React.useRef<HTMLDivElement>(null);
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

  const handleProgressChange = (event: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && audioRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const percentage = x / rect.width;
      const newTime = percentage * (totalDuration || parseFloat(duration) || 0);

      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  if (error) {
    return (
      <div
        className={cn(
          "w-full p-3",
          "bg-destructive/10 rounded-md",
          className
        )}
        {...props}
      >
        <div className="text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full ",
        "bg-white dark:bg-white/[0.03]",
        "backdrop-blur-md border border-white/[0.04]",
        "rounded-md shadow-sm",
        "transition-all duration-300",
        className
      )}
      {...props}
    >
      {title && (
        <div className="text-xs text-muted-foreground mb-2 truncate">
          {title}
        </div>
      )}
      <div className="flex items-center gap-3">
        <CompactPlayButton 
          isPlaying={isPlaying} 
          onClick={togglePlayPause}
          disabled={loading || !!error}
        />
        {loading ? (
          <div className="flex-1 text-xs text-muted-foreground">
            Loading audio...
          </div>
        ) : (
          <CompactProgress
            currentTime={currentTime}
            totalDuration={totalDuration}
            duration={duration}
            onProgressChange={handleProgressChange}
            ref={progressRef}
          />
        )}
      </div>
    </div>
  );
}

