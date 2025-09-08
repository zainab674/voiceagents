import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModernAudioPlayer } from "@/components/ui/audio/ModernAudioPlayer";
import { useToast } from "@/hooks/use-toast";

interface RecordingPlayerProps {
  recording?: string;
  duration: string;
}

export function RecordingPlayer({ recording, duration }: RecordingPlayerProps) {
  const { toast } = useToast();

  const handleDownload = () => {
    if (recording) {
      // Create a temporary link to download the recording
      const link = document.createElement('a');
      link.href = recording;
      link.download = `recording-${Date.now()}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Recording downloaded",
        description: "Call recording has been downloaded",
      });
    }
  };

  if (!recording) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-muted/30">
        <p className="text-muted-foreground">No recording available for this call.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ModernAudioPlayer 
        src={recording} 
        duration={duration}
        onDownload={handleDownload}
        className="w-full rounded-xl"
      />
    </div>
  );
}

