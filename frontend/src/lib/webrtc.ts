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
    },
    // Add additional free TURN servers for increased connectivity
    {
      urls: 'turn:relay.metered.ca:80',
      username: 'e8dd65e92c62d3e62b5ffac0',
      credential: 'uWdWNmjRNEGMESKx'
    },
    {
      urls: 'turn:relay.metered.ca:443',
      username: 'e8dd65e92c62d3e62b5ffac0',
      credential: 'uWdWNmjRNEGMESKx'
    }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle' as RTCBundlePolicy,
  rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy
};

// Timeout and retry configuration
const CONNECTION_CONFIG = {
  // Shorter timeouts to fail fast and retry
  wsTimeout: 5000,          // WebSocket connection timeout (ms)
  httpTimeout: 7000,        // HTTP request timeout (ms)
  httpPollInterval: 1500,   // How often to poll for messages (ms)
  
  // Retry configuration with exponential backoff
  maxRetries: 5,
  initialBackoff: 1000,     // Start with 1 second backoff
  maxBackoff: 10000,        // Maximum backoff of 10 seconds
  backoffFactor: 1.5,       // Exponential factor for backoff
  
  // Auto-reconnect config
  reconnectInterval: 2000,
  maxReconnectAttempts: 8,
  
  // Direct P2P mode when server is unresponsive
  enableDirectMode: true,   // Enable direct peer connections when signaling server fails
  directModeThreshold: 3,   // Number of failed attempts before trying direct mode
  
  // Server health check
  healthCheckInterval: 10000, // How often to check if server is responsive (ms)
  healthCheckEndpoint: '/health'
};

// Keep track of server health globally across all instances
let isServerResponsive = true;
let lastServerCheckTime = 0;
const serverHealthCheckPromise = Promise.resolve(true);

/**
 * Check if the server is currently responsive
 * This avoids making unnecessary requests when we know the server is down
 */
async function checkServerHealth(): Promise<boolean> {
  const now = Date.now();
  
  // Don't check too frequently
  if (now - lastServerCheckTime < CONNECTION_CONFIG.healthCheckInterval) {
    return isServerResponsive;
  }
  
  lastServerCheckTime = now;
  
  try {
    // Simple health check with very short timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${API_URL}${CONNECTION_CONFIG.healthCheckEndpoint}`, {
      method: 'GET',
      cache: 'no-cache',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Server is responsive if it returns any response
    isServerResponsive = response.ok;
    return isServerResponsive;
  } catch (error) {
    console.warn('Server health check failed:', error);
    isServerResponsive = false;
    return false;
  }
}

