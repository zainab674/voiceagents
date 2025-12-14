// import { CardContent } from '@/components/ui/card'
// import { Mic, MicOff, Phone, PhoneOff, Sparkles, Volume2, VolumeX, Calendar } from 'lucide-react'
// import React, { useEffect, useState } from 'react'
// import { Button } from './ui/button'
// import { Badge } from './ui/badge'
// import { ConnectionState, Track } from 'livekit-client';
// import { useConnectionState, useLocalParticipant, useRoomContext, useTracks } from '@livekit/components-react';
// import { useToast } from '@/hooks/use-toast'
// import InCallCalendar from './InCallCalendar'
// import { useVoiceCallTracking } from '@/hooks/useVoiceCallTracking'


// const CallPopupComponent = ({ setIsCallActive, setCallStatus, callStatus, isCallActive, isMuted, isAudioEnabled, handleEndCall, setIsAudioEnabled, setIsMuted, agentId }) => {
//     const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone], {
//         onlySubscribed: true,
//     });

//     const { localParticipant } = useLocalParticipant();
//     const roomState = useConnectionState();
//     const room = useRoomContext();
//     const { toast } = useToast();
//     const { startCallTracking, endCallTracking } = useVoiceCallTracking();


//     useEffect(() => {
//         // Only set connected when room is connected AND we have received tracks
//         if (roomState === ConnectionState.Connected && tracks.length > 0) {
//             setIsCallActive(true);
//             localParticipant.setMicrophoneEnabled(true);
//             setCallStatus("connected");
//             if (agentId) {
//                 startCallTracking(agentId, 'Voice Call');
//             }
//         }

//         if (roomState === ConnectionState.Disconnected && isCallActive) {
//             // End tracking when room disconnects
//             endCallTracking(true, 'completed');
//             handleEndCall();
//             setCallStatus("ended");
//         }
//     }, [localParticipant, roomState, tracks]);




//     return (
//         <CardContent>
//             <div className="text-center space-y-6">
//                 {/* Call Status */}
//                 <div className="space-y-2">
//                     <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${callStatus === "connected"
//                         ? "bg-gradient-to-r from-primary to-accent shadow-[var(--shadow-glow)] animate-pulse"
//                         : callStatus === "connecting"
//                             ? "bg-muted animate-pulse"
//                             : "bg-muted"
//                         }`}>
//                         {callStatus === "connected" ? (
//                             <Sparkles className="w-8 h-8 text-white" />
//                         ) : (
//                             <Phone className="w-8 h-8 text-muted-foreground" />
//                         )}
//                     </div>
//                     <p className="text-lg font-medium">
//                         {callStatus === "idle" && "Ready to Connect"}
//                         {callStatus === "connecting" && "Connecting..."}
//                         {callStatus === "connected" && "AI Assistant Active"}
//                         {callStatus === "ended" && "Call Ended"}
//                     </p>
//                 </div>

//                 {/* Call Controls */}
//                 <div className="flex justify-center gap-4">

//                     <div className="flex gap-3">

//                         <Button
//                             variant="destructive"
//                             size="lg"
//                             onClick={() => {
//                                 // Ensure we end tracking when user manually ends the call
//                                 endCallTracking(true, 'completed');
//                                 handleEndCall();
//                             }}
//                         >
//                             <PhoneOff className="w-5 h-5" />
//                         </Button>
//                     </div>

//                 </div>

//                 {/* Call Features */}
//                 <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
//                     <div className="flex items-center gap-2">
//                         <Badge variant="outline" className="w-2 h-2 p-0 rounded-full bg-green-500" />
//                         Real-time AI responses
//                     </div>
//                     <div className="flex items-center gap-2">
//                         <Badge variant="outline" className="w-2 h-2 p-0 rounded-full bg-blue-500" />
//                         WebRTC calling
//                     </div>
//                     <div className="flex items-center gap-2">
//                         <Badge variant="outline" className="w-2 h-2 p-0 rounded-full bg-purple-500" />
//                         Voice synthesis
//                     </div>
//                     <div className="flex items-center gap-2">
//                         <Badge variant="outline" className="w-2 h-2 p-0 rounded-full bg-orange-500" />
//                         Calendar integration
//                     </div>
//                 </div>
//             </div>


//         </CardContent>
//     )
// }

// export default CallPopupComponent




import { CardContent } from '@/components/ui/card'
import { Mic, MicOff, Phone, PhoneOff, Sparkles, Volume2, VolumeX, Calendar, Loader2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ConnectionState, Track } from 'livekit-client';
import { useConnectionState, useLocalParticipant, useRoomContext, useTracks } from '@livekit/components-react';
import { useToast } from '@/hooks/use-toast'
import InCallCalendar from './InCallCalendar'
import { useVoiceCallTracking } from '@/hooks/useVoiceCallTracking'


