import axios from 'axios';

// Configuration for WebRTC peers
const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
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
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private isPolling: boolean = false;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private lastMessageTimestamp: string = '';
  private isInitiator: boolean = false;
  private participantId: string | null = null;
  private userId: string | null = null;
  private isConnected: boolean = false;
  
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
      // Join the room first to get participant ID
      await this.joinRoom();
      
      // Request local media
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }, 
        audio: true 
      });
      
      // Set up remote stream container
      this.remoteStream = new MediaStream();
      
      // Create RTCPeerConnection
      this.peerConnection = new RTCPeerConnection(PEER_CONFIG);
      
      // Add local tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.localStream && this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });
      
      // Handle ICE candidates
      this.peerConnection.onicecandidate = event => {
        if (event.candidate) {
          this.sendSignal({
            type: 'candidate',
            candidate: event.candidate
          });
        }
      };
      
      // Handle ICE connection state changes
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
        
        if (this.peerConnection?.iceConnectionState === 'connected' || 
            this.peerConnection?.iceConnectionState === 'completed') {
          if (!this.isConnected) {
            this.isConnected = true;
            this.onPeerConnectedCallback?.();
          }
        } else if (this.peerConnection?.iceConnectionState === 'disconnected' || 
                  this.peerConnection?.iceConnectionState === 'failed' || 
                  this.peerConnection?.iceConnectionState === 'closed') {
          if (this.isConnected) {
            this.isConnected = false;
            this.onPeerDisconnectedCallback?.();
          }
        }
      };
      
      // Handle remote tracks
      this.peerConnection.ontrack = event => {
        console.log('Received remote track', event);
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          this.onRemoteStreamCallback?.(this.remoteStream);
        }
      };
      
      // Share the local stream with the component
      this.onLocalStreamCallback?.(this.localStream);
      
      // Start polling for signaling messages
      this.startPolling();
      
      // Check room status to determine if we should initiate the call
      await this.checkRoomAndInitiateIfNeeded();
      
    } catch (error) {
      console.error('Error initializing WebRTC call:', error);
      this.onErrorCallback?.(error as Error);
      throw error;
    }
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
        `/api/webrtc/rooms/${this.roomId}/join`,
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
      
      const response = await axios.get(`/api/webrtc/rooms/${this.roomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // If we have exactly 1 participant (just us), we'll be the call initiator
      // If we have 2+ participants, we'll wait for an offer
      if (response.data.participants === 1) {
        this.isInitiator = true;
        console.log('We are the first participant, will initiate call when others join');
      } else if (response.data.participants >= 2) {
        console.log('Joining existing call with other participants');
        // We'll make an offer if we're joining an existing room
        if (!this.isInitiator && this.peerConnection) {
          await this.createAndSendOffer();
        }
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
      
      // Create offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      // Set local description
      await this.peerConnection.setLocalDescription(offer);
      
      // Send offer through signaling channel
      this.sendSignal({
        type: 'offer',
        sdp: this.peerConnection.localDescription
      });
      
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
      let url = `/api/webrtc/rooms/${this.roomId}/messages`;
      if (this.lastMessageTimestamp) {
        url += `?since=${this.lastMessageTimestamp}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const messages: SignalingMessage[] = response.data.messages || [];
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
        const roomResponse = await axios.get(`/api/webrtc/rooms/${this.roomId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (roomResponse.data.participants >= 2 && this.peerConnection) {
          console.log('Another participant joined, initiating call as first participant');
          await this.createAndSendOffer();
        }
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
      
      if (signal.type === 'offer') {
        // Set remote description from offer
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        
        // Create and send answer
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        this.sendSignal({
          type: 'answer',
          sdp: this.peerConnection.localDescription
        });
        
      } else if (signal.type === 'answer') {
        // Set remote description from answer
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        
      } else if (signal.type === 'candidate') {
        // Add ICE candidate
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
      
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  }
  
  /**
   * Send a signaling message to peers
   */
  private async sendSignal(signal: any, targetUserId?: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      await axios.post(
        `/api/webrtc/rooms/${this.roomId}/signal`,
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
   * Toggle local video track
   */
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
      }
    }
  }
  
  /**
   * Toggle local audio track
   */
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
      }
    }
  }
  
  /**
   * End the call and clean up resources
   */
  async endCall(): Promise<void> {
    // Stop polling
    this.stopPolling();
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Clear remote stream
    this.remoteStream = null;
    
    // Leave the room
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await axios.post(`/api/webrtc/rooms/${this.roomId}/leave`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }
}

export default WebRTCCall; 