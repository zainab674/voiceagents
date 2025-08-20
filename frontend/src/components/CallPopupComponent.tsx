import { CardContent } from '@/components/ui/card'
import { Mic, MicOff, Phone, PhoneOff, Sparkles, Volume2, VolumeX } from 'lucide-react'
import React, { useEffect } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ConnectionState, Track } from 'livekit-client';
import { useConnectionState, useLocalParticipant, useRoomContext, useTracks } from '@livekit/components-react';
import { useToast } from '@/hooks/use-toast'


const CallPopupComponent = ({ setIsCallActive, setCallStatus, callStatus, isCallActive, isMuted, isAudioEnabled, handleEndCall, setIsAudioEnabled, setIsMuted }) => {
    const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone], {
        onlySubscribed: true,
    });

    const { localParticipant } = useLocalParticipant();
    const roomState = useConnectionState();
    const room = useRoomContext();
    const { toast } = useToast();


    useEffect(() => {
        // Only set connected when room is connected AND we have received tracks
        if (roomState === ConnectionState.Connected && tracks.length > 0) {
            setIsCallActive(true);
            localParticipant.setMicrophoneEnabled(true);
            setCallStatus("connected");
        }

        if (roomState === ConnectionState.Disconnected && isCallActive) {
            handleEndCall();
            setCallStatus("ended");
        }
    }, [localParticipant, roomState, tracks]);


    

    return (
        <CardContent>
            <div className="text-center space-y-6">
                {/* Call Status */}
                <div className="space-y-2">
                    <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${callStatus === "connected"
                        ? "bg-gradient-to-r from-primary to-accent shadow-[var(--shadow-glow)] animate-pulse"
                        : callStatus === "connecting"
                            ? "bg-muted animate-pulse"
                            : "bg-muted"
                        }`}>
                        {callStatus === "connected" ? (
                            <Sparkles className="w-8 h-8 text-white" />
                        ) : (
                            <Phone className="w-8 h-8 text-muted-foreground" />
                        )}
                    </div>
                    <p className="text-lg font-medium">
                        {callStatus === "idle" && "Ready to Connect"}
                        {callStatus === "connecting" && "Connecting..."}
                        {callStatus === "connected" && "AI Assistant Active"}
                        {callStatus === "ended" && "Call Ended"}
                    </p>
                </div>

                {/* Call Controls */}
                <div className="flex justify-center gap-4">

                    <div className="flex gap-3">
                        <Button
                            variant="destructive"
                            size="lg"
                            onClick={handleEndCall}
                        >
                            <PhoneOff className="w-5 h-5" />
                        </Button>
                    </div>

                </div>

                {/* Call Features */}
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-2 h-2 p-0 rounded-full bg-green-500" />
                        Real-time AI responses
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-2 h-2 p-0 rounded-full bg-blue-500" />
                        WebRTC calling
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-2 h-2 p-0 rounded-full bg-purple-500" />
                        Voice synthesis
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-2 h-2 p-0 rounded-full bg-orange-500" />
                        Calendar integration
                    </div>
                </div>
            </div>
        </CardContent>
    )
}

export default CallPopupComponent