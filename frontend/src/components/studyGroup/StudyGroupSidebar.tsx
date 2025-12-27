import React from 'react';
import { Menu, Layout, Button, Space, Tooltip, Badge, List, Avatar, Typography } from 'antd';
import {
  BarsOutlined,
  MessageOutlined,
  FileOutlined,
  SettingOutlined,
  LogoutOutlined,
  DeleteOutlined,
  UserAddOutlined,
  ArrowLeftOutlined,
  CrownOutlined,
  RobotOutlined,
  FormOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { StudyGroup } from '../../types/studyGroup.types';
import { useTheme } from '../../hooks/useTheme';

interface StudyGroupSidebarProps {
  groupId: number;
  group: StudyGroup | null;
  activeTab: 'details' | 'chat' | 'documents' | 'agent settings' | 'quizzes';
  onTabChange: (tab: 'details' | 'chat' | 'documents' | 'agent settings' | 'quizzes') => void;
  onEdit?: () => void;
  onInvite?: () => void;
  onDelete?: () => void;
  onLeave?: () => void;
  onBackToGroups?: () => void;
  onlineUsers?: any[];
}

export const StudyGroupSidebar: React.FC<StudyGroupSidebarProps> = ({
  group,
  activeTab,
  onTabChange,
  onEdit,
  onInvite,
  onDelete,
  onLeave,
  onBackToGroups,
  onlineUsers = [],
}) => {
  const { isDark } = useTheme();
  const { Text } = Typography;

  const sidebarStyle: React.CSSProperties = {
    background: isDark ? '#1f1f1f' : '#fff',
    borderRight: isDark ? '1px solid #434343' : '1px solid #f0f0f0',
    boxShadow: isDark
      ? '1px 0 4px rgba(0, 0, 0, 0.45)'
      : '1px 0 4px rgba(0, 0, 0, 0.15)',
    height: 'calc(100vh - 64px)',
    overflow: 'auto',
    position: 'fixed',
    left: 0,
    top: 64,
    width: 250,
    zIndex: 100,
  };

  // Colors for borders and backgrounds
  const borderColor = isDark ? '#434343' : '#9fa1a3ff';
  const actionsBackground = isDark ? '#141414' : '#fafafa';
  const headerBackground = isDark ? '#141414' : '#fff';

  // Popup specific colors
  const popupColors = {
    bg: isDark ? '#1f1f1f' : '#ffffff',
    text: isDark ? '#e6e6e6' : '#262626',
    border: isDark ? '#434343' : '#f0f0f0',
    secondaryText: isDark ? '#a6a6a6' : '#999999',
    hoverBg: isDark ? '#262626' : '#f6f6f6',
    hoverText: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)',
  };

  if (!group) return null;


  const onlineCount = onlineUsers.length;

  // (User List)
  const onlineUsersList = (
    <div style={{ maxHeight: '300px', overflowY: 'auto', minWidth: '220px' }}>
      <div 
        style={{ 
          padding: '10px 16px', 
          borderBottom: `1px solid ${popupColors.border}`, 
          marginBottom: '4px' 
        }}
      >
        <Text strong style={{ color: popupColors.text }}>
          Online Members ({onlineCount})
        </Text>
      </div>
      
      {onlineCount === 0 ? (
        <div style={{ padding: '16px', color: popupColors.secondaryText, textAlign: 'center' }}>
          No one else is online
        </div>
      ) : (
        <List
          size="small"
          dataSource={onlineUsers}
          split={false}
          renderItem={(user: any) => (
            <List.Item style={{ padding: '8px 16px' }}>
              <Space>
                <Avatar 
                  src={user.avatar} 
                  size="small"
                  style={{ backgroundColor: '#1890ff', verticalAlign: 'middle' }}
                >
                  {user.firstName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase()}
                </Avatar>
                <Text style={{ color: popupColors.text }}>
                  {user.username}
                </Text>
              </Space>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  const menuItems = [
    {
      key: 'details',
      icon: <BarsOutlined />,
      label: 'Group Details',
      onClick: () => onTabChange('details'),
    },
    {
      key: 'chat',
      icon: <MessageOutlined />,
      label: 'Chat',
      onClick: () => onTabChange('chat'),
    },
    {
      key: 'documents',
      icon: <FileOutlined />,
      label: 'Documents',
      onClick: () => onTabChange('documents'),
    },
    {
      key: 'agent settings',
      icon: <RobotOutlined />,
      label: 'Agent Settings',
      onClick: () => onTabChange('agent settings'),
    },
    {
      key: 'quizzes',
      icon: <FormOutlined />,
      label: 'Practice Quizzes',
      onClick: () => onTabChange('quizzes'),
    },
    
  ];

  return (
    <Layout.Sider style={sidebarStyle}>

      {/* Back to Groups Button */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onBackToGroups}
          style={{ width: '100%', justifyContent: 'flex-start' }}
        >
          Back to Groups
        </Button>
      </div>

      {/* Group Title and Online Status */}
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${borderColor}`,
          background: headerBackground,
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', wordBreak: 'break-word', fontSize: '18px', color: popupColors.text }}>
          {group.name}
        </h3>
        
        {/* The Hoverable Area */}
        <Tooltip 
            title={onlineUsersList} 
            placement="bottomLeft" 
            color={popupColors.bg} 
            trigger={['hover', 'click']}
            styles={{ body: { 
              padding: 0, 
              borderRadius: '8px', 
              boxShadow: '0 3px 6px -4px rgba(0,0,0,0.12), 0 6px 16px 0 rgba(0,0,0,0.08), 0 9px 28px 8px rgba(0,0,0,0.05)',
              background: popupColors.bg,
              } 
            }}
        >
            <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                cursor: 'pointer', 
                padding: '6px 10px', 
                borderRadius: '6px',
                background: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
                transition: 'all 0.3s',
                userSelect: 'none'
            }}>
                <Badge status="success" style={{ marginRight: 8 }} />
                <span style={{ 
                    fontSize: '13px', 
                    color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)', 
                    fontWeight: 500 
                }}>
                    {onlineCount} Online
                </span>
                <TeamOutlined style={{ marginLeft: 8, color: popupColors.secondaryText, fontSize: '12px' }} />
            </div>
        </Tooltip>
      </div>

      {/* Navigation Menu */}
      <Menu
        mode="vertical"
        selectedKeys={[activeTab]}
        items={menuItems}
        style={{
          borderRight: 'none',
          background: 'transparent',
        }}
      />

      {/* Admin/User Actions */}
      <div
        style={{
          padding: '16px',
          borderTop: `1px solid ${borderColor}`,
          position: 'absolute',
          bottom: 0,
          width: '100%',
          background: actionsBackground,
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {group.is_admin && (
            <>
              <Tooltip title="Edit group settings">
                <Button
                  block
                  type="primary"
                  icon={<SettingOutlined />}
                  onClick={onEdit}
                >
                  Settings
                </Button>
              </Tooltip>
              <Tooltip title="Invite members to group">
                <Button block icon={<UserAddOutlined />} onClick={onInvite}>
                  Invite
                </Button>
              </Tooltip>
              <Tooltip title="Delete this group permanently">
                <Button block danger icon={<DeleteOutlined />} onClick={onDelete}>
                  Delete
                </Button>
              </Tooltip>
            </>
          )}
          {!group.is_admin && (
            <Tooltip title="Leave this study group">
              <Button block danger icon={<LogoutOutlined />} onClick={onLeave}>
                Leave
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>
    </Layout.Sider>
  );
};
