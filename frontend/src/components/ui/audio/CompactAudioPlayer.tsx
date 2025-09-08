import * as React from "react";
import { cn } from "@/lib/utils";
import { CompactPlayButton } from "./CompactPlayButton";
import { CompactProgress } from "./CompactProgress";

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
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const progressRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const audio = new Audio(src);
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const handleLoadMetadata = () => {
      setTotalDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      console.error("Audio playback error");
      setIsPlaying(false);
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
        <CompactPlayButton isPlaying={isPlaying} onClick={togglePlayPause} />
        <CompactProgress
          currentTime={currentTime}
          totalDuration={totalDuration}
          duration={duration}
          onProgressChange={handleProgressChange}
          ref={progressRef}
        />
      </div>
    </div>
  );
}

