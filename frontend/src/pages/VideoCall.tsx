import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import WebRTCCall from '@/lib/webrtc';
import { API_URL } from "@/config";
import { Clock, Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from "lucide-react";
import { MdVideocam, MdVideocamOff, MdMic, MdMicOff, MdCallEnd } from 'react-icons/md';

/**
 * VideoCall component for real-time WebRTC consultations
 */
const VideoCall: React.FC = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State
  const [loading, setLoading] = useState(true);
  const [securityVerified, setSecurityVerified] = useState(false);
  const [consultation, setConsultation] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<'waiting'|'connecting'|'connected'|'disconnected'>('waiting');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [lastConnectAttempt, setLastConnectAttempt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remoteUserName, setRemoteUserName] = useState<string>('');
  
  // WebRTC
  const webrtcRef = useRef<WebRTCCall | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Load user data and fetch consultation in one effect
  useEffect(() => {
    const fetchConsultation = async () => {
      if (!appointmentId) {
        toast({
          title: "Missing appointment ID",
          description: "Cannot start video call without appointment ID",
          variant: "destructive"
        });
        navigate('/appointments');
        return;
      }
      
      try {
        setLoading(true);
        
        // Get consultation data
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/consultations/join/${appointmentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const consultationData = response.data;
        
        if (consultationData && consultationData.room_id) {
          setConsultation(consultationData);
          // Simplified security verification - if we can fetch the appointment, user is authorized
          setSecurityVerified(true);

          // Set remote user name based on current user role
          const userRole = localStorage.getItem('userRole');
          if (userRole === 'doctor') {
            setRemoteUserName(consultationData.patient_name || 'Patient');
          } else {
            setRemoteUserName(consultationData.doctor_name || 'Doctor');
          }
        } else {
          toast({
            title: "Invalid consultation",
            description: "Cannot start video call with this appointment",
            variant: "destructive"
          });
          navigate('/appointments');
        }
      } catch (error: any) {
        console.error('Error fetching consultation:', error);
        toast({
          title: "Error fetching consultation",
          description: error.response?.data?.error || "Failed to load consultation details",
          variant: "destructive"
        });
        navigate('/appointments');
      } finally {
        setLoading(false);
      }
    };
    
    fetchConsultation();
  }, [appointmentId, navigate, toast]);
  
  // Initialize WebRTC when consultation is loaded
  useEffect(() => {
    if (!securityVerified || !consultation?.room_id) return;
    
    // Create WebRTC call instance
    const webrtcCall = new WebRTCCall({
      roomId: consultation.room_id,
      appointmentId: appointmentId || '',
      onLocalStream: (stream) => {
        console.log('Got local stream in component');
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          
          // Enable autoplay for mobile devices
          localVideoRef.current.onloadedmetadata = () => {
            console.log('Local video metadata loaded');
            localVideoRef.current?.play().catch(e => {
              console.error('Error auto-playing local video:', e);
            });
          };
        }
      },
      onRemoteStream: (stream) => {
        console.log('Got remote stream in component');
        if (remoteVideoRef.current) {
          // Store remote stream in video element
          remoteVideoRef.current.srcObject = stream;
          
          // Set event handlers to handle autoplay issues
          remoteVideoRef.current.onloadedmetadata = () => {
            console.log('Remote video metadata loaded');
            // Try to auto-play when loaded (needed for mobile browsers)
            remoteVideoRef.current?.play().catch(e => {
              console.error('Error auto-playing remote video:', e);
              // If autoplay fails, show a play button or message
              setError('Tap the video to enable playback');
            });
          };
          
          // Ensure tracks are enabled
          const videoTracks = stream.getVideoTracks();
          const audioTracks = stream.getAudioTracks();
          
          // Log the tracks we received
          console.log(`Remote stream has ${videoTracks.length} video tracks and ${audioTracks.length} audio tracks`);
          
          videoTracks.forEach(track => {
            console.log(`Remote video track: ${track.id}, enabled: ${track.enabled}`);
            track.enabled = true; // Ensure video is enabled
          });
          
          audioTracks.forEach(track => {
            console.log(`Remote audio track: ${track.id}, enabled: ${track.enabled}`);
            track.enabled = true; // Ensure audio is enabled
          });
          
          setHasRemoteVideo(videoTracks.length > 0);
        }
      },
      onPeerConnected: () => {
        console.log('Peer connected');
        setCallStatus('connected');
        // Start timer for call duration
        if (durationTimerRef.current) {
          clearInterval(durationTimerRef.current);
        }
        durationTimerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      },
      onPeerDisconnected: () => {
        console.log('Peer disconnected');
        setCallStatus('disconnected');
        setHasRemoteVideo(false);
        // Stop timer
        if (durationTimerRef.current) {
          clearInterval(durationTimerRef.current);
          durationTimerRef.current = null;
        }
      },
      onError: (error) => {
        console.error('WebRTC error:', error);
        toast({
          title: "Video Call Error",
          description: error.message,
          variant: "destructive"
        });
      }
    });
    
    // Store reference and change status
    webrtcRef.current = webrtcCall;
    setCallStatus('connecting');
    
    // Initialize connection
    webrtcCall.initialize().catch(error => {
      console.error('Error initializing WebRTC call:', error);
      toast({
        title: "Failed to start video call",
        description: error.message,
        variant: "destructive"
      });
      setCallStatus('disconnected');
    });
    
    // Record connection attempt time
    setLastConnectAttempt(new Date());
    
    // Cleanup function
    return () => {
      if (webrtcRef.current) {
        webrtcRef.current.endCall();
        webrtcRef.current = null;
      }
      
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [appointmentId, consultation, securityVerified, toast]);
  
  // Handle toggle video
  const toggleVideo = () => {
    if (webrtcRef.current) {
      const newState = !videoEnabled;
      webrtcRef.current.toggleVideo(newState);
      setVideoEnabled(newState);
      
      // Verify the tracks were toggled correctly
      if (webrtcRef.current.localStream) {
        const videoTracks = webrtcRef.current.localStream.getVideoTracks();
        console.log('Video tracks after toggle:', videoTracks.map(t => ({ id: t.id, enabled: t.enabled })));
      }
    }
  };
  
  // Handle toggle audio
  const toggleAudio = () => {
    if (webrtcRef.current) {
      const newState = !audioEnabled;
      webrtcRef.current.toggleAudio(newState);
      setAudioEnabled(newState);
      
      // Verify the tracks were toggled correctly
      if (webrtcRef.current.localStream) {
        const audioTracks = webrtcRef.current.localStream.getAudioTracks();
        console.log('Audio tracks after toggle:', audioTracks.map(t => ({ id: t.id, enabled: t.enabled })));
      }
    }
  };
  
  // Handle end call
  const endCall = async () => {
    if (webrtcRef.current) {
      await webrtcRef.current.endCall();
      webrtcRef.current = null;
    }
    
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    
    toast({
      title: "Call Ended",
      description: "Video consultation has ended"
    });
    
    navigate('/appointments');
  };

  // Format call duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add manual play handler for mobile browsers that block autoplay
  const handleManualPlay = () => {
    if (remoteVideoRef.current && remoteVideoRef.current.paused) {
      remoteVideoRef.current.play().then(() => {
        setError(null);
      }).catch(e => {
        console.error('Failed to play remote video manually:', e);
      });
    }
    
    if (localVideoRef.current && localVideoRef.current.paused) {
      localVideoRef.current.play().catch(e => {
        console.error('Failed to play local video manually:', e);
      });
    }
  };
  
  // Log stream states for debugging
  const debugVideoElements = () => {
    if (localVideoRef.current) {
      console.log('Local video element state:', {
        paused: localVideoRef.current.paused,
        currentTime: localVideoRef.current.currentTime,
        videoWidth: localVideoRef.current.videoWidth,
        videoHeight: localVideoRef.current.videoHeight,
        readyState: localVideoRef.current.readyState,
      });
    }
    
    if (remoteVideoRef.current) {
      console.log('Remote video element state:', {
        paused: remoteVideoRef.current.paused,
        currentTime: remoteVideoRef.current.currentTime,
        videoWidth: remoteVideoRef.current.videoWidth,
        videoHeight: remoteVideoRef.current.videoHeight,
        readyState: remoteVideoRef.current.readyState,
      });
      
      // Check if the srcObject has tracks
      const remoteStream = remoteVideoRef.current.srcObject as MediaStream;
      if (remoteStream) {
        console.log('Remote stream tracks:', {
          videoTracks: remoteStream.getVideoTracks().length,
          audioTracks: remoteStream.getAudioTracks().length,
          videoEnabled: remoteStream.getVideoTracks().length > 0 ? remoteStream.getVideoTracks()[0].enabled : 'no track',
          audioEnabled: remoteStream.getAudioTracks().length > 0 ? remoteStream.getAudioTracks()[0].enabled : 'no track',
        });
      }
    }
    
    // Check WebRTC state
    const webrtcCall = webrtcRef.current;
    if (webrtcCall) {
      console.log('WebRTC call state:', {
        hasLocalStream: !!webrtcCall.localStream,
        hasRemoteStream: !!webrtcCall.remoteStream,
        localVideoTracks: webrtcCall.localStream?.getVideoTracks().length || 0,
        localAudioTracks: webrtcCall.localStream?.getAudioTracks().length || 0,
        remoteVideoTracks: webrtcCall.remoteStream?.getVideoTracks().length || 0,
        remoteAudioTracks: webrtcCall.remoteStream?.getAudioTracks().length || 0,
      });
    }
  };
  
  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Starting video call...</h2>
          <p>Preparing your consultation</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="video-call-container h-screen w-full flex flex-col overflow-hidden bg-gradient-to-br from-gray-900 to-black relative">
      {/* Main video area */}
      <div className="flex-1 relative overflow-hidden" onClick={handleManualPlay}>
        {/* Remote video (or waiting screen) */}
        <div className="w-full h-full relative">
          {/* Actual video element */}
          <video
            ref={remoteVideoRef}
            className={`w-full h-full object-cover ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'}`}
            autoPlay
            playsInline
          />
          
          {/* Waiting overlay when no remote video */}
          {(callStatus === 'waiting' || callStatus === 'connecting') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold">Waiting for {remoteUserName}</h2>
                <p>The consultation will begin when they join</p>
                <div className="animate-pulse mt-8">
                  <Phone className="h-16 w-16 mx-auto text-green-500" />
                </div>
              </div>
            </div>
          )}
          
          {/* Disconnected overlay */}
          {callStatus === 'disconnected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold">Call Ended</h2>
                <p>{remoteUserName} has left the consultation</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate('/appointments')}
                >
                  Return to Appointments
                </Button>
              </div>
            </div>
          )}
          
          {/* Local video (PIP) */}
          <div className="absolute bottom-4 right-4 w-1/4 max-w-[200px] h-auto aspect-video rounded-lg overflow-hidden border-2 border-white">
            <video
              ref={localVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted // Always mute local video to prevent feedback
            />
            
            {/* Video disabled indicator */}
            {!videoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
                <VideoOff className="text-white h-8 w-8" />
              </div>
            )}
          </div>
          
          {/* Debug button - only in development */}
          <button
            onClick={debugVideoElements}
            className="absolute top-2 right-2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-50 hover:opacity-100"
          >
            Debug
          </button>
          
          {/* Error message */}
          {error && (
            <div className="absolute top-4 left-0 right-0 mx-auto max-w-sm bg-red-500 text-white p-2 rounded text-center">
              {error}
            </div>
          )}
        </div>
      </div>
      
      {/* Call controls */}
      <div className="p-4 bg-gray-900">
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-semibold">{consultation?.doctor_name || 'Doctor'}</h2>
              <div className="text-sm text-gray-500">Consultation with {consultation?.patient_name || 'Patient'}</div>
              
              {callStatus === 'connected' && (
                <div className="flex items-center space-x-2 text-sm">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span className="font-mono text-green-600">{formatDuration(callDuration)}</span>
                  <Badge variant="default" className="bg-green-600">Live</Badge>
                </div>
              )}
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant={videoEnabled ? "default" : "destructive"}
                size="icon"
                onClick={toggleVideo}
              >
                {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
              
              <Button
                variant={audioEnabled ? "default" : "destructive"}
                size="icon"
                onClick={toggleAudio}
              >
                {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="destructive"
                size="icon"
                onClick={endCall}
              >
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default VideoCall;
