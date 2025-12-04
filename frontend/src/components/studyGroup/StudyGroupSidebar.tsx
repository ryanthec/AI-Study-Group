import React from 'react';
import { Menu, Layout, Button, Space, Tooltip, Badge } from 'antd';
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
} from '@ant-design/icons';
import type { StudyGroup } from '../../types/studyGroup.types';
import { useTheme } from '../../hooks/useTheme';

interface StudyGroupSidebarProps {
  groupId: number;
  group: StudyGroup | null;
  activeTab: 'details' | 'chat' | 'documents' | 'agent settings';
  onTabChange: (tab: 'details' | 'chat' | 'documents' | 'agent settings') => void;
  onEdit?: () => void;
  onInvite?: () => void;
  onDelete?: () => void;
  onLeave?: () => void;
  onBackToGroups?: () => void;
  onlineMembers?: number;
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
  onlineMembers = 0,
}) => {
  const { isDark } = useTheme();

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
  const textSecondaryColor = isDark ? '#a6a6a6' : '#666';
  const actionsBackground = isDark ? '#141414' : '#fafafa';

  if (!group) return null;

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
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', wordBreak: 'break-word' }}>
          {group.name}
        </h3>
        <Badge
          count={onlineMembers}
          showZero
          color="#52c41a"
          style={{ backgroundColor: '#52c41a' }}
        />
        <span
          style={{
            marginLeft: '8px',
            fontSize: '12px',
            color: textSecondaryColor,
          }}
        >
          {onlineMembers} online
        </span>
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
