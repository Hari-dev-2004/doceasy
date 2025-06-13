import React, { useEffect, useRef, useState, Suspense, lazy } from "react";
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

// Connection management constants
const CONNECTION_MANAGEMENT = {
  statusPollInterval: 2000,    // How often to check participant status (ms)
  maxConnectionTime: 45000,    // Max time to wait for connection before auto-refresh (ms)
  reconnectDelay: 2000,        // Delay before recreating WebRTC after errors (ms)
  participantCheckThreshold: 3 // How many status checks before triggering refresh
};

// Create a separate error boundary component
class VideoCallErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to an error reporting service
    console.error("VideoCall component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI when an error occurs
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
            <div className="text-red-500 mb-4 flex justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">
              Video Call Error
            </h1>
            <p className="text-gray-600 mb-6 text-center">
              {this.state.error?.message || "An unexpected error occurred in the video call component"}
            </p>
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  window.location.reload();
                }}
                className="mr-2"
              >
                Reload Page
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  const [doctorJoined, setDoctorJoined] = useState(false);
  const [patientJoined, setPatientJoined] = useState(false);
  const [currentRole, setCurrentRole] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [connectionAttempts, setConnectionAttempts] = useState<number>(0);
  const [participantCheckCounter, setParticipantCheckCounter] = useState<number>(0);
  const [refreshingConnection, setRefreshingConnection] = useState<boolean>(false);

  // WebRTC
  const webrtcRef = useRef<WebRTCCall | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomStatusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshingRef = useRef<boolean>(false);

  // Load user data and fetch consultation in one effect
  useEffect(() => {
    const fetchConsultation = async () => {
      if (!appointmentId) {
        toast({
          title: "Missing appointment ID",
          description: "Cannot start video call without appointment ID",
          variant: "destructive"
        });
        navigate('/');
        return;
      }
      
      try {
        setLoading(true);
        
        // Store current user role
        const userRole = localStorage.getItem('userRole');
        setCurrentRole(userRole || '');
        
        // Get consultation data
        const token = localStorage.getItem('token');
        // FIXED: Add error handling and retry logic for consultation fetching
        let attempts = 0;
        const maxAttempts = 3;
        let consultationData = null;
        
        while (attempts < maxAttempts && !consultationData) {
          try {
            attempts++;
            console.log(`Fetching consultation data, attempt ${attempts}/${maxAttempts}`);
            
            const response = await axios.get(`${API_URL}/api/consultations/join/${appointmentId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            consultationData = response.data;
          } catch (err: any) {
            console.error(`Attempt ${attempts} failed:`, err);
            
            if (attempts >= maxAttempts) {
              throw err;
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        if (consultationData && consultationData.video_call_id) {
          setConsultation(consultationData);
          setRoomId(consultationData.video_call_id);
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
          navigate('/');
        }
      } catch (error: any) {
        console.error('Error fetching consultation:', error);
        toast({
          title: "Error fetching consultation",
          description: error.response?.data?.error || "Failed to load consultation details",
          variant: "destructive"
        });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchConsultation();
  }, [appointmentId, navigate, toast]);
  
  // Start aggressive polling for room status to check participant join status
  useEffect(() => {
    if (!appointmentId || !securityVerified) return;
    
    // Internal counter for checking consecutive status consistency
    let missedParticipantCounter = 0;
    let otherParticipantJoined = false;
    let expectingOtherParticipant = currentRole === 'doctor' ? patientJoined : doctorJoined;
    
    const pollRoomStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await axios.get(
          `${API_URL}/api/webrtc/rooms/${appointmentId}/status`, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        const data = response.data;
        if (data.has_active_call) {
          // Update participant status
          setDoctorJoined(data.doctor_joined);
          setPatientJoined(data.patient_joined);

          // Check if the other participant is joined according to the server
          otherParticipantJoined = currentRole === 'doctor' ? data.patient_joined : data.doctor_joined;
          
          // If status differs from what we expect based on connection state
          if (expectingOtherParticipant !== otherParticipantJoined) {
            missedParticipantCounter++;
            
            // If we've seen inconsistent status multiple times and we're not already refreshing
            if (missedParticipantCounter >= CONNECTION_MANAGEMENT.participantCheckThreshold && 
                !refreshingRef.current && 
                callStatus !== 'connected') {
              console.log(`Participant status mismatch detected ${missedParticipantCounter} times, refreshing connection`);
              refreshConnection();
            }
          } else {
            // Reset counter when status is consistent
            missedParticipantCounter = 0;
          }
        }
      } catch (err) {
        console.error('Error polling room status:', err);
        // Don't increment counter on network errors
      }
    };
    
    // Initial poll
    pollRoomStatus();
    
    // Set up more frequent polling
    roomStatusIntervalRef.current = setInterval(pollRoomStatus, CONNECTION_MANAGEMENT.statusPollInterval);
    
    // Clean up interval on unmount
    return () => {
      if (roomStatusIntervalRef.current) {
        clearInterval(roomStatusIntervalRef.current);
      }
    };
  }, [appointmentId, securityVerified, currentRole, doctorJoined, patientJoined, callStatus]);
  
  // Function to refresh connection when needed
  const refreshConnection = () => {
    console.log('Refreshing WebRTC connection');
    
    // Prevent multiple simultaneous refreshes
    if (refreshingRef.current) {
      console.log('Already refreshing, skipping');
      return;
    }
    
    try {
      refreshingRef.current = true;
      setRefreshingConnection(true);
      setError('Connection issues detected. Refreshing connection...');
      
      // Clean up existing connection
      if (webrtcRef.current) {
        webrtcRef.current.endCall().catch(e => {
          console.error('Error ending call during refresh:', e);
        });
        webrtcRef.current = null;
      }
      
      // Reset state
      setCallStatus('waiting');
      setHasRemoteVideo(false);
      
      // Delay before reconnecting to allow cleanup
      setTimeout(() => {
        console.log('Initializing new WebRTC connection after refresh');
        initializeWebRTCCall();
      }, CONNECTION_MANAGEMENT.reconnectDelay);
    } catch (error) {
      console.error('Error during connection refresh:', error);
      
      // Ensure we reset the refreshing flags even on error
      refreshingRef.current = false;
      setRefreshingConnection(false);
      
      // Last resort - reload the page
      toast({
        title: "Connection Failed",
        description: "Please reload the page to try again.",
        variant: "destructive"
      });
    }
  };
  
  // Initialize WebRTC - extracted to separate function for reuse during reconnections
  const initializeWebRTCCall = async () => {
    if (!securityVerified || !consultation?.video_call_id) {
      return;
    }
    
    try {
      console.log(`Initializing WebRTC call with room ID: ${consultation.video_call_id}`);
      setLastConnectAttempt(new Date());
      
      // Create WebRTC call instance
      const webrtcCall = new WebRTCCall({
        roomId: consultation.video_call_id,
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
          
          // Update joined status for current user
          const userRole = localStorage.getItem('userRole');
          if (userRole === 'doctor') {
            setDoctorJoined(true);
          } else if (userRole === 'patient') {
            setPatientJoined(true);
          }
        },
        onRemoteStream: (stream) => {
          console.log('Got remote stream in component');
          
          // Safety check to prevent errors with null refs
          if (!remoteVideoRef.current) {
            console.warn('Remote video ref is null, cannot attach stream');
            return;
          }
          
          try {
            remoteVideoRef.current.srcObject = stream;
            
            // Enable autoplay for mobile devices
            remoteVideoRef.current.onloadedmetadata = () => {
              console.log('Remote video metadata loaded');
              if (remoteVideoRef.current) {
                remoteVideoRef.current.play().catch(e => {
                  console.error('Error auto-playing remote video:', e);
                  // Try again with user interaction
                  const playPromise = remoteVideoRef.current?.play();
                  if (playPromise) {
                    playPromise.catch(() => {
                      console.log('Waiting for user interaction to play video');
                    });
                  }
                });
              }
            };
            
            // Check if we have video tracks
            const videoTracks = stream.getVideoTracks();
            setHasRemoteVideo(videoTracks.length > 0 && videoTracks[0].enabled);
            
            // When we receive a remote stream, the other participant has joined
            const userRole = localStorage.getItem('userRole');
            if (userRole === 'doctor') {
              setPatientJoined(true);
            } else {
              setDoctorJoined(true);
            }
          } catch (error) {
            console.error('Error attaching remote stream:', error);
            // Don't throw - just log and continue
          }
        },
        onPeerConnected: () => {
          console.log('Peer connected');
          setCallStatus('connected');
          
          // Clear connection timer since we're now connected
          if (connectionTimerRef.current) {
            clearTimeout(connectionTimerRef.current);
            connectionTimerRef.current = null;
          }
          
          // Reset refresh-related state
          refreshingRef.current = false;
          setRefreshingConnection(false);
          setError(null);
          
          // Start timer for call duration
          if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
          }
          durationTimerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
          
          // The remote peer has definitely joined if we're connected
          const userRole = localStorage.getItem('userRole');
          if (userRole === 'doctor') {
            setPatientJoined(true);
          } else {
            setDoctorJoined(true);
          }
        },
        onPeerDisconnected: () => {
          console.log('Peer disconnected');
          setCallStatus('disconnected');
          setHasRemoteVideo(false);
          
          // Update joined status for the other participant
          const userRole = localStorage.getItem('userRole');
          if (userRole === 'doctor') {
            setPatientJoined(false);
          } else {
            setDoctorJoined(false);
          }
          
          // Stop timer
          if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
          }
        },
        onError: (error) => {
          console.error('WebRTC error:', error);
          
          // Set error state but don't break rendering
          try {
            setError(`Connection error: ${error.message || 'Unknown error'}. Attempting to recover...`);
            
            // Don't display toasts for timeout errors as they're expected with poor server connectivity
            if (!error.message?.includes('timeout')) {
              toast({
                title: "Video Call Issue",
                description: "Connection problem detected. Trying to reconnect...",
                variant: "destructive"
              });
            }
            
            // After multiple errors, try refreshing the call completely
            if (connectionAttempts < 3) {
              setConnectionAttempts(prev => prev + 1);
            } else {
              refreshConnection();
            }
          } catch (stateError) {
            console.error('Error handling WebRTC error:', stateError);
            // Last resort fallback - reload the page after multiple errors
            if (connectionAttempts >= 5) {
              toast({
                title: "Connection Failed",
                description: "Reloading page to restore connection...",
                variant: "destructive"
              });
              setTimeout(() => {
                window.location.reload();
              }, 3000);
            }
          }
        }
      });
      
      // Store reference and change status
      webrtcRef.current = webrtcCall;
      setCallStatus('connecting');
      
      // Initialize connection
      await webrtcCall.initialize();
      
      // Set a timeout to auto-refresh if connection doesn't establish in reasonable time
      if (connectionTimerRef.current) {
        clearTimeout(connectionTimerRef.current);
      }
      
      connectionTimerRef.current = setTimeout(() => {
        console.log('Connection timeout, refreshing connection...');
        refreshConnection();
      }, CONNECTION_MANAGEMENT.maxConnectionTime);
      
    } catch (error) {
      console.error('Failed to initialize WebRTC call:', error);
      setError(`Failed to start call: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Prevent UI from breaking by handling the error gracefully
      toast({
        title: "Video Call Error",
        description: "Failed to initialize call. Please try again.",
        variant: "destructive"
      });
      
      // Auto-retry after delay
      setTimeout(() => {
        console.log('Auto-retrying WebRTC initialization...');
        initializeWebRTCCall();
      }, CONNECTION_MANAGEMENT.reconnectDelay);
    }
  };
  
  // Initialize WebRTC when consultation is loaded
  useEffect(() => {
    if (!securityVerified || !consultation?.video_call_id) return;
    
    // Reset connection attempts when component mounts or consultation changes
    setConnectionAttempts(0);
    
    initializeWebRTCCall();
    
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
      
      if (connectionTimerRef.current) {
        clearTimeout(connectionTimerRef.current);
        connectionTimerRef.current = null;
      }
    };
  }, [appointmentId, consultation, securityVerified]);
  
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

  // Manual reconnect function the user can trigger if needed
  const handleManualReconnect = () => {
    console.log('User requested manual reconnection');
    refreshConnection();
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
    
    if (roomStatusIntervalRef.current) {
      clearInterval(roomStatusIntervalRef.current);
      roomStatusIntervalRef.current = null;
    }
    
    if (connectionTimerRef.current) {
      clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
    }
    
    toast({
      title: "Call Ended",
      description: "Video consultation has ended"
    });
    
    navigate('/');
  };

  // Format call duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add manual play handler for mobile browsers that block autoplay
  const handleManualPlay = () => {
    // FIXED: Check if we have streams before attempting to play
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      if (remoteVideoRef.current.paused) {
        console.log('Attempting to manually play remote video');
        remoteVideoRef.current.play().then(() => {
          setError(null);
          
          // FIXED: Check for active video tracks when manual play succeeds
          const stream = remoteVideoRef.current?.srcObject as MediaStream | null;
          if (stream) {
            const videoTracks = stream.getVideoTracks();
            setHasRemoteVideo(videoTracks.length > 0 && videoTracks.some(t => t.enabled));
          }
        }).catch(e => {
          console.error('Failed to play remote video manually:', e);
          setError('Video playback was blocked by your browser. Please check your permissions.');
        });
      }
    } else {
      console.log('Remote video element or stream not available for manual play');
    }
    
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      if (localVideoRef.current.paused) {
        console.log('Attempting to manually play local video');
        localVideoRef.current.play().catch(e => {
          console.error('Failed to play local video manually:', e);
        });
      }
    }
  };
  
  // Determine if we should show waiting state based on who has joined
  const isWaitingForParticipant = () => {
    if (currentRole === 'doctor') {
      return !patientJoined;
    } else if (currentRole === 'patient') {
      return !doctorJoined;
    }
    return true; // Default to waiting if role is unknown
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
    
    // Log room status
    console.log('Room status:', {
      roomId,
      currentRole,
      doctorJoined,
      patientJoined,
      callStatus,
      appointmentId,
      connectionAttempts,
      refreshing: refreshingRef.current,
    });
  };

  // Modify the useEffect for global error handling to be more aggressive
  useEffect(() => {
    // Global error handler for unhandled exceptions
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
      
      // Prevent the blank screen by showing error UI
      setError(`An unexpected error occurred: ${event.error?.message || 'Unknown error'}`);
      setLoading(false);
      
      // Prevent default browser error handling
      event.preventDefault();
      
      // Log additional details for debugging
      console.log('Error details:', {
        message: event.error?.message,
        stack: event.error?.stack,
        type: event.error?.name
      });
      
      // Show toast with recovery option
      toast({
        title: "Application Error",
        description: "The video call encountered a problem. Click 'Recover' to try again.",
        action: (
          <Button variant="outline" onClick={() => window.location.reload()}>
            Recover
          </Button>
        ),
        duration: 10000
      });

      // Force reload after multiple errors
      if (window.sessionStorage.getItem('errorCount')) {
        const count = parseInt(window.sessionStorage.getItem('errorCount') || '0') + 1;
        window.sessionStorage.setItem('errorCount', count.toString());
        
        if (count > 2) {
          // After 3 errors, force reload
          console.log('Multiple errors detected, forcing page reload');
          window.sessionStorage.removeItem('errorCount');
          setTimeout(() => window.location.reload(), 3000);
        }
      } else {
        window.sessionStorage.setItem('errorCount', '1');
      }
    };
    
    // Add global error handler
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      handleGlobalError(new ErrorEvent('error', { error: event.reason }));
    });
    
    // Check if the page is already in an error state on load
    // This helps recover from a blank/black screen
    const checkInitialErrorState = () => {
      const mainContent = document.querySelector('main');
      if (!mainContent || mainContent.children.length === 0) {
        console.log('Detected blank page state, attempting recovery');
        setError('Application is in an error state. Please try refreshing.');
        setLoading(false);
      }
    };
    
    // Run the check after a short delay
    const checkTimer = setTimeout(checkInitialErrorState, 3000);
    
    // Add a periodic check to detect frozen UI
    const periodicCheck = setInterval(() => {
      const now = Date.now();
      const lastUpdate = parseInt(window.sessionStorage.getItem('lastUiUpdate') || '0');
      
      // If UI hasn't updated in 10 seconds, consider it frozen
      if (lastUpdate && now - lastUpdate > 10000) {
        console.log('UI appears frozen, attempting recovery');
        window.sessionStorage.setItem('lastUiUpdate', now.toString());
        setError('Application appears to be frozen. Please try refreshing.');
      } else {
        window.sessionStorage.setItem('lastUiUpdate', now.toString());
      }
    }, 5000);
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleGlobalError as any);
      clearTimeout(checkTimer);
      clearInterval(periodicCheck);
    };
  }, [toast]);

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
    <VideoCallErrorBoundary>
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-800">Video Consultation</h1>
            <div className="flex items-center gap-2">
              <Badge variant={callStatus === 'connected' ? 'default' : callStatus === 'connecting' ? 'outline' : 'secondary'}>
                {callStatus === 'connected' ? 'Connected' : 
                 callStatus === 'connecting' ? 'Connecting...' : 
                 callStatus === 'waiting' ? 'Waiting...' : 'Disconnected'}
              </Badge>
              {callStatus === 'connected' && (
                <Badge variant="outline" className="font-mono">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(callDuration * 1000).toISOString().substr(11, 8)}
                </Badge>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-grow p-4 relative">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : error && !refreshingConnection ? (
            <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md text-center">
              <div className="text-red-500 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Connection Error</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="flex justify-center gap-4">
                <Button onClick={handleManualReconnect}>
                  Try Again
                </Button>
                <Button variant="outline" onClick={endCall}>
                  End Call
                </Button>
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
              </div>
            </div>
          ) : (
            <Suspense fallback={
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            }>
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
                    {(callStatus !== 'disconnected' && isWaitingForParticipant()) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white">
                        <div className="text-center space-y-4">
                          <h2 className="text-2xl font-bold">Waiting for {remoteUserName}</h2>
                          <p>The consultation will begin when they join</p>
                          <div className="animate-pulse mt-8">
                            <Phone className="h-16 w-16 mx-auto text-green-500" />
                          </div>
                          {connectionAttempts > 0 && (
                            <div className="text-sm text-gray-400">
                              Connection attempts: {connectionAttempts}
                            </div>
                          )}
                          {refreshingConnection && (
                            <div className="text-sm text-blue-400 animate-pulse">
                              Refreshing connection...
                            </div>
                          )}
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
                            onClick={() => navigate('/')}
                          >
                            Return to Home
                          </Button>
                          <Button 
                            variant="outline" 
                            className="mt-4"
                            onClick={handleManualReconnect}
                          >
                            Try to Reconnect
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
                    
                    {/* Participant status indicators */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {doctorJoined && (
                        <Badge variant="default" className="bg-green-600">Doctor Connected</Badge>
                      )}
                      {patientJoined && (
                        <Badge variant="default" className="bg-green-600">Patient Connected</Badge>
                      )}
                      {connectionAttempts > 0 && (
                        <Badge variant="outline" className="bg-blue-600 bg-opacity-50">Attempt #{connectionAttempts}</Badge>
                      )}
                    </div>
                    
                    {/* Error message */}
                    {error && (
                      <div className="absolute top-4 left-0 right-0 mx-auto max-w-sm bg-red-500 text-white p-2 rounded text-center">
                        {error}
                      </div>
                    )}
                    
                    {/* Manual reconnect button when there are issues but not while actively reconnecting */}
                    {error && !refreshingConnection && (
                      <div className="absolute bottom-20 left-0 right-0 mx-auto text-center">
                        <Button 
                          variant="default"
                          className="bg-blue-600"
                          onClick={handleManualReconnect}
                        >
                          Refresh Connection
                        </Button>
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
            </Suspense>
          )}
        </main>
      </div>
    </VideoCallErrorBoundary>
  );
};

export default VideoCall;
