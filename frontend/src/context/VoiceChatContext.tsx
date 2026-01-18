import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { useWebRTC, VoiceUser } from '../hooks/useWebRTC';
import axios from 'axios';

interface VoiceChatContextType {
  isConnected: boolean;
  isMuted: boolean;
  peers: Record<string, MediaStream>;
  activeUsers: VoiceUser[];
  joinVoice: () => void;
  leaveVoice: () => void;
  toggleMute: () => void;
  peerVolumes: Record<string, number>;
  setPeerVolume: (userId: string, volume: number) => void;
  currentUser: { id: string; name: string };
}

const VoiceChatContext = createContext<VoiceChatContextType | undefined>(undefined);

export const VoiceChatProvider = ({ 
  children, 
  groupId, 
  userId,
  userName
}: { 
  children: ReactNode; 
  groupId: string; 
  userId: string;
  userName: string;
}) => {
  // Ensure WS_URL logic matches your environment
  const WS_URL = `${window.location.host}/api/v1/voice/ws`;

  const { peers, connectedUsers, joinVoice, leaveVoice, toggleMute, isMuted, isConnected, syncUsers } = useWebRTC(groupId, userId, userName, WS_URL);
  const [activeUsers, setActiveUsers] = useState<VoiceUser[]>([]);
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Polling logic to see who is in the channel
  useEffect(() => {
    isMountedRef.current = true;
    
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`/api/v1/voice/groups/${groupId}/users`);
        
        if (!isMountedRef.current) return;
        
        const serverUsers = res.data.users;

        if (isConnected) {
          syncUsers(serverUsers);
        } else {
          setActiveUsers(serverUsers);
        }
      } catch (e) {
        console.error("Failed to fetch voice users", e);
      }
    };

    fetchUsers();
    // Poll every 5 seconds (less aggressive than 3s)
    const interval = setInterval(fetchUsers, 5000);
    
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [groupId, isConnected, syncUsers]);

  // When connected, active users are from WebRTC state
  useEffect(() => {
    if (isConnected) {
      setActiveUsers(connectedUsers);
    }
  }, [connectedUsers, isConnected]);

  // Reset state when groupId changes
  useEffect(() => {
    setActiveUsers([]);
    setPeerVolumes({});
  }, [groupId]);

  const setPeerVolume = useCallback((targetId: string, volume: number) => {
    setPeerVolumes(prev => ({ ...prev, [targetId]: volume }));
  }, []);

  return (
    <VoiceChatContext.Provider value={{
      isConnected,
      isMuted,
      peers,
      activeUsers,
      joinVoice,
      leaveVoice,
      toggleMute,
      peerVolumes,
      setPeerVolume,
      currentUser: { id: userId, name: userName }
    }}>
      {children}
      <VoiceAudioManager peers={peers} peerVolumes={peerVolumes} />
    </VoiceChatContext.Provider>
  );
};

export const useVoiceChat = () => {
  const context = useContext(VoiceChatContext);
  if (!context) throw new Error("useVoiceChat must be used within a VoiceChatProvider");
  return context;
};

// --- Internal Component: Audio Manager ---
const VoiceAudioManager = ({ 
  peers, 
  peerVolumes 
}: { 
  peers: Record<string, MediaStream>; 
  peerVolumes: Record<string, number>; 
}) => {
  return (
    <div style={{ display: 'none' }} aria-hidden="true">
      {Object.entries(peers).map(([peerId, stream]) => (
        <AudioElement 
          key={peerId} 
          peerId={peerId}
          stream={stream} 
          volume={peerVolumes[peerId] ?? 1} 
        />
      ))}
    </div>
  );
};

const AudioElement = ({ 
  peerId,
  stream, 
  volume 
}: { 
  peerId: string;
  stream: MediaStream; 
  volume: number;
}) => {
  const ref = useRef<HTMLAudioElement>(null);
  
  useEffect(() => {
    const audio = ref.current;
    if (!audio || !stream) return;
    
    audio.srcObject = stream;
    
    // Handle autoplay restrictions
    const playAudio = async () => {
      try {
        await audio.play();
      } catch (err) {
        console.warn(`[Audio] Autoplay blocked for peer ${peerId}, will retry on user interaction`);
        
        // Retry on next user interaction
        const handleInteraction = async () => {
          try {
            await audio.play();
            document.removeEventListener('click', handleInteraction);
          } catch (e) {
            console.error(`[Audio] Failed to play for peer ${peerId}:`, e);
          }
        };
        document.addEventListener('click', handleInteraction, { once: true });
      }
    };
    
    playAudio();
    
    return () => {
      audio.srcObject = null;
    };
  }, [stream, peerId]);

  useEffect(() => {
    if (ref.current) {
      ref.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  return <audio ref={ref} autoPlay playsInline />;
};