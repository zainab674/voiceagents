import * as React from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompactPlayButtonProps {
  isPlaying: boolean;
  onClick: () => void;
  className?: string;
}

export function CompactPlayButton({
  isPlaying,
  onClick,
  className
}: CompactPlayButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-full",
        "bg-primary text-primary-foreground",
        "hover:bg-primary/90 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        className
      )}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      {isPlaying ? (
        <Pause className="w-4 h-4" />
      ) : (
        <Play className="w-4 h-4 ml-0.5" />
      )}
    </button>
  );
}

