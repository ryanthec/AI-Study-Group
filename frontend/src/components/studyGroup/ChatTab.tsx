import React from 'react';
import { Card } from 'antd';
import { ChatBox } from '../chat/ChatBox';

interface ChatTabProps {
  groupId: number;
}

export const ChatTab: React.FC<ChatTabProps> = ({ groupId }) => {
  return (
    <div style={{ padding: '24px', height: 'calc(100vh - 120px)' }}>
      <Card
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <ChatBox groupId={groupId} />
      </Card>
    </div>
  );
};
