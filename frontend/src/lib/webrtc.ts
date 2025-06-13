import axios from 'axios';
import { API_URL } from '../config';
import { io, Socket } from 'socket.io-client';

// Enhanced configuration for WebRTC peers with more reliable STUN/TURN servers
const PEER_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { 
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
      username: 'webrtc',
      credential: 'webrtc'
    },
    {
      urls: 'turn:numb.viagenie.ca:3478',
      username: 'webrtc@live.com',
      credential: 'muazkh'
    }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle' as RTCBundlePolicy,
  rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy
};

interface VideoCallOptions {
  roomId: string;
  appointmentId: string;
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onPeerConnected?: () => void;
  onPeerDisconnected?: () => void;
  onError?: (error: Error) => void;
}

interface SignalingMessage {
  timestamp: string;
  user_id: string;
  user_role: string;
  signal: any;
  target_user_id?: string;
}

class WebRTCCall {
  private roomId: string;
  private appointmentId: string;
  private peerConnection: RTCPeerConnection | null = null;
  localStream: MediaStream | null = null; // Made public for access from VideoCall component
  remoteStream: MediaStream | null = null; // Make remoteStream public as well
  private socket: Socket | null = null;
  private isInitiator: boolean = false;
  private participantId: string | null = null;
  private userId: string | null = null;
  private isConnected: boolean = false;
  private hasReceivedRemoteTrack: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Callbacks
  private onLocalStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onPeerConnectedCallback: (() => void) | null = null;
  private onPeerDisconnectedCallback: (() => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  
  constructor(options: VideoCallOptions) {
    this.roomId = options.roomId;
    this.appointmentId = options.appointmentId;
    this.onLocalStreamCallback = options.onLocalStream || null;
    this.onRemoteStreamCallback = options.onRemoteStream || null;
    this.onPeerConnectedCallback = options.onPeerConnected || null;
    this.onPeerDisconnectedCallback = options.onPeerDisconnected || null;
    this.onErrorCallback = options.onError || null;
  }
  
  /**
   * Initialize the WebRTC call and request camera/mic access
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing WebRTC call...');
      
      // Initialize Socket.IO connection
      await this.initializeSocketConnection();
      
      // FIXED: Create remote stream container first
      this.remoteStream = new MediaStream();
      
      // Request local media with explicit constraints for better quality
      try {
        console.log('Requesting media with constraints...');
        this.localStream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
            facingMode: 'user'
          }, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        // Debug log tracks
        const videoTracks = this.localStream.getVideoTracks();
        const audioTracks = this.localStream.getAudioTracks();
        console.log('Got local media stream with:', 
                   videoTracks.length, 'video tracks,', 
                   audioTracks.length, 'audio tracks');
        
        // Check if tracks are enabled
        videoTracks.forEach(track => {
          console.log('Video track:', track.id, 'enabled:', track.enabled, 'readyState:', track.readyState);
          // Ensure track is enabled
          track.enabled = true;
        });
        audioTracks.forEach(track => {
          console.log('Audio track:', track.id, 'enabled:', track.enabled, 'readyState:', track.readyState);
          // Ensure track is enabled
          track.enabled = true;
        });
      } catch (mediaError) {
        console.error('Failed to get video, trying audio only:', mediaError);
        // Fallback to audio only
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          console.log('Got audio-only local media stream');
        } catch (audioError) {
          console.error('Failed to get any media stream:', audioError);
          throw new Error('Cannot access camera or microphone');
        }
      }
      
      // FIXED: Create RTCPeerConnection AFTER getting media to avoid issues
      this.peerConnection = new RTCPeerConnection(PEER_CONFIG);
      console.log('Created peer connection with config:', PEER_CONFIG);
      
      // FIXED: Add local tracks to peer connection immediately after creating it
      if (this.localStream && this.peerConnection) {
        this.localStream.getTracks().forEach(track => {
          console.log('Adding track to peer connection:', track.kind, track.id, track.enabled);
          if (this.peerConnection && this.localStream) {
            try {
              const sender = this.peerConnection.addTrack(track, this.localStream);
              console.log('Added track to peer connection with sender:', sender.track?.id);
            } catch (e) {
              console.error('Error adding track to peer connection:', e);
            }
          }
        });
      } else {
        console.error('No local stream or peer connection available');
      }
      
      // Handle ICE candidates
      this.peerConnection.onicecandidate = event => {
        if (event.candidate) {
          console.log('Generated ICE candidate:', event.candidate);
          this.sendSignal({
            type: 'candidate',
            candidate: event.candidate
          });
        } else {
          console.log('All ICE candidates have been generated');
        }
      };
      
      // Handle ICE gathering state change
      this.peerConnection.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', this.peerConnection?.iceGatheringState);
      };
      
      // Handle ICE connection state changes
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
        
        if (this.peerConnection?.iceConnectionState === 'connected' || 
            this.peerConnection?.iceConnectionState === 'completed') {
          if (!this.isConnected) {
            console.log('ICE connection established');
            this.isConnected = true;
            this.onPeerConnectedCallback?.();
            
            // Force-check if we have remote tracks now
            if (this.remoteStream && this.remoteStream.getTracks().length > 0) {
              console.log('We have remote tracks after connection!');
              this.hasReceivedRemoteTrack = true;
              if (this.onRemoteStreamCallback) {
                this.onRemoteStreamCallback(this.remoteStream);
              }
            } else {
              console.log('No remote tracks yet after connection');
            }
          }
        } else if (this.peerConnection?.iceConnectionState === 'disconnected') {
          console.log('ICE connection disconnected, may recover...');
          // Wait to see if it recovers before notifying disconnect
          setTimeout(() => {
            if (this.peerConnection?.iceConnectionState === 'disconnected') {
              this.tryReconnect();
            }
          }, 5000);
        } else if (this.peerConnection?.iceConnectionState === 'failed' || 
                   this.peerConnection?.iceConnectionState === 'closed') {
          console.log('ICE connection failed or closed');
          if (this.isConnected) {
            this.isConnected = false;
            this.onPeerDisconnectedCallback?.();
            this.tryReconnect();
          }
        }
      };
      
      // Listen for connection state changes too
      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection?.connectionState);
        if (this.peerConnection?.connectionState === 'connected') {
          console.log('Peer connection fully established');
        }
      };
      
      // Monitor signaling state
      this.peerConnection.onsignalingstatechange = () => {
        console.log('Signaling state:', this.peerConnection?.signalingState);
      };
      
      // Handle remote tracks - CRITICAL FIX HERE
      this.peerConnection.ontrack = event => {
        console.log('Received remote track:', event.track.kind, event.track.id, event.track.enabled, 'readyState:', event.track.readyState);
        this.hasReceivedRemoteTrack = true;
        
        // Ensure the track is enabled
        event.track.enabled = true;
        
        // Add track to remote stream
        if (!this.remoteStream) {
          // If somehow remoteStream is null, create a new one
          this.remoteStream = new MediaStream();
        }

        // FIXED: Always use event.streams[0] if available, this is critical for proper stream handling
        if (event.streams && event.streams.length > 0) {
          console.log('Using event stream directly, has tracks:', event.streams[0].getTracks().length);
          
          // Debug log event stream tracks
          event.streams[0].getTracks().forEach(track => {
            console.log('Event stream track:', track.kind, track.id, 'enabled:', track.enabled, 'readyState:', track.readyState);
            // Make sure the track is enabled
            track.enabled = true;
          });
          
          // FIXED: Replace remoteStream with the one from the event to maintain synchronization
          this.remoteStream = event.streams[0];
        } else {
          // Fallback: manually add track if event.streams is not available
          console.log('No event streams, manually adding track to remote stream');
          this.remoteStream.addTrack(event.track);
        }
        
        // Debug log remote stream
        console.log('Remote stream now has tracks:', 
                   this.remoteStream.getVideoTracks().length, 'video,', 
                   this.remoteStream.getAudioTracks().length, 'audio');
        
        // FIXED: Always notify about the remote stream when we get a track
        if (this.onRemoteStreamCallback) {
          console.log('Calling onRemoteStream callback with stream:', this.remoteStream.id);
          this.onRemoteStreamCallback(this.remoteStream);
        }
        
        // Ensure we mark as connected when we get tracks
        if (!this.isConnected) {
          console.log('Track received, marking as connected');
          this.isConnected = true;
          this.onPeerConnectedCallback?.();
        }
      };
      
      // Share the local stream with the component
      if (this.localStream && this.onLocalStreamCallback) {
        console.log('Calling onLocalStream callback with stream:', this.localStream.id);
        this.onLocalStreamCallback(this.localStream);
      }
      
      // Join the WebRTC room using WebSockets
      await this.joinRoom();
      
      // Wait to see if we need to initiate the call
      // When a second participant joins, we'll get a user_joined event
      setTimeout(() => {
        if (!this.isConnected && this.peerConnection) {
          console.log('No connection yet, creating offer...');
          this.createAndSendOffer();
        }
      }, 2000);
      
    } catch (error) {
      console.error('Error initializing WebRTC call:', error);
      this.onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
  
  /**
   * Initialize Socket.IO connection
   */
  private async initializeSocketConnection(): Promise<void> {
    try {
      // Create Socket.IO connection to the WebSocket server
      // Use your deployed backend URL
      const apiUrl = API_URL;
      
      // For better compatibility with Render.com and other hosting providers
      console.log('Connecting to WebSocket server:', apiUrl);
      
      // FIXED: Use both websocket and polling transports for better reliability
      this.socket = io(apiUrl, {
        transports: ['websocket', 'polling'],  // Allow fallback to long polling if websocket fails
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: true,
        timeout: 20000,  // Increased timeout for slow connections
      });
      
      // Wait for socket to connect with better error handling
      await new Promise<void>((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Socket not initialized'));
          return;
        }
        
        // Set a timeout first to ensure we don't wait forever
        const timeoutId = setTimeout(() => {
          console.error('WebSocket connection timeout - using HTTP fallback');
          // Instead of rejecting, we'll continue and use HTTP fallbacks
          resolve();
        }, 10000);
        
        // Handle connection
        this.socket.on('connect', () => {
          console.log('WebSocket connected successfully');
          clearTimeout(timeoutId);  // Clear the timeout since we connected
          resolve();
        });
        
        // Handle connection error
        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          // Don't reject, let the timeout handle it
          // We'll continue and use HTTP fallbacks if needed
        });
      });
      
