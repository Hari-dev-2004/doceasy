import axios from 'axios';
import { API_URL } from '../config';

// Configuration for WebRTC peers with more STUN/TURN servers for better connectivity
const PEER_CONFIG = {
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
    }
  ],
  iceCandidatePoolSize: 10
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
  private isPolling: boolean = false;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private lastMessageTimestamp: string = '';
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
      // Join the room first to get participant ID
      await this.joinRoom();
      
      // Create RTCPeerConnection first
      this.peerConnection = new RTCPeerConnection(PEER_CONFIG);
      console.log('Created peer connection with config:', PEER_CONFIG);
      
      // Set up remote stream container
      this.remoteStream = new MediaStream();
      
      // Request local media with explicit constraints
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }, 
          audio: true 
        });
        console.log('Got local media stream:', this.localStream);
      } catch (mediaError) {
        console.error('Failed to get video, trying audio only:', mediaError);
        // Fallback to audio only
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('Got audio-only local media stream');
        } catch (audioError) {
          console.error('Failed to get any media stream:', audioError);
          throw new Error('Cannot access camera or microphone');
        }
      }
      
      // Add local tracks to peer connection AFTER creating the peer connection
      if (this.localStream && this.peerConnection) {
        this.localStream.getTracks().forEach(track => {
          console.log('Adding track to peer connection:', track.kind, track.id, track.enabled);
          this.peerConnection?.addTrack(track, this.localStream!);
        });
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
      
      // Handle ICE connection state changes
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
        
        if (this.peerConnection?.iceConnectionState === 'connected' || 
            this.peerConnection?.iceConnectionState === 'completed') {
          if (!this.isConnected) {
            console.log('ICE connection established');
            this.isConnected = true;
            this.onPeerConnectedCallback?.();
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
        console.log('Received remote track:', event.track.kind, event.track.id, event.track.enabled);
        this.hasReceivedRemoteTrack = true;
        
        // Add track to remote stream
        if (this.remoteStream) {
          // Important fix: Use event.streams[0] directly if available
          if (event.streams && event.streams[0]) {
            console.log('Using event stream directly');
            this.remoteStream = event.streams[0];
          } else {
            this.remoteStream.addTrack(event.track);
          }
          
          // Notify about the remote stream
          if (this.onRemoteStreamCallback) {
            console.log('Calling onRemoteStream callback with stream:', this.remoteStream.id);
            this.onRemoteStreamCallback(this.remoteStream);
          }
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
      
      // Start polling for signaling messages
      this.startPolling();
      
      // Check room status to determine if we should initiate the call
      await this.checkRoomAndInitiateIfNeeded();
      
    } catch (error) {
      console.error('Error initializing WebRTC call:', error);
      this.onErrorCallback?.(error instanceof Error ? error : new Error(String(error)));
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
   * Join the WebRTC room
   */
  private async joinRoom(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await axios.post(
        `${API_URL}/api/webrtc/rooms/${this.roomId}/join`,
        { appointment_id: this.appointmentId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      this.participantId = response.data.participant_id;
      this.userId = response.data.user_id;
      
      console.log('Joined WebRTC room:', response.data);
    } catch (error) {
      console.error('Error joining WebRTC room:', error);
      this.onErrorCallback?.(new Error('Failed to join the video call room'));
      throw error;
    }
  }
  
  /**
   * Check the room status and initiate call if we're the first participant
   */
  private async checkRoomAndInitiateIfNeeded(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await axios.get(`${API_URL}/api/webrtc/rooms/${this.roomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Room status:', response.data);
      
      // Important change: Both sides should send offers to avoid deadlock
      // Each side will process the received offer and send an answer
      if (response.data.participants >= 2) {
        console.log('Multiple participants in room, always create offer');
        // Always create an offer when there are multiple participants
        if (this.peerConnection) {
          await this.createAndSendOffer();
        }
      } else {
        // If we're the first, we'll wait and poll for others to join
        this.isInitiator = true;
        console.log('We are the first participant, will initiate call when others join');
      }
    } catch (error) {
      console.error('Error checking room status:', error);
    }
  }
  
  /**
   * Create and send an offer to remote peer
   */
  private async createAndSendOffer(): Promise<void> {
    try {
      if (!this.peerConnection) return;
      
      // Create offer with explicit constraints
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: true // Important for reconnection
      });
      
      console.log('Created offer:', offer);
      
      // Set local description
      await this.peerConnection.setLocalDescription(offer);
      console.log('Set local description from offer');
      
      // Send offer through signaling channel
      this.sendSignal({
        type: 'offer',
        sdp: this.peerConnection.localDescription
      });
      console.log('Sent offer via signaling');
      
    } catch (error) {
      console.error('Error creating offer:', error);
      this.onErrorCallback?.(new Error('Failed to create connection offer'));
    }
  }
  
  /**
   * Start polling for signaling messages
   */
  private startPolling(): void {
    if (this.isPolling) return;
    
    console.log('Starting polling for signaling messages');
    this.isPolling = true;
    this.pollingInterval = setInterval(() => {
      this.pollSignalingMessages();
    }, 1000);
  }
  
  /**
   * Stop polling for signaling messages
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('Stopped polling for signaling messages');
  }
  
  /**
   * Poll for new signaling messages
   */
  private async pollSignalingMessages(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Add since parameter if we have a lastMessageTimestamp
      let url = `${API_URL}/api/webrtc/rooms/${this.roomId}/messages`;
      if (this.lastMessageTimestamp) {
        url += `?since=${encodeURIComponent(this.lastMessageTimestamp)}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const messages: SignalingMessage[] = response.data.messages || [];
      if (messages.length > 0) {
        console.log(`Received ${messages.length} signaling messages`);
      }
      this.lastMessageTimestamp = response.data.server_time;
      
      // Process each message that isn't from us
      for (const message of messages) {
        if (message.user_id !== this.userId) {
          await this.handleSignalingMessage(message);
        }
      }
      
      // Make offer as initiator if needed - this handles the case where we're waiting for peers
      if (this.isInitiator && !this.isConnected && this.peerConnection?.connectionState !== 'connecting') {
        // Check if there are others in the room now
        const roomResponse = await axios.get(`${API_URL}/api/webrtc/rooms/${this.roomId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (roomResponse.data.participants >= 2 && this.peerConnection) {
          console.log('Another participant joined, initiating call as first participant');
          await this.createAndSendOffer();
        }
      }
      
      // If we've been connected for a while but don't have remote tracks, try to reconnect
      if (this.isConnected && !this.hasReceivedRemoteTrack && this.peerConnection) {
        console.log('Connected but no remote track received, trying to reconnect');
        this.tryReconnect();
      }
      
    } catch (error) {
      console.error('Error polling signaling messages:', error);
    }
  }
  
  /**
   * Handle an incoming signaling message
   */
  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    try {
      if (!this.peerConnection) return;
      
      const signal = message.signal;
      console.log('Handling signal type:', signal.type);
      
      if (signal.type === 'offer') {
        console.log('Received offer from remote peer');
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
        console.log('Sent answer via signaling');
        
      } else if (signal.type === 'answer') {
        console.log('Received answer from remote peer');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        console.log('Set remote description from answer');
        
      } else if (signal.type === 'candidate') {
        console.log('Received ICE candidate from remote peer');
        if (signal.candidate) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
          console.log('Added ICE candidate');
        }
      } else {
        console.warn('Unknown signal type:', signal.type);
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  }
  
  /**
   * Send a signaling message
   */
  private async sendSignal(signal: any, targetUserId?: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      await axios.post(
        `${API_URL}/api/webrtc/rooms/${this.roomId}/signal`,
        {
          signal,
          target_user_id: targetUserId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
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
    
    // Stop polling
    this.stopPolling();
    
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
}

export default WebRTCCall; 