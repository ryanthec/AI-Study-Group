import { useEffect, useRef, useState, useCallback } from 'react';

export interface VoiceUser {
  userId: string;
  username: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = (groupId: string, userId: string, userName: string, websocketUrl: string) => {
  // State
  const [activeUsers, setActiveUsers] = useState<VoiceUser[]>([]); // Who is in voice?
  const [isInVoice, setIsInVoice] = useState(false); // Am I in voice?
  const [peers, setPeers] = useState<Record<string, MediaStream>>({});
  const [isMuted, setIsMuted] = useState(false);

  // Refs
  const socketRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});

  // --- 1. CLEANUP HELPERS ---
  const closePeer = useCallback((peerId: string) => {
    if (peersRef.current[peerId]) {
      peersRef.current[peerId].close();
      delete peersRef.current[peerId];
    }
    setPeers(prev => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
  }, []);

  const leaveAudio = useCallback(() => {
    // 1. Stop Local Stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    // 2. Close All Peer Connections
    Object.keys(peersRef.current).forEach(closePeer);
    
    // 3. Update State
    setIsInVoice(false);
    setIsMuted(false);

    // 4. Notify Server (but keep socket open!)
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'leave_voice' }));
    }
  }, [closePeer]);

  // --- 2. WEBRTC HANDLERS ---
  const createPeer = useCallback(async (targetId: string, initiator: boolean, offer?: RTCSessionDescriptionInit) => {
    if (peersRef.current[targetId]) return peersRef.current[targetId];

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[targetId] = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle Incoming Stream
    pc.ontrack = (e) => {
      setPeers(prev => ({ ...prev, [targetId]: e.streams[0] }));
    };

    // Handle ICE
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          targetUserId: targetId,
          candidate: e.candidate,
          userId // Sender
        }));
      }
    };

    // Negotiation
    if (initiator) {
      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);
      socketRef.current?.send(JSON.stringify({
        type: 'offer',
        targetUserId: targetId,
        offer: offerDescription,
        userId
      }));
    } else if (offer) {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.send(JSON.stringify({
        type: 'answer',
        targetUserId: targetId,
        answer,
        userId
      }));
    }

    return pc;
  }, [userId]);

  const handleSignal = useCallback(async (data: any) => {
    const sender = data.userId;
    if (sender === userId) return;

    if (data.type === 'offer') {
      await createPeer(sender, false, data.offer);
    } else if (data.type === 'answer') {
      const pc = peersRef.current[sender];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === 'ice-candidate') {
      const pc = peersRef.current[sender];
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  }, [userId, createPeer]);

  // --- 3. SIGNALING SOCKET ---
  useEffect(() => {
    // Establish connection on mount (Signaling only)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Remove "http://" or "https://" from websocketUrl if present
    const cleanUrl = websocketUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${protocol}//${cleanUrl}/${groupId}/${userId}?username=${encodeURIComponent(userName)}`;
    
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Signaling Server');
      // Keep-alive
      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, 25000);
    };

    ws.onmessage = async (evt) => {
      const data = JSON.parse(evt.data);

      switch (data.type) {
        case 'room_state':
          // Updated list of who is in the room
          setActiveUsers(data.users);
          break;
        
        case 'you_joined':
          // Confirmed: I am in voice. Initiate connection to existing peers.
          data.peers.forEach((peer: VoiceUser) => {
            createPeer(peer.userId, true);
          });
          break;
        
        case 'peer_left':
          closePeer(data.userId);
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          // Only handle signals if I am actually in voice
          // (Or if I am joining, I might receive an offer)
          handleSignal(data);
          break;
      }
    };

    return () => {
      leaveAudio(); // Clean up media
      ws.close();
    };
  }, [groupId, userId, userName, websocketUrl, leaveAudio, createPeer, handleSignal, closePeer]);

  // --- 4. USER ACTIONS ---
  const joinVoice = useCallback(async () => {
    if (isInVoice) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setIsInVoice(true);
      
      // Send "I am joining" signal
      socketRef.current?.send(JSON.stringify({ type: 'join_voice' }));
    } catch (e) {
      console.error("Failed to get microphone", e);
      alert("Could not access microphone");
    }
  }, [isInVoice]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  }, []);

  return {
    activeUsers, // Everyone in the channel
    isInVoice,   // Am I connected?
    peers,       // Audio streams
    joinVoice,
    leaveVoice: leaveAudio,
    toggleMute,
    isMuted
  };
};