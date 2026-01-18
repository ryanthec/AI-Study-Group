import React, { createContext, useContext, ReactNode, useState, useCallback, useRef, useEffect } from 'react';
import { useWebRTC, VoiceUser } from '../hooks/useWebRTC';

interface VoiceChatContextType {
  activeUsers: VoiceUser[];
  isInVoice: boolean;
  joinVoice: () => void;
  leaveVoice: () => void;
  isMuted: boolean;
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
  const WS_URL = `${window.location.host}/api/v1/voice/ws`;

  // The hook now manages the "Always On" signaling connection
  const { 
    activeUsers, 
    isInVoice, 
    peers, 
    joinVoice, 
    leaveVoice, 
    toggleMute, 
    isMuted 
  } = useWebRTC(groupId, userId, userName, WS_URL);

  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});

  const setPeerVolume = useCallback((targetId: string, volume: number) => {
    setPeerVolumes(prev => ({ ...prev, [targetId]: volume }));
  }, []);

  return (
    <VoiceChatContext.Provider value={{
      activeUsers,
      isInVoice,
      joinVoice,
      leaveVoice,
      isMuted,
      toggleMute,
      peerVolumes,
      setPeerVolume,
      currentUser: { id: userId, name: userName }
    }}>
      {children}
      {/* Invisible Audio Manager to render streams */}
      <VoiceAudioManager peers={peers} peerVolumes={peerVolumes} />
    </VoiceChatContext.Provider>
  );
};

export const useVoiceChat = () => {
  const context = useContext(VoiceChatContext);
  if (!context) throw new Error("useVoiceChat must be used within a VoiceChatProvider");
  return context;
};

// --- AUDIO MANAGER (No changes needed here, logic is solid) ---
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

const AudioElement = ({ peerId, stream, volume }: { peerId: string; stream: MediaStream; volume: number; }) => {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = ref.current;
    if (!audio || !stream) return;
    audio.srcObject = stream;
    audio.play().catch(e => console.warn(`Autoplay blocked for ${peerId}`, e));
  }, [stream, peerId]);

  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);

  return <audio ref={ref} autoPlay playsInline />;
};