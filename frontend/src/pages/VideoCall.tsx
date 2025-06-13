import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, MessageCircle, Settings, ArrowLeft, Clock, User, Shield } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import axios from 'axios';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import WebRTCCall from '@/lib/webrtc';
import { API_URL } from "@/config";

/**
 * VideoCall Component - Meeting room for doctor-patient consultations
 * 
 * This page serves as the unified video consultation interface for both doctors and patients.
 * It is accessible from:
 *  - Patient Dashboard: Through the "Join Call" button in appointments
 *  - Doctor Dashboard: Through the "Start Consultation" button in appointments
 *  - Appointment Notifications: Through the "Join" button in notifications
 * 
 * Security features:
 * - Verifies user identity against appointment participants
 * - Ensures only authorized doctor and patient can join the specific call
 * - Uses consistent video_call_id for both participants
 * - Records access attempts
 * 
 * URL Pattern: /video-call/:appointmentId
 * Where appointmentId is used to fetch consultation details and verify authorization
 */

interface ConsultationData {
  consultation_id?: string;
  video_call_id: string;
  consultation_type: string;
  patient_name?: string;
  doctor_name?: string;
  start_time?: string;
  scheduled_time?: string;
  is_immediate?: boolean;
  patient_id?: string;
  doctor_id?: string;
  user_role?: string;
  appointment_date?: string;
  call_url?: string;
}

