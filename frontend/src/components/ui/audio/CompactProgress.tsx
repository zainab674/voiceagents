import * as React from "react";
import { cn } from "@/lib/utils";

interface CompactProgressProps {
  currentTime: number;
  totalDuration: number;
  duration?: string;
  onProgressChange: (event: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
}

export const CompactProgress = React.forwardRef<
  HTMLDivElement,
  CompactProgressProps
>(({ currentTime, totalDuration, duration, onProgressChange, className }, ref) => {
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const displayDuration = duration || formatTime(totalDuration);

  return (
    <div className={cn("flex-1   flex items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground min-w-[2.5rem]">
        {formatTime(currentTime)}
      </span>
      <div
        ref={ref}
        className="flex-1 h-2 bg-gray-500 rounded-full cursor-pointer relative group"
        onClick={onProgressChange}
      >
        <div
          className="h-full bg-primary rounded-full transition-all duration-200 group-hover:bg-primary/90"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>

    </div>
  );
});

CompactProgress.displayName = "CompactProgress";