const CallPopupComponent = ({ setIsCallActive, setCallStatus, callStatus, isCallActive, isMuted, isAudioEnabled, handleEndCall, setIsAudioEnabled, setIsMuted, agentId }) => {
    const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone], {
        onlySubscribed: true,
    });

    const { localParticipant } = useLocalParticipant();
    const roomState = useConnectionState();
    const room = useRoomContext();
    const { toast } = useToast();
    const { startCallTracking, endCallTracking } = useVoiceCallTracking();
    const [dots, setDots] = useState('');

    // Animated dots for connecting state
    useEffect(() => {
        let interval;
        if (callStatus === "connecting") {
            interval = setInterval(() => {
                setDots(prev => {
                    if (prev.length >= 3) return '';
                    return prev + '.';
                });
            }, 500);
        } else {
            setDots('');
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [callStatus]);

    useEffect(() => {
        // Enable microphone immediately when room connects (important for web calls)
        // Don't wait for tracks - publish immediately so agent can hear us
        if (roomState === ConnectionState.Connected && localParticipant) {
            // Enable microphone immediately upon connection
            localParticipant.setMicrophoneEnabled(true);
            
            // Set call as active once connected
            if (!isCallActive) {
                setIsCallActive(true);
                setCallStatus("connected");
                if (agentId) {
                    startCallTracking(agentId, 'Voice Call');
                }
            }
        }

        if (roomState === ConnectionState.Disconnected && isCallActive) {
            // End tracking when room disconnects
            endCallTracking(true, 'completed');
            handleEndCall();
            setCallStatus("ended");
        }
    }, [localParticipant, roomState, isCallActive, agentId]);

    const getStatusIcon = () => {
        switch (callStatus) {
            case "connecting":
                return <Loader2 className="w-8 h-8 text-primary animate-spin" />;
            case "connected":
                return <Sparkles className="w-8 h-8 text-white animate-pulse" />;
            case "ended":
                return <PhoneOff className="w-8 h-8 text-muted-foreground" />;
            default:
                return <Phone className="w-8 h-8 text-muted-foreground" />;
        }
    };

    const getStatusText = () => {
        switch (callStatus) {
            case "idle":
                return "Ready to Connect";
            case "connecting":
                return `Making things ready${dots}`;
            case "connected":
                return "AI Assistant Active";
            case "ended":
                return "Call Ended";
            default:
                return "Ready to Connect";
        }
    };

    return (
        <CardContent>
            <div className="text-center space-y-6">
                {/* Call Status with Enhanced Animation */}
                <div className="space-y-2">
                    <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-500 transform ${callStatus === "connected"
                        ? "bg-gradient-to-r from-primary via-accent to-primary shadow-[0_0_20px_rgba(var(--primary),0.5)] animate-pulse scale-110"
                        : callStatus === "connecting"
                            ? "bg-gradient-to-r from-blue-400 to-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.4)] animate-bounce"
                            : callStatus === "ended"
                                ? "bg-red-100 dark:bg-red-900/20 scale-95"
                                : "bg-muted hover:scale-105"
                        }`}>
                        {getStatusIcon()}
                    </div>

                    {/* Status text with smooth transitions */}
                    <div className="h-8 flex items-center justify-center">
                        <p className={`text-lg font-medium transition-all duration-300 ${callStatus === "connected"
                            ? "text-primary animate-pulse"
                            : callStatus === "connecting"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-foreground"
                            }`}>
                            {getStatusText()}
                        </p>
                    </div>
                </div>

                {/* Call Controls with Animation */}
                <div className="flex justify-center gap-4">
                    <div className="flex gap-3">
                        <Button
                            variant="destructive"
                            size="lg"
                            className="transition-all duration-200 hover:scale-105 active:scale-95"
                            onClick={() => {
                                // Ensure we end tracking when user manually ends the call
                                endCallTracking(true, 'completed');
                                handleEndCall();
                            }}
                        >
                            <PhoneOff className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Call Features with Staggered Animation */}
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    {[
                        { color: "bg-green-500", text: "Real-time AI responses", delay: "animation-delay-0" },
                        { color: "bg-blue-500", text: "WebRTC calling", delay: "animation-delay-100" },
                        { color: "bg-purple-500", text: "Voice synthesis", delay: "animation-delay-200" },
                        { color: "bg-orange-500", text: "Calendar integration", delay: "animation-delay-300" }
                    ].map((feature, index) => (
                        <div
                            key={index}
                            className={`flex items-center gap-2 transition-all duration-300 hover:text-foreground hover:scale-105 ${callStatus === "connected" ? "animate-fade-in-up" : ""
                                }`}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <Badge
                                variant="outline"
                                className={`w-2 h-2 p-0 rounded-full ${feature.color} border-0 ${callStatus === "connected" ? "animate-ping" : ""
                                    }`}
                                style={{ animationDelay: `${index * 150}ms` }}
                            />
                            {feature.text}
                        </div>
                    ))}
                </div>

                {/* Connection Progress Bar */}
                {callStatus === "connecting" && (
                    <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-accent animate-pulse"></div>
                    </div>
                )}
            </div>

            <style >{`
                @keyframes fade-in-up {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .animate-fade-in-up {
                    animation: fade-in-up 0.5s ease-out forwards;
                }
                
                .animation-delay-0 { animation-delay: 0ms; }
                .animation-delay-100 { animation-delay: 100ms; }
                .animation-delay-200 { animation-delay: 200ms; }
                .animation-delay-300 { animation-delay: 300ms; }
                
                @keyframes bounce-gentle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                
                .animate-bounce-gentle {
                    animation: bounce-gentle 2s infinite;
                }
            `}</style>
        </CardContent>
    )
}

export default CallPopupComponent