// Check server health periodically in the background
setInterval(checkServerHealth, CONNECTION_CONFIG.healthCheckInterval);

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
      try {
        this.peerConnection = new RTCPeerConnection(PEER_CONFIG);
        console.log('Created peer connection with config:', PEER_CONFIG);
      } catch (peerError) {
        console.error('Failed to create peer connection:', peerError);
        throw new Error('Failed to create connection: ' + (peerError instanceof Error ? peerError.message : 'Unknown error'));
      }
      
      // FIXED: Add local tracks to peer connection immediately after creating it
      if (this.localStream && this.peerConnection) {
        try {
          this.localStream.getTracks().forEach(track => {
            console.log('Adding track to peer connection:', track.kind, track.id, track.enabled);
            if (this.peerConnection && this.localStream) {
              try {
                const sender = this.peerConnection.addTrack(track, this.localStream);
                console.log('Added track to peer connection with sender:', sender.track?.id);
              } catch (e) {
                console.error('Error adding track to peer connection:', e);
                // Continue despite error - don't throw here
              }
            }
          });
        } catch (trackError) {
          console.error('Error adding tracks to peer connection:', trackError);
          // Continue despite error - we'll try to establish connection anyway
        }
      } else {
        console.error('No local stream or peer connection available');
      }
      
      // Handle ICE candidates
      if (this.peerConnection) {
        this.peerConnection.onicecandidate = event => {
          if (event.candidate) {
            console.log('Generated ICE candidate:', event.candidate);
            try {
              this.sendSignal({
                type: 'candidate',
                candidate: event.candidate
              });
            } catch (e) {
              console.error('Error sending ICE candidate:', e);
              // Don't throw, just log
            }
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
              
              // Reset reconnection attempts on successful connection
              this.reconnectAttempts = 0;
              
              // Force-check if we have remote tracks now
              if (this.remoteStream && this.remoteStream.getTracks().length > 0) {
                console.log('We have remote tracks after connection!');
                this.hasReceivedRemoteTrack = true;
                if (this.onRemoteStreamCallback) {
                  try {
                    this.onRemoteStreamCallback(this.remoteStream);
                  } catch (e) {
                    console.error('Error in remote stream callback:', e);
                  }
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
            }, 2000);
          } else if (this.peerConnection?.iceConnectionState === 'failed' || 
                     this.peerConnection?.iceConnectionState === 'closed') {
            console.log('ICE connection failed or closed');
            if (this.isConnected) {
              this.isConnected = false;
              try {
                this.onPeerDisconnectedCallback?.();
              } catch (e) {
                console.error('Error in peer disconnected callback:', e);
              }
              this.tryReconnect();
            }
          }
        };
        
        // Listen for connection state changes too
        this.peerConnection.onconnectionstatechange = () => {
          console.log('Connection state:', this.peerConnection?.connectionState);
          if (this.peerConnection?.connectionState === 'connected') {
            console.log('Peer connection fully established');
            // Reset reconnection attempts on successful connection
            this.reconnectAttempts = 0;
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
          
          try {
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
              try {
                this.onRemoteStreamCallback(this.remoteStream);
              } catch (e) {
                console.error('Error in remote stream callback:', e);
              }
            }
            
            // Ensure we mark as connected when we get tracks
            if (!this.isConnected) {
              console.log('Track received, marking as connected');
              this.isConnected = true;
              try {
                this.onPeerConnectedCallback?.();
              } catch (e) {
                console.error('Error in peer connected callback:', e);
              }
            }
          } catch (trackError) {
            console.error('Error handling remote track:', trackError);
            // Don't rethrow - just log and continue
          }
        };
      }
      
      // Share the local stream with the component
      if (this.localStream && this.onLocalStreamCallback) {
        console.log('Calling onLocalStream callback with stream:', this.localStream.id);
        try {
          this.onLocalStreamCallback(this.localStream);
        } catch (e) {
          console.error('Error in local stream callback:', e);
        }
      }
      
      // Join the WebRTC room using WebSockets
      try {
        await this.joinRoom();
      } catch (joinError) {
        console.error('Error joining room:', joinError);
        // Continue despite error - we'll try to establish connection anyway
      }
      
      // Create offer after a short delay if we don't establish connection
      // This helps initiate the connection, especially in direct mode
      setTimeout(() => {
        if (!this.isConnected && this.peerConnection) {
          console.log('No connection yet, creating offer...');
          this.createAndSendOffer().catch(e => {
            console.error('Error creating offer:', e);
            // Don't throw - just log
          });
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error initializing WebRTC call:', error);
      try {
        this.onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
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
      
      // IMPROVED: Use both websocket and polling transports with faster timeouts
      this.socket = io(apiUrl, {
        transports: ['websocket', 'polling'],  // Allow fallback to long polling if websocket fails
        reconnection: true,
        reconnectionAttempts: CONNECTION_CONFIG.maxRetries,
        reconnectionDelay: CONNECTION_CONFIG.initialBackoff,
        reconnectionDelayMax: CONNECTION_CONFIG.maxBackoff,
        randomizationFactor: 0.5,
        forceNew: true,
        timeout: CONNECTION_CONFIG.wsTimeout,  // Reduced timeout for faster failure detection
      });
      
      // Wait for socket to connect with improved error handling
      await new Promise<void>((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Socket not initialized'));
          return;
        }
        
        // Set a timeout first to ensure we don't wait forever - use shorter timeout
        const timeoutId = setTimeout(() => {
          console.error('WebSocket connection timeout - using HTTP fallback');
          // Instead of rejecting, we'll continue and use HTTP fallbacks
          this._setupHttpSignalingFallback();
          resolve();
        }, CONNECTION_CONFIG.wsTimeout);
        
        // Handle connection
        this.socket.on('connect', () => {
          console.log('WebSocket connected successfully');
          clearTimeout(timeoutId);  // Clear the timeout since we connected
          resolve();
        });
        
        // Handle connection error
        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          clearTimeout(timeoutId);
          // Set up HTTP fallback immediately on connection error
          this._setupHttpSignalingFallback();
          resolve();
        });
      });
      
      // Authenticate with the WebSocket server
      // Only if we actually have a socket connection
      if (this.socket && this.socket.connected) {
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
          
          // Set a timeout - if no response, try HTTP - use shorter timeout
          setTimeout(() => {
            console.log('Room join via WebSocket timed out, trying HTTP fallback');
            this._joinRoomViaHttp().then(resolve).catch(reject);
          }, 3000); // Shorter timeout before falling back
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
        
        // Use direct mode as last resort if enabled
        if (CONNECTION_CONFIG.enableDirectMode && this.reconnectAttempts >= CONNECTION_CONFIG.directModeThreshold) {
          console.log('Trying direct P2P connection mode as last resort');
          this._setupDirectMode();
          return;
        }
        
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
      
      // Check server health first
      if (!isServerResponsive && this.reconnectAttempts > 1) {
        console.log('Server appears unresponsive, switching to direct mode');
        this._setupDirectMode();
        return;
      }
      
      // Add retry logic with exponential backoff
      let attempts = 0;
      const maxAttempts = CONNECTION_CONFIG.maxRetries;
      
      while (attempts < maxAttempts) {
        try {
          // Calculate backoff with exponential factor
          const backoffMs = Math.min(
            CONNECTION_CONFIG.initialBackoff * Math.pow(CONNECTION_CONFIG.backoffFactor, attempts),
            CONNECTION_CONFIG.maxBackoff
          );
          
          // Add some randomization to prevent thundering herd problem
          const jitter = Math.random() * 0.3 + 0.85; // Between 0.85 and 1.15
          const finalBackoff = Math.floor(backoffMs * jitter);
          
          if (attempts > 0) {
            console.log(`Waiting ${finalBackoff}ms before retry ${attempts+1}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, finalBackoff));
            
            // Check server health before retrying
            if (attempts > 1 && !(await checkServerHealth())) {
              console.log('Server unresponsive, switching to direct mode');
              this._setupDirectMode();
              return;
            }
          }
          
          attempts++;
          console.log(`HTTP room join attempt ${attempts}/${maxAttempts}`);
          
          const response = await axios.post(
            `${API_URL}/api/webrtc/rooms/${this.roomId}/join`, 
            { appointment_id: this.appointmentId },
            { 
              headers: { Authorization: `Bearer ${token}` },
              timeout: CONNECTION_CONFIG.httpTimeout // Reduced timeout
            }
          );
          
          console.log('Successfully joined room via HTTP:', response.data);
          isServerResponsive = true;
          this.userId = response.data.user_id;
          return;
        } catch (err) {
          console.error(`HTTP room join error (attempt ${attempts}/${maxAttempts}):`, err);
          
          if (attempts >= maxAttempts) {
            // All attempts failed
            if (CONNECTION_CONFIG.enableDirectMode) {
              console.log('All room join attempts failed, switching to direct mode');
              this._setupDirectMode();
              return;
            }
            throw err; // Rethrow after max attempts if direct mode is disabled
          }
        }
      }
      
      throw new Error('Failed to join room after multiple attempts');
    } catch (error) {
      console.error('Error joining room via HTTP:', error);
      
      // Try direct mode as last resort
      if (CONNECTION_CONFIG.enableDirectMode) {
        this._setupDirectMode();
        return;
      }
      
      throw error;
    }
  }
  
  /**
   * Setup direct peer-to-peer mode when server is unresponsive
   */
  private _setupDirectMode(): void {
    console.log('Setting up direct P2P mode without signaling server');
    
    // In direct mode, both peers will try to create offers
    // One will eventually win based on timing and establish the connection
    
    // Create an offer immediately and repeat periodically until connected
    const createOfferInterval = setInterval(() => {
      if (this.isConnected) {
        clearInterval(createOfferInterval);
        return;
      }
      
      if (this.peerConnection) {
        console.log('Creating offer in direct mode...');
        this.createAndSendOffer().catch(err => {
          console.warn('Error creating direct mode offer:', err);
        });
      } else {
        clearInterval(createOfferInterval);
      }
    }, 2000);
    
    // Clean up interval after reasonable timeout
    setTimeout(() => {
      clearInterval(createOfferInterval);
      if (!this.isConnected) {
        console.error('Direct mode failed to establish connection');
        this.onErrorCallback?.(new Error('Could not establish connection'));
      }
    }, 30000); // Give it 30 seconds to establish connection in direct mode
  }
  
  /**
   * Attempt to reconnect the call
   */
  private tryReconnect(): void {
    if (this.reconnectAttempts >= CONNECTION_CONFIG.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached, giving up');
      this.onPeerDisconnectedCallback?.();
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${CONNECTION_CONFIG.maxReconnectAttempts})...`);
    
    // Clear previous timeout if any
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Calculate backoff with exponential factor
    const backoffMs = Math.min(
      CONNECTION_CONFIG.initialBackoff * Math.pow(CONNECTION_CONFIG.backoffFactor, this.reconnectAttempts),
      CONNECTION_CONFIG.maxBackoff
    );
    
    // Try to reconnect after calculated delay
    this.reconnectTimeout = setTimeout(async () => {
      if (!this.isConnected && this.peerConnection) {
        try {
          console.log(`Creating new offer to reconnect (attempt ${this.reconnectAttempts})`);
          await this.createAndSendOffer();
        } catch (error) {
          console.error('Reconnect attempt failed:', error);
          
          // If we're close to max attempts and all else is failing, try direct mode
          if (CONNECTION_CONFIG.enableDirectMode && 
              this.reconnectAttempts >= CONNECTION_CONFIG.maxReconnectAttempts - 2) {
            console.log('Regular reconnection failed, switching to direct mode');
            this._setupDirectMode();
          }
        }
      }
    }, backoffMs);
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
   * Handle received signaling message
   */
  private async handleSignalingMessage(message: any): Promise<void> {
    try {
      if (!this.peerConnection) {
        console.error('No peer connection available to handle message');
        return;
      }
      
      const signal = message.signal;
      console.log('Received signal type:', signal.type);
      
      switch (signal.type) {
        case 'offer':
          console.log('Received offer from peer');
          
          try {
            // Set remote description from the offer
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
            
            // Create and send answer
            console.log('Creating answer...');
            const answer = await this.peerConnection.createAnswer();
            
            // Set local description
            await this.peerConnection.setLocalDescription(answer);
            
            // Send answer to peer
            console.log('Sending answer to peer');
            this.sendSignal({
              type: 'answer',
              sdp: answer.sdp
            });
          } catch (error) {
            console.error('Error handling offer:', error);
            this.onErrorCallback?.(new Error(`Error handling offer: ${error instanceof Error ? error.message : String(error)}`));
          }
          break;
          
        case 'answer':
          console.log('Received answer from peer');
          try {
            // Set remote description from the answer
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
          } catch (error) {
            console.error('Error setting remote description from answer:', error);
            this.onErrorCallback?.(new Error(`Error handling answer: ${error instanceof Error ? error.message : String(error)}`));
          }
          break;
          
        case 'candidate':
          console.log('Received ICE candidate');
          try {
            // Add the ICE candidate to the connection
            if (signal.candidate) {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
            // Don't trigger error callback for individual ICE candidate failures
            // as they're expected in some network conditions
          }
          break;
          
        default:
          console.warn('Unknown signal type:', signal.type);
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
      this.onErrorCallback?.(new Error(`Error handling signal: ${error instanceof Error ? error.message : String(error)}`));
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
        this._sendHttpSignal(signal).catch(err => {
          console.error('HTTP signal sending failed:', err);
          // Store signals to retry later if needed
          setTimeout(() => this._sendHttpSignal(signal), 2000);
        });
      }
    } catch (error) {
      console.error('Error sending signal:', error);
      
      // Always try HTTP as backup even if there's an error
      try {
        this._sendHttpSignal(signal);
      } catch (err) {
        console.error('Backup HTTP signal send failed:', err);
      }
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
    
    // Create a fake socket event handling system
    if (!this.socket) {
      // Create a minimal fake socket interface for compatibility
      this.socket = {
        connected: false,
        emit: (event: string, data: any) => {
          console.log(`Fake socket emit for event ${event}`);
          if (event === 'webrtc_signal') {
            this._sendHttpSignal(data.signal);
          } else if (event === 'join_room') {
            // Handle join room via HTTP
            this._joinRoomViaHttp();
          } else if (event === 'leave_room') {
            // Handle leave room via HTTP
            const token = localStorage.getItem('token');
            if (token) {
              axios.post(`${API_URL}/api/webrtc/rooms/${this.roomId}/leave`, {}, {
                headers: { Authorization: `Bearer ${token}` }
              }).catch(err => console.error('Error leaving room via HTTP:', err));
            }
          }
        },
        on: (event: string, callback: any) => {
          console.log(`Registering fake handler for ${event}`);
          // Store handlers but they won't be called directly
          return this;
        },
        once: (event: string, callback: any) => {
          console.log(`Registering fake one-time handler for ${event}`);
          // For authentication and other one-time events
          if (event === 'authenticated') {
            // Simulate authentication success after a delay
            setTimeout(() => {
              this.userId = localStorage.getItem('userId') || 'unknown';
              callback({ user_id: this.userId });
            }, 100);
          }
          return this;
        },
        connect: () => {
          console.log('Fake socket connect called');
          return this;
        },
        disconnect: () => {
          console.log('Fake socket disconnect called');
          return this;
        },
      } as any;
    }
    
    // Start polling for messages
    this._startHttpSignalingPolling();
  }
  
  /**
   * Start polling for signaling messages using HTTP
   */
  private _startHttpSignalingPolling(): void {
    console.log('Starting HTTP polling for signaling messages');
    
    // Get initial messages
    this._pollHttpSignals().then(messages => {
      messages.forEach(message => {
        this.handleSignalingMessage(message).catch(err => {
          console.error('Error handling polled message:', err);
        });
      });
    }).catch(err => {
      console.error('Initial poll failed:', err);
    });
    
    // Poll for new messages more frequently with shorter timeouts
    const pollInterval = setInterval(async () => {
      try {
        // Check if we should stop polling
        if (this.peerConnection === null) {
          console.log('Stopping HTTP polling - peer connection closed');
          clearInterval(pollInterval);
          return;
        }
        
        // Send a keep-alive signal occasionally
        if (Math.random() < 0.2) { // 20% chance each poll
          await this._sendHttpSignal({
            type: 'keepalive',
            roomId: this.roomId,
            timestamp: Date.now()
          });
        }
        
        // Poll for new messages
        const messages = await this._pollHttpSignals();
        
        // Process any new messages
        for (const message of messages) {
          await this.handleSignalingMessage(message);
        }
      } catch (err) {
        console.warn('HTTP signaling poll error:', err);
        // Don't stop polling on error, just continue with the next interval
        
        // Increment failure count - if too many failures, try direct mode
        this._pollFailureCount = (this._pollFailureCount || 0) + 1;
        
        if (CONNECTION_CONFIG.enableDirectMode && 
            this._pollFailureCount >= CONNECTION_CONFIG.directModeThreshold && 
            !this._directModeAttempted && 
            !this.isConnected) {
          console.log(`HTTP polling failed ${this._pollFailureCount} times, trying direct mode`);
          this._directModeAttempted = true;
          this._setupDirectMode();
        }
      }
    }, CONNECTION_CONFIG.httpPollInterval);
  }
  
  /**
   * Send a signaling message using HTTP
   */
  private async _sendHttpSignal(signal: any): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // Skip if we know the server is down
      if (!isServerResponsive && this.reconnectAttempts > 1) {
        console.log('Skipping HTTP signal send - server appears unresponsive');
        return;
      }
      
      // Add retry logic with exponential backoff
      let attempts = 0;
      const maxAttempts = CONNECTION_CONFIG.maxRetries - 2; // Use fewer attempts for signals
      
      while (attempts < maxAttempts) {
        try {
          // Calculate backoff with exponential factor
          if (attempts > 0) {
            const backoffMs = Math.min(
              CONNECTION_CONFIG.initialBackoff * Math.pow(CONNECTION_CONFIG.backoffFactor, attempts),
              CONNECTION_CONFIG.maxBackoff
            );
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            
            // Check server health before retrying
            if (attempts > 1 && !(await checkServerHealth())) {
              console.log('Server unresponsive, skipping remaining signal attempts');
              break;
            }
          }
          
          attempts++;
          console.log(`HTTP signal send attempt ${attempts}/${maxAttempts} for ${signal.type}`);
          
          await axios.post(`${API_URL}/api/webrtc/rooms/${this.roomId}/signal`, {
            signal: signal,
            target_id: signal.target_id
          }, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: CONNECTION_CONFIG.httpTimeout // Reduced timeout
          });
          
          // Success, mark server as responsive and exit the retry loop
          isServerResponsive = true;
          break;
        } catch (err) {
          console.error(`HTTP signal send error (attempt ${attempts}/${maxAttempts}):`, err);
          
          if (attempts >= maxAttempts) {
            // Don't throw, just log the error and continue
            console.warn(`Failed to send signal after ${maxAttempts} attempts`);
            return;
          }
        }
      }
    } catch (err) {
      console.error('HTTP signal send error:', err);
      // In direct mode, we can ignore these errors
    }
  }
  
  /**
   * Poll for new signaling messages using HTTP
   */
  private async _pollHttpSignals(): Promise<any[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return [];
      
      // Skip if we know the server is down
      if (!isServerResponsive && this._pollFailureCount > 2) {
        console.log('Skipping HTTP polling - server appears unresponsive');
        return [];
      }
      
      const lastPoll = this._lastPollTime || Date.now() - 5000;
      this._lastPollTime = Date.now();
      
      const response = await axios.get(
        `${API_URL}/api/webrtc/rooms/${this.roomId}/messages?since=${lastPoll}`, 
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: CONNECTION_CONFIG.httpTimeout - 2000 // Even shorter timeout for polling
        }
      );
      
      // Success, mark server as responsive
      isServerResponsive = true;
      this._pollFailureCount = 0;
      
      return response.data.messages || [];
    } catch (err) {
      console.error('HTTP signal poll error:', err);
      this._pollFailureCount = (this._pollFailureCount || 0) + 1;
      
      // After several failures, check server health and update global state
      if (this._pollFailureCount > 3) {
        checkServerHealth();
      }
      
      return [];
    }
  }
  
  // Track failure counts
  private _pollFailureCount: number = 0;
  private _directModeAttempted: boolean = false;
  
  // Track last poll time
  private _lastPollTime: number = 0;
}

export default WebRTCCall; 