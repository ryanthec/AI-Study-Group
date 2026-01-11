import React, { useState, useEffect, useRef } from 'react';
import { Button, List, Avatar, Typography, Space, Slider, Card, Divider } from 'antd';
import { 
  AudioOutlined, 
  AudioMutedOutlined, 
  PhoneFilled, 
  UserOutlined,
  SoundOutlined
} from '@ant-design/icons';
import { useVoiceChat } from '../../context/VoiceChatContext';
import { useTheme } from '../../hooks/useTheme';

const { Text } = Typography;

export const VoiceSidebarSection = () => {
  const { isDark } = useTheme();
  
  const {
    isConnected,
    joinVoice,
    leaveVoice,
    activeUsers,
    isMuted,
    toggleMute,
    currentUser,
    peerVolumes, 
    setPeerVolume
  } = useVoiceChat();

  // State for the Context Menu (Right Click)
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    userId: string;
  } | null>(null);

  // Styling constants
  const textColor = isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)';
  const secondaryText = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)';

  // Close context menu on global click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleRightClick = (e: React.MouseEvent, userId: string) => {
    e.preventDefault(); // Prevent browser menu
    e.stopPropagation(); // Stop event bubbling
    
    // Don't show menu for yourself
    if (userId === currentUser.id) return;

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      userId
    });
  };

  return (
    <div style={{ padding: '16px 16px 8px 16px', position: 'relative' }}>
      {/* Header */}
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
         <Text strong style={{ color: secondaryText, fontSize: '12px', textTransform: 'uppercase' }}>
            Voice Channel
         </Text>
         {isConnected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: '#52c41a' }}>Live</span>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#52c41a', boxShadow: '0 0 4px #52c41a' }} />
            </div>
         )}
      </div>

      {/* Main Join/Leave Controls */}
      {!isConnected ? (
        <Button 
            type="primary" 
            block 
            icon={<AudioOutlined />} 
            onClick={joinVoice}
            style={{ marginBottom: '12px', background: '#237804', borderColor: '#237804' }}
        >
            Join Voice
        </Button>
      ) : (
        <div style={{ marginBottom: '12px' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }} size="small">
                <Button 
                    block
                    icon={isMuted ? <AudioMutedOutlined /> : <AudioOutlined />} 
                    danger={isMuted}
                    onClick={toggleMute}
                >
                    {isMuted ? 'Unmute' : 'Mute'}
                </Button>
                <Button 
                    danger 
                    icon={<PhoneFilled style={{ transform: 'rotate(135deg)' }} />} 
                    onClick={leaveVoice}
                    title="Disconnect"
                />
            </Space>
        </div>
      )}

      {/* User List */}
      {(isConnected || activeUsers.length > 0) && (
        <div style={{ 
            background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)', 
            borderRadius: '8px', 
            padding: '4px',
            marginTop: '8px',
            minHeight: '40px'
        }}>
            <List
                size="small"
                dataSource={activeUsers}
                split={false}
                locale={{ emptyText: 'No one here' }}
                renderItem={(user) => {
                    const isSelf = user.userId === currentUser.id;
                    return (
                        <List.Item 
                            style={{ 
                                padding: '6px 8px', 
                                border: 'none', 
                                cursor: isSelf ? 'default' : 'context-menu', // Hint that it's clickable
                                borderRadius: '4px',
                                transition: 'background 0.2s'
                            }}
                            className="voice-user-item"
                            onContextMenu={(e) => handleRightClick(e, user.userId)}
                            // Add hover effect via inline style or class
                            onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <Avatar 
                                    size="small" 
                                    icon={<UserOutlined />} 
                                    style={{ 
                                        marginRight: '8px', 
                                        backgroundColor: isSelf ? '#1890ff' : '#8c8c8c',
                                        flexShrink: 0
                                    }} 
                                />
                                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <Text style={{ color: textColor, fontSize: '13px', fontWeight: isSelf ? 600 : 400 }}>
                                        {isSelf ? `${currentUser.name} (You)` : user.username}
                                    </Text>
                                </div>
                                {isSelf && isMuted && <AudioMutedOutlined style={{ color: '#ff4d4f', fontSize: '12px' }} />}
                            </div>
                        </List.Item>
                    );
                }}
            />
            
            {/* Context Menu Popup */}
            {contextMenu && (
                <div 
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        zIndex: 1000,
                        minWidth: '200px',
                    }}
                    onClick={(e) => e.stopPropagation()} // Prevent clicking inside closing it immediately
                >
                    <Card 
                        size="small" 
                        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)', background: isDark ? '#1f1f1f' : '#fff' }}
                        bodyStyle={{ padding: '12px' }}
                    >
                        <div style={{ marginBottom: '8px', fontSize: '12px', color: secondaryText, fontWeight: 600 }}>
                             USER SETTINGS
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <SoundOutlined style={{ color: textColor }} />
                            <Text style={{ fontSize: '13px', color: textColor }}>Volume</Text>
                            <Text style={{ fontSize: '12px', color: secondaryText, marginLeft: 'auto' }}>
                                {Math.round((peerVolumes[contextMenu.userId] ?? 1) * 100)}%
                            </Text>
                        </div>

                        <Slider 
                            min={0}
                            max={1}
                            step={0.01}
                            // Bind value to context state so it persists and doesn't reset
                            value={peerVolumes[contextMenu.userId] ?? 1}
                            onChange={(val) => setPeerVolume(contextMenu.userId, val)}
                            tooltip={{ formatter: (val) => `${Math.round((val || 0) * 100)}%` }}
                        />
                    </Card>
                </div>
            )}
        </div>
      )}
    </div>
  );
};