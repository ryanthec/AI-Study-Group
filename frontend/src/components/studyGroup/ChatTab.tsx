import React from 'react';
import { Card } from 'antd';
import { ChatBox } from '../chat/ChatBox';
import { useTheme } from '../../hooks/useTheme';

interface ChatTabProps {
  groupId: number;
  onUserCountUpdate?: (count: number) => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({ groupId, onUserCountUpdate }) => {
  const { isDark } = useTheme();

  return (
    <div
      style={{
        padding: '24px',
        height: 'calc(100vh - 64px)', // Fixed height: viewport minus navbar
        overflow: 'hidden',
      }}
    >
      <Card
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isDark
            ? '0 2px 8px rgba(0, 0, 0, 0.45)'
            : '0 1px 4px rgba(0, 0, 0, 0.2)',
          border: isDark ? '1px solid #434343' : '1px solid #c0bebeff',
          borderRadius: '8px',
        }}
        styles = {{ body: {
          flex: 1,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',}}}
      >
        <ChatBox groupId={groupId} onUserCountUpdate={onUserCountUpdate} />
      </Card>
    </div>
  );
};