      // Authenticate with the WebSocket server
      // Only if we actually have a socket connection
      if (this.socket.connected) {
        await this.authenticateSocket();
        
        // Setup signal handlers
        this.setupSignalHandlers();
      } else {
        console.warn('WebSocket not connected - will use HTTP fallback for signaling');
        // We'll implement HTTP-based signaling as a fallback
        this._setupHttpSignalingFallback();
      }
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
      
      // Instead of throwing, use HTTP fallback
      console.warn('Switching to HTTP fallback for signaling');
      this._setupHttpSignalingFallback();
    }
  }
  
  /**
   * Authenticate with the WebSocket server
   */
  private async authenticateSocket(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      if (!this.socket) {
        throw new Error('Socket not initialized');
      }
      
      // Send authentication message
      return new Promise<void>((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Socket not initialized'));
          return;
        }
        
        this.socket.emit('authenticate', { token });
        
        // Listen for authentication response
        this.socket.once('authenticated', (data) => {
          console.log('WebSocket authenticated:', data);
          this.userId = data.user_id;
          resolve();
        });
        
        // Handle authentication error
        this.socket.once('auth_error', (error) => {
          console.error('WebSocket authentication error:', error);
          reject(new Error(error.error || 'Authentication failed'));
        });
        
        // Set a timeout
        setTimeout(() => {
          reject(new Error('Authentication timeout'));
        }, 5000);
      });
    } catch (error) {
      console.error('Socket authentication error:', error);
      throw error;
    }
  }
  
  /**
   * Setup WebSocket signal handlers
   */
  private setupSignalHandlers(): void {
    if (!this.socket) return;
    
    // Handle WebRTC signaling messages
    this.socket.on('webrtc_signal', async (data) => {
      console.log('Received WebRTC signal:', data.signal.type);
      
      // Skip messages from ourselves
      if (data.from_user_id === this.userId) return;
      
      try {
        await this.handleSignalingMessage(data);
      } catch (error) {
        console.error('Error handling signaling message:', error);
      }
    });
    
    // Handle user joined event
    this.socket.on('user_joined', (data) => {
      console.log('User joined room:', data);
      
      // Create offer when another user joins
      if (data.user_id !== this.userId && this.peerConnection) {
        console.log('Creating offer for new participant');
        this.createAndSendOffer();
      }
    });
    
    // Handle user left event
    this.socket.on('user_left', (data) => {
      console.log('User left room:', data);
      if (this.isConnected) {
        this.isConnected = false;
        this.onPeerDisconnectedCallback?.();
      }
    });
    
    // Handle room errors
    this.socket.on('room_error', (error) => {
      console.error('Room error:', error);
      this.onErrorCallback?.(new Error(error.error || 'Room error'));
    });
    
    // Handle signal errors
    this.socket.on('signal_error', (error) => {
      console.error('Signal error:', error);
    });
    
    // Handle disconnection
    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      
      // Try to reconnect
      setTimeout(() => {
        if (this.socket) {
          console.log('Attempting to reconnect WebSocket...');
          this.socket.connect();
        }
      }, 1000);
    });
  }
  
  /**
   * Join a WebRTC room using WebSockets or HTTP fallback
   */
  private async joinRoom(): Promise<void> {
    try {
      // Check if socket is connected
      if (this.socket && this.socket.connected) {
        // Join using WebSockets
        console.log(`Attempting to join room via WebSocket: ${this.roomId}`);
        
        return new Promise<void>((resolve, reject) => {
          if (!this.socket) {
            // Fall back to HTTP if socket is not available
            this._joinRoomViaHttp().then(resolve).catch(reject);
            return;
          }
          
          // FIXED: Add better error handling and logging for room joining
          console.log(`Emitting join_room event for room: ${this.roomId}`);
          
          this.socket.emit('join_room', {
            room_id: this.roomId,
            appointment_id: this.appointmentId
          });
          
          // Listen for join response
          this.socket.once('room_joined', (data) => {
            console.log('Joined WebRTC room via WebSocket:', data);
            resolve();
          });
          
          // Handle room error
          this.socket.once('room_error', (error) => {
            console.error('Error joining room via WebSocket:', error);
            
            // Try HTTP fallback instead of rejecting
            console.log('Attempting HTTP fallback for room join');
            this._joinRoomViaHttp().then(resolve).catch(reject);
          });
          
          // Set a timeout - if no response, try HTTP
          setTimeout(() => {
            console.log('Room join via WebSocket timed out, trying HTTP fallback');
            this._joinRoomViaHttp().then(resolve).catch(reject);
          }, 8000); // Shorter timeout before falling back
        });
      } else {
        // Join using HTTP fallback
        return this._joinRoomViaHttp();
      }
    } catch (error) {
      console.error('Error joining WebRTC room:', error);
      
      // Try HTTP fallback instead of throwing
      try {
        await this._joinRoomViaHttp();
      } catch (httpError) {
        console.error('HTTP fallback also failed:', httpError);
        this.onErrorCallback?.(new Error('Failed to join the video call room'));
        throw httpError;
      }
    }
  }

  /**
   * Join a room using HTTP API as fallback
   */
  private async _joinRoomViaHttp(): Promise<void> {
    try {
      console.log(`Joining room via HTTP fallback: ${this.roomId}`);
      
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      
      await axios.post(
        `${API_URL}/api/webrtc/rooms/${this.roomId}/join`, 
        { appointment_id: this.appointmentId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Successfully joined room via HTTP');
      return;
    } catch (error) {
      console.error('Error joining room via HTTP:', error);
      throw error;
    }
  }
  
  /**
   * Attempt to reconnect the call
   */
  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached, giving up');
      this.onPeerDisconnectedCallback?.();
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    // Clear previous timeout if any
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Try to reconnect after short delay
    this.reconnectTimeout = setTimeout(async () => {
      if (!this.isConnected && this.peerConnection) {
        try {
          console.log('Creating new offer to reconnect');
          await this.createAndSendOffer();
        } catch (error) {
          console.error('Reconnect attempt failed:', error);
        }
      }
    }, 2000);
  }
  
  /**
   * Create and send an offer to remote peer
   */
  private async createAndSendOffer(): Promise<void> {
    try {
      if (!this.peerConnection) return;
      
      // FIXED: Create offer with proper options for cross-browser compatibility
      // Use a variable to hold options based on browser support
      let offerOptions: any = {
        iceRestart: true // Important for reconnection
      };
      
      // Add legacy options for older browsers if createOffer supports them
      // These properties are deprecated but still needed in some browsers
      try {
        offerOptions = {
          ...offerOptions,
          offerToReceiveAudio: true, 
          offerToReceiveVideo: true
        };
      } catch (e) {
        console.log('Browser does not support legacy offer options, using standard options');
      }
      
      console.log('Creating offer with options:', offerOptions);
      const offer = await this.peerConnection.createOffer(offerOptions);
      
      console.log('Created offer:', offer);
      
      // Set local description
      await this.peerConnection.setLocalDescription(offer);
      console.log('Set local description from offer');
      
      // Wait a bit to ensure ICE candidates are gathered
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send offer through WebSocket
      this.sendSignal({
        type: 'offer',
        sdp: this.peerConnection.localDescription
      });
      console.log('Sent offer via WebSocket');
      
    } catch (error) {
      console.error('Error creating offer:', error);
      this.onErrorCallback?.(new Error('Failed to create connection offer'));
    }
  }
  
  /**
   * Handle an incoming signaling message
   */
  private async handleSignalingMessage(message: any): Promise<void> {
    try {
      if (!this.peerConnection) return;
      
      const signal = message.signal;
      console.log('Handling signal type:', signal.type);
      
      // FIXED: Handle signaling with better error handling and state management
      if (signal.type === 'offer') {
        console.log('Received offer from remote peer');
        
        // Check if we can set the remote description in current state
        const signalingState = this.peerConnection.signalingState;
        console.log('Current signaling state before processing offer:', signalingState);
        
        try {
          // If we're not in stable state, reset the connection
          if (signalingState !== 'stable') {
            console.log('Resetting connection before processing offer...');
            await this.peerConnection.setLocalDescription({type: 'rollback'} as RTCSessionDescriptionInit);
          }
          
          // Set remote description from offer
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          console.log('Set remote description from offer');
          
          // Create and send answer
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          console.log('Created and set local description from answer');
          
          this.sendSignal({
            type: 'answer',
            sdp: this.peerConnection.localDescription
          });
          console.log('Sent answer via WebSocket');
        } catch (e) {
          console.error('Error handling offer:', e);
          // Try to recover by restarting ICE
          this.tryReconnect();
        }
        
      } else if (signal.type === 'answer') {
        console.log('Received answer from remote peer');
        
        try {
          // Check if we can set the remote description in current state
          const signalingState = this.peerConnection.signalingState;
          console.log('Current signaling state before processing answer:', signalingState);
          
          // Only process answer if we're in have-local-offer state
          if (signalingState === 'have-local-offer') {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            console.log('Set remote description from answer');
          } else {
            console.log('Ignoring answer - peer connection not in have-local-offer state');
          }
        } catch (e) {
          console.error('Error handling answer:', e);
          this.tryReconnect();
        }
        
      } else if (signal.type === 'candidate') {
        console.log('Received ICE candidate from remote peer');
        
        try {
          // Only add ice candidate if remote description has been set
          if (this.peerConnection.remoteDescription) {
            if (signal.candidate) {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
              console.log('Added ICE candidate');
            }
          } else {
            console.log('Ignoring ICE candidate - no remote description set yet');
          }
        } catch (e) {
          console.error('Error handling ICE candidate:', e);
        }
      } else {
        console.warn('Unknown signal type:', signal.type);
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  }
  
  /**
   * Send a signaling message through WebSocket
   */
  private sendSignal(signal: any, targetId?: string): void {
    try {
      // If socket is connected, use it
      if (this.socket && this.socket.connected) {
        // Send signal to WebSocket server
        this.socket.emit('webrtc_signal', {
          room_id: this.roomId,
          signal: signal,
          target_id: targetId
        });
        console.log('Sent signal via WebSocket:', signal.type);
      } else {
        // Fall back to HTTP signaling if WebSocket is not available
        console.log('Using HTTP fallback for signal:', signal.type);
        
        // Add target ID if provided
        if (targetId) {
          signal.target_id = targetId;
        }
        
        // Send using HTTP
        this._sendHttpSignal(signal);
      }
    } catch (error) {
      console.error('Error sending signal:', error);
    }
  }
  
  /**
   * Toggle video tracks
   */
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        console.log(`Setting video track ${track.id} enabled:`, enabled);
        track.enabled = enabled;
      });
      
      // Notify peers that our video state has changed (optional)
      this.sendSignal({
        type: 'video-state',
        enabled: enabled
      });
    }
  }
  
  /**
   * Toggle audio tracks
   */
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        console.log(`Setting audio track ${track.id} enabled:`, enabled);
        track.enabled = enabled;
      });
      
      // Notify peers that our audio state has changed (optional)
      this.sendSignal({
        type: 'audio-state',
        enabled: enabled
      });
    }
  }
  
  /**
   * End the call
   */
  async endCall(): Promise<void> {
    console.log('Ending WebRTC call');
    
    // Leave the WebSocket room
    if (this.socket) {
      this.socket.emit('leave_room', { room_id: this.roomId });
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.onsignalingstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Stop all local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }
    
    // Clear remote stream
    this.remoteStream = null;
    
    // Reset state
    this.isConnected = false;
    this.hasReceivedRemoteTrack = false;
    this.isInitiator = false;
    this.reconnectAttempts = 0;
    
    try {
      // Notify server that we've left
      const token = localStorage.getItem('token');
      if (token) {
        await axios.post(`${API_URL}/api/webrtc/rooms/${this.roomId}/leave`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Left WebRTC room');
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }
  
  /**
   * Set up HTTP-based signaling as a fallback when WebSockets fail
   * This allows the app to work even when WebSockets are blocked or failing
   */
  private _setupHttpSignalingFallback(): void {
    console.log('Setting up HTTP signaling fallback');
    
    // Start polling for messages
    this._startHttpSignalingPolling();
  }
  
  /**
   * Start polling for signaling messages using HTTP
   */
  private _startHttpSignalingPolling(): void {
    // Poll for new messages every few seconds
    const pollInterval = setInterval(async () => {
      if (!this.isConnected) {
        // Stop polling if we disconnect
        clearInterval(pollInterval);
        return;
      }
      
      try {
        // Send a keep-alive signal
        await this._sendHttpSignal({
          type: 'keepalive',
          roomId: this.roomId,
          timestamp: Date.now()
        });
        
        // Poll for new messages
        const messages = await this._pollHttpSignals();
        
        // Process any new messages
        for (const message of messages) {
          await this.handleSignalingMessage(message);
        }
      } catch (err) {
        console.warn('HTTP signaling poll error:', err);
      }
    }, 2000);
  }
  
  /**
   * Send a signaling message using HTTP
   */
  private async _sendHttpSignal(signal: any): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      await axios.post(`${API_URL}/api/webrtc/rooms/${this.roomId}/signal`, {
        signal: signal,
        target_id: signal.target_id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('HTTP signal send error:', err);
    }
  }
  
  /**
   * Poll for new signaling messages using HTTP
   */
  private async _pollHttpSignals(): Promise<any[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return [];
      
      const lastPoll = this._lastPollTime || Date.now() - 5000;
      this._lastPollTime = Date.now();
      
      const response = await axios.get(
        `${API_URL}/api/webrtc/rooms/${this.roomId}/messages?since=${lastPoll}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return response.data.messages || [];
    } catch (err) {
      console.error('HTTP signal poll error:', err);
      return [];
    }
  }
  
  // Track last poll time
  private _lastPollTime: number = 0;
}

export default WebRTCCall; 