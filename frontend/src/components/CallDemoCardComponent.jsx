import { CardContent } from '@/components/ui/card'
import { Mic, MicOff, Phone, PhoneOff, Sparkles, Volume2, VolumeX } from 'lucide-react'
import React, { useEffect } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

const CallDemoCard = ({ setIsCallActive, callStatus, isCallActive, isMuted, isAudioEnabled, handleStartCall, toggleMute, toggleAudio, handleEndCall }) => {



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
                       
                        <Phone className="w-8 h-8 text-muted-foreground" />
                        
                    </div>
                    <p className="text-lg font-medium">
                        Ready to Connect
                    </p>
                </div>

                {/* Call Controls */}
                <div className="flex justify-center gap-4">
                    <Button
                        variant="hero"
                        size="xl"
                        onClick={handleStartCall}
                        disabled={callStatus === "connecting"}
                        className="px-12"
                    >
                        <Phone className="w-5 h-5 mr-2" />
                        {callStatus === "connecting" ? "Connecting..." : "Start AI Call"}
                    </Button>
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

export default CallDemoCard