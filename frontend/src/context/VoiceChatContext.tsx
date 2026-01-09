import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
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

  const { peers, connectedUsers, joinVoice, leaveVoice, toggleMute, isMuted, isConnected } = useWebRTC(groupId, userId, userName, WS_URL);
  const [activeUsers, setActiveUsers] = useState<VoiceUser[]>([]);
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});

  // Polling logic to see who is in the channel (even when disconnected)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`/api/v1/voice/groups/${groupId}/users`);
        // If we are connected, we trust our WebRTC peers list + ourselves
        // If disconnected, we trust the API
        if (!isConnected) {
            setActiveUsers(res.data.users);
        }
      } catch (e) {
        console.error("Failed to fetch voice users", e);
      }
    };

    fetchUsers(); // Initial fetch
    const interval = setInterval(fetchUsers, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [groupId, isConnected]);


  // When connected, active users are peers + me
  useEffect(() => {
    if (isConnected) {
      setActiveUsers(connectedUsers);
    }
  }, [connectedUsers, isConnected]);


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
      {/* Render the Audio Manager here so it's always active */}
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
// Handles playing the audio streams invisibly
const VoiceAudioManager = ({ 
  peers, 
  peerVolumes 
}: { 
  peers: Record<string, MediaStream>; 
  peerVolumes: Record<string, number>; 
}) => {
  return (
    <div style={{ display: 'none' }}>
      {Object.entries(peers).map(([peerId, stream]) => (
        <AudioElement 
          key={peerId} 
          stream={stream} 
          volume={peerVolumes[peerId] ?? 1} 
        />
      ))}
    </div>
  );
};

const AudioElement = ({ stream, volume }: { stream: MediaStream; volume: number }) => {
  const ref = React.useRef<HTMLAudioElement>(null);
  
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);

  return <audio ref={ref} autoPlay playsInline />;
};