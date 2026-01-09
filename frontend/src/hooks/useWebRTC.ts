import { useEffect, useRef, useState, useCallback } from 'react';

interface PeerState {
  [userId: string]: MediaStream;
}

export interface VoiceUser {
  userId: string;
  username: string;
}

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export const useWebRTC = (roomId: string, userId: string, userName: string, websocketUrl: string) => {
  const [peers, setPeers] = useState<PeerState>({});
  const [connectedUsers, setConnectedUsers] = useState<VoiceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const socketRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});

  const joinVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      connectSocket();
      setIsConnected(true);
      setConnectedUsers([{ userId, username: userName }]);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please allow permissions.");
    }
  }, [roomId, userId, userName, websocketUrl]);

  const leaveVoice = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    setPeers({});
    setConnectedUsers([]);
    setIsConnected(false);
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const connectSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let fullUrl = websocketUrl;
    if (!websocketUrl.startsWith('ws')) {
         fullUrl = `${protocol}//${websocketUrl}`;
    }

    const url = `${fullUrl}/${roomId}/${userId}?username=${encodeURIComponent(userName)}`;
    console.log("Connecting to Voice WS:", url); // DEBUG LOG

    socketRef.current = new WebSocket(url);

    // FIX 1: Add Error Handling to see if connection fails
    socketRef.current.onerror = (error) => {
        console.error("WebSocket Error:", error);
        // Optional: leaveVoice() if connection fails
    };

    socketRef.current.onopen = () => {
        console.log("WebSocket Connected");
    };

    socketRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'existing-users') {
            // Merge logic for objects
            setConnectedUsers(prev => {
                // Filter out any that are already in 'data.users' to avoid dupes, then concat
                const others = data.users as VoiceUser[];
                const existingIds = new Set(prev.map(u => u.userId));
                const newUsers = others.filter(u => !existingIds.has(u.userId));
                return [...prev, ...newUsers];
            });

        const senderId = data.userId;
        if (senderId === userId) return;

        switch (data.type) {
            case 'user-joined':
                // Add new user with name
                setConnectedUsers(prev => {
                    if (prev.find(u => u.userId === senderId)) return prev;
                    return [...prev, { userId: senderId, username: data.username || 'Unknown' }];
                });
                await createPeerConnection(senderId, false);
                break;
            
            case 'user-left':
                setConnectedUsers(prev => prev.filter(u => u.userId !== senderId));
                handleUserLeft(senderId);
                break;
            
            case 'offer':
                // If we receive an offer, ensure user is in list (fallback name if missing)
                setConnectedUsers(prev => {
                    if (prev.find(u => u.userId === senderId)) return prev;
                    return [...prev, { userId: senderId, username: 'Unknown User' }];
                });
                await createPeerConnection(senderId, false, data.offer);
                break;
            
            case 'answer':
                await handleAnswer(senderId, data.answer);
                break;
            
            case 'ice-candidate':
                await handleIceCandidate(senderId, data.candidate);
                break;
        }
      };
    };
  };

  const createPeerConnection = async (targetUserId: string, isInitiator: boolean, incomingOffer?: any) => {
      if (peersRef.current[targetUserId] && !incomingOffer) return;

      const pc = new RTCPeerConnection(STUN_SERVERS);
      peersRef.current[targetUserId] = pc;
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
      }

      pc.ontrack = (event) => {
          setPeers(prev => ({ ...prev, [targetUserId]: event.streams[0] }));
      };
      
      pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({
                  type: 'ice-candidate',
                  userId,
                  targetUserId,
                  candidate: event.candidate
              }));
          }
      };

      if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'offer', userId, targetUserId, offer }));
          }
      } else if (incomingOffer) {
          await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'answer', userId, targetUserId, answer }));
          }
      }
  };

  const handleAnswer = async (id: string, ans: any) => peersRef.current[id]?.setRemoteDescription(new RTCSessionDescription(ans));
  const handleIceCandidate = async (id: string, can: any) => peersRef.current[id]?.addIceCandidate(new RTCIceCandidate(can));
  const handleUserLeft = (id: string) => {
      peersRef.current[id]?.close();
      delete peersRef.current[id];
      setPeers(prev => { const n = {...prev}; delete n[id]; return n; });
  };

  useEffect(() => {
      return () => {
         // Cleanup handled by manual leave
      };
  }, []);

  return { 
    peers, 
    connectedUsers, 
    joinVoice, 
    leaveVoice, 
    toggleMute, 
    isMuted, 
    isConnected 
  };
};