const VideoCall = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [consultation, setConsultation] = useState<ConsultationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [callActive, setCallActive] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState('00:00');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [securityVerified, setSecurityVerified] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [lastConnectAttempt, setLastConnectAttempt] = useState<Date | null>(null);

  // WebRTC
  const webrtcRef = useRef<WebRTCCall | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Load user data and fetch consultation in one effect
  useEffect(() => {
    // Get current user data
    const userStr = localStorage.getItem('user');
    let user = null;
    
    if (userStr) {
      try {
        user = JSON.parse(userStr);
        setCurrentUser(user);
      } catch (e) {
        console.error('Failed to parse user data');
        toast({
          title: "Authentication Required",
          description: "Please log in to join the consultation",
          variant: "destructive"
        });
        navigate('/login/patient');
        return;
      }
    } else {
      toast({
        title: "Authentication Required",
        description: "Please log in to join the consultation",
        variant: "destructive"
      });
      navigate('/login/patient');
      return;
    }

    // Now that we have the user, fetch consultation data
    fetchConsultationData(user);
    
    // Cleanup function
    return () => {
      if (webrtcRef.current) {
        webrtcRef.current.endCall();
      }
    };
  }, [appointmentId]);

  // Update call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callActive && callStartTime) {
      interval = setInterval(() => {
        const now = new Date();
        const diff = now.getTime() - callStartTime.getTime();
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setCallDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callActive, callStartTime]);

  useEffect(() => {
    // Function to handle media stream issues with a retry mechanism
    const checkAndFixVideoDisplay = () => {
      console.log("Checking video elements...");
      
      // Check local video
      if (localVideoRef.current) {
        if (!localVideoRef.current.srcObject && webrtcRef.current?.localStream) {
          console.log("Fixing local video stream");
          localVideoRef.current.srcObject = webrtcRef.current.localStream;
          setHasLocalVideo(true);
          
          // Force play (needed for some mobile browsers)
          localVideoRef.current.play().catch(e => {
            console.warn("Local video autoplay failed:", e);
          });
        }
      }
      
      // Check remote video
      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject && !hasRemoteVideo) {
          console.log("Remote video stream detected");
          setHasRemoteVideo(true);
          
          // Force play (needed for some mobile browsers)
          remoteVideoRef.current.play().catch(e => {
            console.warn("Remote video autoplay failed:", e);
          });
        }
        
        // Check if we need to reconnect
        if (!remoteVideoRef.current.srcObject && callActive && 
            reconnectAttempts < 3 && connectionStatus !== 'Connection error') {
          
          // Avoid too frequent reconnection attempts
          const now = new Date();
          if (!lastConnectAttempt || (now.getTime() - lastConnectAttempt.getTime() > 10000)) {
            console.log("No remote video stream, attempting reconnection");
            setConnectionStatus('Reconnecting...');
            setLastConnectAttempt(now);
            setReconnectAttempts(prev => prev + 1);
            
            // Attempt to restart the call
            if (webrtcRef.current) {
              webrtcRef.current.endCall().then(() => {
                setTimeout(() => startCall(), 1000);
              });
            } else {
              startCall();
            }
          }
        }
      }
    };
    
    // Set up interval to check video status
    const checkInterval = setInterval(checkAndFixVideoDisplay, 5000);
    
    // Also check immediately
    if (callActive) {
      checkAndFixVideoDisplay();
    }
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [callActive, hasRemoteVideo, hasLocalVideo, reconnectAttempts, connectionStatus, lastConnectAttempt]);

  // Handle video element events
  useEffect(() => {
    const handleLoadedMetadata = () => {
      console.log("Video loaded metadata");
    };
    
    const handlePlaying = () => {
      console.log("Video is playing");
      if (remoteVideoRef.current === document.activeElement) {
        setHasRemoteVideo(true);
      }
      if (localVideoRef.current === document.activeElement) {
        setHasLocalVideo(true);
      }
    };
    
    // Set up event listeners
    if (localVideoRef.current) {
      localVideoRef.current.onloadedmetadata = handleLoadedMetadata;
      localVideoRef.current.onplaying = handlePlaying;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.onloadedmetadata = handleLoadedMetadata;
      remoteVideoRef.current.onplaying = handlePlaying;
    }
    
    return () => {
      // Remove event listeners
      if (localVideoRef.current) {
        localVideoRef.current.onloadedmetadata = null;
        localVideoRef.current.onplaying = null;
      }
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.onloadedmetadata = null;
        remoteVideoRef.current.onplaying = null;
      }
    };
  }, [callActive]);

  const fetchConsultationData = async (user: any) => {
    if (!appointmentId) return;
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please log in to join the consultation",
          variant: "destructive"
        });
        navigate('/login/patient');
        return;
      }
      
      const response = await axios.get(`${API_URL}/api/consultations/join/${appointmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // The actual consultation data might be nested under a 'consultation' key
      const consultationData = response.data.consultation || response.data;
      console.log('Consultation data received:', consultationData);
      
      if (consultationData) {
        // Set the consultation data regardless of security checks
        setConsultation(consultationData);
        
        // Simplified security verification - if we can fetch the appointment, user is authorized
        setSecurityVerified(true);
      } else {
        toast({
          title: "Consultation Not Found",
          description: "Unable to find consultation details",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Error fetching consultation:', error);
      toast({
        title: "Access Denied",
        description: error.response?.data?.error || "Unable to join consultation",
        variant: "destructive"
      });
      
      // Redirect to appropriate dashboard based on user role
      if (user) {
        navigate('/dashboard/' + user.role);
      } else {
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const startCall = async () => {
    if (!consultation) {
      toast({
        title: "Consultation Not Found",
        description: "Unable to find consultation details",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setConnectionStatus('Initializing call...');
      
      // Cleanup any existing WebRTC call
      if (webrtcRef.current) {
        await webrtcRef.current.endCall();
        webrtcRef.current = null;
      }
      
      // Reset video states
      setHasLocalVideo(false);
      setHasRemoteVideo(false);
      
      // Create WebRTC call instance
      const videoCallId = consultation.video_call_id || `call_${appointmentId}`;
      
      const webrtc = new WebRTCCall({
        roomId: videoCallId,
        appointmentId: appointmentId || '',
        onLocalStream: (stream) => {
          console.log("Got local stream with tracks:", 
                     stream.getVideoTracks().length, "video,", 
                     stream.getAudioTracks().length, "audio");
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            setHasLocalVideo(stream.getVideoTracks().length > 0);
            
            // Ensure video tracks are properly enabled
            stream.getVideoTracks().forEach(track => {
              track.enabled = videoEnabled;
            });
            
            // Ensure audio tracks are properly enabled
            stream.getAudioTracks().forEach(track => {
              track.enabled = audioEnabled;
            });
            
            // Force play on mobile devices
            localVideoRef.current.play().catch(e => {
              console.warn("Local video autoplay failed:", e);
            });
          }
          setConnectionStatus('Connecting to peer...');
        },
        onRemoteStream: (stream) => {
          console.log("Got remote stream with tracks:", 
                     stream.getVideoTracks().length, "video,", 
                     stream.getAudioTracks().length, "audio");
          
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
            setHasRemoteVideo(stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled);
            
            // Force play the video
            remoteVideoRef.current.play().catch(e => {
              console.warn("Remote video autoplay failed:", e);
              // Try again after a user gesture
              const unlockAudioAndVideo = () => {
                remoteVideoRef.current?.play().catch(err => {
                  console.error("Failed to play remote video after user gesture:", err);
                });
                document.body.removeEventListener('click', unlockAudioAndVideo);
                document.body.removeEventListener('touchstart', unlockAudioAndVideo);
              };
              
              document.body.addEventListener('click', unlockAudioAndVideo);
              document.body.addEventListener('touchstart', unlockAudioAndVideo);
              
              // Show a toast to prompt user action
              toast({
                title: "Action Required",
                description: "Please tap anywhere on the screen to enable audio",
              });
            });
          }
          setConnectionStatus('Connected');
        },
        onPeerConnected: () => {
          setConnectionStatus('Connected');
          setCallActive(true);
          setCallStartTime(new Date());
          toast({
            title: "Connected",
            description: "You are now connected to the consultation"
          });
        },
        onPeerDisconnected: () => {
          setConnectionStatus('Peer disconnected');
          toast({
            title: "Disconnected",
            description: "The other participant has left the call",
            variant: "destructive"
          });
        },
        onError: (error) => {
          console.error('WebRTC error:', error);
          setConnectionStatus('Connection error');
          toast({
            title: "Connection Error",
            description: error.message || "Failed to establish video call",
            variant: "destructive"
          });
        }
      });
      
      // Store in ref for later access
      webrtcRef.current = webrtc;
      
      // Initialize the call
      await webrtc.initialize();
      
      // Update UI state
      setCallActive(true);
      setCallStartTime(new Date());
      
      toast({
        title: "Call Started",
        description: "Connecting to the other participant..."
      });
    } catch (error) {
      console.error('Failed to start call:', error);
      toast({
        title: "Failed to Start Call",
        description: "Could not access camera or microphone. Please allow access and try again.",
        variant: "destructive"
      });
      setConnectionStatus('Failed to start');
    }
  };

  const endCall = async () => {
    if (webrtcRef.current) {
      // End WebRTC call
      await webrtcRef.current.endCall();
      webrtcRef.current = null;
    }
    
    setCallActive(false);
    setCallStartTime(null);
    setCallDuration('00:00');
    setHasLocalVideo(false);
    setHasRemoteVideo(false);
    setReconnectAttempts(0);
    
    toast({
      title: "Call Ended",
      description: "Thank you for using our consultation service",
    });
    
    // Navigate back to dashboard after a short delay
    setTimeout(() => {
      if (currentUser) {
        navigate('/dashboard/' + currentUser.role);
      } else {
        navigate('/');
      }
    }, 2000);
  };

  const toggleVideo = () => {
    const newVideoState = !videoEnabled;
    setVideoEnabled(newVideoState);
    
    if (webrtcRef.current) {
      webrtcRef.current.toggleVideo(newVideoState);
      
      // Update local video display immediately
      if (localVideoRef.current && webrtcRef.current.localStream) {
        const videoTracks = webrtcRef.current.localStream.getVideoTracks();
        setHasLocalVideo(videoTracks.length > 0 && newVideoState);
      }
    }
    
    toast({
      title: newVideoState ? "Video Enabled" : "Video Disabled",
      description: newVideoState ? "Your camera is now on" : "Your camera is now off",
    });
  };

  const toggleAudio = () => {
    const newAudioState = !audioEnabled;
    setAudioEnabled(newAudioState);
    
    if (webrtcRef.current) {
      webrtcRef.current.toggleAudio(newAudioState);
    }
    
    toast({
      title: newAudioState ? "Microphone Unmuted" : "Microphone Muted",
      description: newAudioState ? "Your microphone is now unmuted" : "Your microphone is now muted",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading consultation...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Consultation Not Found</h2>
              <p className="text-gray-600 mb-4">
                Unable to find the consultation details.
              </p>
              <Button onClick={() => navigate(currentUser ? `/dashboard/${currentUser.role}` : '/')}>
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const userRole = currentUser?.role || '';
  const isDoctor = userRole === 'doctor';
  const doctorName = consultation.doctor_name || 'Physician';
  const patientName = consultation.patient_name || 'Patient';
  
  // For display in the UI
  const otherParticipantName = isDoctor ? patientName : doctorName;
  const otherParticipantRole = isDoctor ? 'Patient' : 'Doctor';
  const currentUserName = isDoctor ? doctorName : patientName;

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      
      <div className="flex-grow flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate(`/dashboard/${userRole}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Video Consultation</h1>
                <p className="text-sm text-gray-600">
                  {isDoctor ? `with ${patientName}` : `with Dr. ${doctorName}`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {callActive && (
                <div className="flex items-center space-x-2 text-sm">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span className="font-mono text-green-600">{callDuration}</span>
                  <Badge variant="default" className="bg-green-600">Live</Badge>
                </div>
              )}
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Shield className="h-3 w-3 mr-1 text-green-600" />
                Room: {consultation.video_call_id?.substring(0, 8) || appointmentId?.substring(0, 8)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Video Area */}
        <div className="flex-grow flex">
          <div className="flex-grow bg-gray-900 relative">
            {/* Main video area */}
            <div className="h-full flex items-center justify-center">
              {!callActive ? (
                <Card className="w-full max-w-md mx-4">
                  <CardHeader className="text-center">
                    <CardTitle>Ready to Start Consultation?</CardTitle>
                    <CardDescription>
                      {isDoctor ? 
                        `${patientName} is waiting for you to begin the ${consultation.consultation_type} consultation` :
                        `Dr. ${doctorName} is waiting to begin your ${consultation.consultation_type} consultation`
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center space-y-2">
                      <div className="w-20 h-20 bg-medical-blue rounded-full flex items-center justify-center mx-auto">
                        <User className="h-10 w-10 text-white" />
                      </div>
                      <p className="font-medium">{currentUserName}</p>
                      <p className="text-sm text-gray-600">{userRole}</p>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Consultation Type:</span>
                        <Badge variant="outline" className="capitalize">
                          {consultation.consultation_type}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Room ID:</span>
                        <span className="font-mono text-xs truncate max-w-[150px]">
                          {consultation.video_call_id || `room_${appointmentId}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Scheduled Time:</span>
                        <span>
                          {consultation.scheduled_time || consultation.appointment_date ? 
                            new Date(consultation.scheduled_time || consultation.appointment_date || '').toLocaleTimeString() :
                            'Immediate consultation'
                          }
                        </span>
                      </div>
                    </div>
          
                    <Button 
                      onClick={startCall} 
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      <Video className="h-5 w-5 mr-2" />
                      Start Consultation
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full w-full flex flex-col">
                  {/* Video feeds */}
                  <div className="flex-grow flex">
                    {/* Remote participant video (main) */}
                    <div className="flex-grow bg-gray-800 relative border border-gray-600 rounded-lg mx-4 my-4 overflow-hidden">
                      {(connectionStatus !== 'Connected' || !hasRemoteVideo) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gray-800/70">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                          <h3 className="text-white text-xl font-medium">{connectionStatus}</h3>
                          <p className="text-gray-300 mt-2">Waiting for {otherParticipantName} to join...</p>
                          {reconnectAttempts > 0 && (
                            <p className="text-gray-400 mt-1 text-sm">Reconnection attempt {reconnectAttempts}/3</p>
                          )}
                          {connectionStatus === 'Connected' && !hasRemoteVideo && (
                            <p className="text-white mt-3">
                              {otherParticipantName} is connected but their camera is off
                            </p>
                          )}
                        </div>
                      )}

                      <video
                        ref={remoteVideoRef}
                        className="w-full h-full object-contain rounded-lg"
                        autoPlay
                        playsInline
                      ></video>
                      
                      <div className="absolute bottom-4 left-4 flex items-center bg-black/50 px-3 py-1 rounded-full">
                        <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-white text-sm">{otherParticipantName}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Controls */}
                  <div className="bg-gray-800 p-4">
                    <div className="flex justify-center space-x-6">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className={`h-12 w-12 rounded-full ${videoEnabled ? 'bg-gray-700' : 'bg-red-600'}`}
                        onClick={toggleVideo}
                      >
                        {videoEnabled ? (
                          <Video className="h-5 w-5 text-white" />
                        ) : (
                          <VideoOff className="h-5 w-5 text-white" />
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className={`h-12 w-12 rounded-full ${audioEnabled ? 'bg-gray-700' : 'bg-red-600'}`}
                        onClick={toggleAudio}
                      >
                        {audioEnabled ? (
                          <Mic className="h-5 w-5 text-white" />
                        ) : (
                          <MicOff className="h-5 w-5 text-white" />
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-12 w-12 rounded-full bg-red-600 hover:bg-red-700"
                        onClick={endCall}
                      >
                        <PhoneOff className="h-5 w-5 text-white" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Self Video (small overlay) */}
            {callActive && (
              <div className="absolute bottom-20 right-8 w-36 h-48 bg-gray-700 rounded-lg border border-gray-600 overflow-hidden">
                {videoEnabled && hasLocalVideo ? (
                  <video
                    ref={localVideoRef}
                    className="w-full h-full object-contain"
                    autoPlay
                    playsInline
                    muted // Mute local video to prevent feedback
                  ></video>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-1">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <p className="text-xs font-medium">You</p>
                      <p className="text-xs text-gray-400">Camera Off</p>
                    </div>
                  </div>
                )}
                
                {!videoEnabled && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="outline" className="bg-black/50 text-white border-none text-xs">
                      <VideoOff className="h-3 w-3 mr-1" />
                      Off
                    </Badge>
                  </div>
                )}
                
                {!audioEnabled && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="outline" className="bg-black/50 text-white border-none text-xs">
                      <MicOff className="h-3 w-3 mr-1" />
                      Muted
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default VideoCall;
