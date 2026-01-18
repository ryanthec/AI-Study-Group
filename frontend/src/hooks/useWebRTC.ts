import { useEffect, useRef, useState, useCallback } from 'react';

interface PeerState {
  [userId: string]: MediaStream;
}

export interface VoiceUser {
  userId: string;
  username: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export const useWebRTC = (roomId: string, userId: string, userName: string, websocketUrl: string) => {
  const [peers, setPeers] = useState<PeerState>({});
  const [connectedUsers, setConnectedUsers] = useState<VoiceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const pingIntervalRef = useRef<number | null>(null);

  // --- HELPER FUNCTIONS ---
  const handleUserLeft = useCallback((id: string) => {
    peersRef.current[id]?.close();
    delete peersRef.current[id];
    setPeers(prev => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    setConnectedUsers(prev => prev.filter(u => u.userId !== id));
  }, []);

  const handleAnswer = useCallback(async (id: string, ans: RTCSessionDescriptionInit) => {
    const pc = peersRef.current[id];
    if (!pc) return;

    if (pc.signalingState === 'stable') {
      console.warn(`[WebRTC] Ignored duplicate answer from ${id}`);
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(ans));
    } catch (e) {
      console.error("Error setting remote description:", e);
    }
  }, []);

  const handleIceCandidate = useCallback(async (id: string, candidate: RTCIceCandidateInit) => {
    try {
      const pc = peersRef.current[id];
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (e) {
      console.warn('[WebRTC] ICE candidate error (may be harmless):', e);
    }
  }, []);

  // --- CORE WEBRTC LOGIC ---
  const createPeerConnection = useCallback(async (
    targetUserId: string,
    isInitiator: boolean,
    incomingOffer?: RTCSessionDescriptionInit
  ) => {
    const existingPC = peersRef.current[targetUserId];

    if (existingPC && !incomingOffer) {
      const ice = existingPC.iceConnectionState;
      if (['connected', 'checking', 'completed'].includes(ice)) return;
      if (existingPC.signalingState === 'have-local-offer') return;
    }

    if (existingPC) {
      existingPC.close();
      delete peersRef.current[targetUserId];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[targetUserId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      setPeers(prev => ({ ...prev, [targetUserId]: event.streams[0] }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          userId,
          targetUserId,
          candidate: event.candidate,
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state for ${targetUserId}: ${pc.iceConnectionState}`);

      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }

      if (pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (peersRef.current[targetUserId]?.iceConnectionState === 'disconnected' ||
              peersRef.current[targetUserId]?.iceConnectionState === 'failed') {
            handleUserLeft(targetUserId);
          }
        }, 5000);
      }
    };

    try {
      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'offer',
            userId,
            targetUserId,
            offer,
          }));
        }
      } else if (incomingOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'answer',
            userId,
            targetUserId,
            answer,
          }));
        }
      }
    } catch (err) {
      console.error("PeerConnection setup failed:", err);
    }
  }, [userId, handleUserLeft]);

  // --- SYNC / POLLING LOGIC ---
  const syncUsers = useCallback((serverUsers: VoiceUser[]) => {
    setConnectedUsers(prev => {
      const existingIds = new Set(prev.map(u => u.userId));
      const newUsers = serverUsers.filter(u => !existingIds.has(u.userId));
      return [...prev, ...newUsers];
    });

    serverUsers.forEach(u => {
      if (u.userId === userId) return;

      const pc = peersRef.current[u.userId];
      const isDead = !pc || ['failed', 'disconnected', 'closed'].includes(pc.iceConnectionState);

      if (isDead && userId < u.userId) {
        console.log(`[Polling] Healing connection to ${u.username}`);
        createPeerConnection(u.userId, true);
      }
    });
  }, [userId, createPeerConnection]);

  // --- SOCKET CONNECTION ---
  const connectSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let fullUrl = websocketUrl;
    if (!websocketUrl.startsWith('ws')) {
      fullUrl = `${protocol}//${websocketUrl}`;
    }

    const url = `${fullUrl}/${roomId}/${userId}?username=${encodeURIComponent(userName)}`;
    socketRef.current = new WebSocket(url);

    socketRef.current.onopen = () => {
      console.log('[WebRTC] WebSocket connected');
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'client_ready' }));
      }

      if (pingIntervalRef.current) window.clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = window.setInterval(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'ping', userId }));
        }
      }, 30000);
    };

    socketRef.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      const senderId = data.userId;

      if (data.type === 'pong') return; // Ignore pong responses

      if (data.type === 'existing-users') {
        const others = data.users as VoiceUser[];
        setConnectedUsers(prev => {
          const existingIds = new Set(prev.map(u => u.userId));
          const newUsers = others.filter(u => !existingIds.has(u.userId));
          return [...prev, ...newUsers];
        });

        others.forEach(u => {
          if (userId < u.userId) {
            createPeerConnection(u.userId, true);
          }
        });
        return;
      }

      if (senderId === userId) return;

      switch (data.type) {
        case 'user-joined':
          setConnectedUsers(prev => {
            if (prev.find(u => u.userId === senderId)) return prev;
            return [...prev, { userId: senderId, username: data.username || 'Unknown' }];
          });
          if (userId < senderId) {
            createPeerConnection(senderId, true);
          }
          break;

        case 'user-left':
          handleUserLeft(senderId);
          break;

        case 'offer':
          setConnectedUsers(prev => {
            if (prev.find(u => u.userId === senderId)) return prev;
            return [...prev, { userId: senderId, username: data.username || 'Unknown' }];
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

    socketRef.current.onerror = (error) => {
      console.error('[WebRTC] WebSocket error:', error);
    };

    socketRef.current.onclose = () => {
      console.log('[WebRTC] WebSocket closed');
    };
  }, [roomId, userId, userName, websocketUrl, createPeerConnection, handleAnswer, handleIceCandidate, handleUserLeft]);

  // --- JOIN / LEAVE ---
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
  }, [userId, userName, connectSocket]);

  const leaveVoice = useCallback(() => {
    if (pingIntervalRef.current) {
      window.clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
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

  // --- CLEANUP ---
  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) {
        window.clearInterval(pingIntervalRef.current);
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
  }, []);

  return { peers, connectedUsers, joinVoice, leaveVoice, toggleMute, isMuted, isConnected, syncUsers };
};