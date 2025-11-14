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
  CrownOutlined,
} from '@ant-design/icons';
import type { StudyGroup } from '../../types/studyGroup.types';

interface StudyGroupSidebarProps {
  groupId: number;
  group: StudyGroup | null;
  activeTab: 'details' | 'chat' | 'documents';
  onTabChange: (tab: 'details' | 'chat' | 'documents') => void;
  onEdit?: () => void;
  onInvite?: () => void;
  onDelete?: () => void;
  onLeave?: () => void;
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
  onlineMembers = 0,
}) => {
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
  ];

  return (
    <Layout.Sider
      width={250}
      style={{
        background: '#fff',
        borderRight: '1px solid #f0f0f0',
        height: 'calc(100vh - 64px)',
        overflow: 'auto',
        position: 'fixed',
        left: 0,
        top: 64,
      }}
    >
      {/* Group Title and Online Status */}
      <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
        <h3 style={{ margin: '0 0 8px 0', wordBreak: 'break-word' }}>
          {group.name}
        </h3>
        <Badge
          count={onlineMembers}
          showZero
          color="#52c41a"
          style={{ backgroundColor: '#52c41a' }}
        />
        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
          {onlineMembers} online
        </span>
      </div>

      {/* Navigation Menu */}
      <Menu
        mode="vertical"
        selectedKeys={[activeTab]}
        items={menuItems}
        style={{ borderRight: 'none' }}
      />

      {/* Admin/User Actions */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid #f0f0f0',
          position: 'absolute',
          bottom: 0,
          width: '100%',
          background: '#fafafa',
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {group.is_admin && (
            <>
              <Tooltip title="Edit group settings">
                <Button
                  block
                  type="primary"
                  ghost
                  icon={<SettingOutlined />}
                  onClick={onEdit}
                >
                  Settings
                </Button>
              </Tooltip>
              <Tooltip title="Invite members to group">
                <Button
                  block
                  icon={<UserAddOutlined />}
                  onClick={onInvite}
                >
                  Invite
                </Button>
              </Tooltip>
              <Tooltip title="Delete this group permanently">
                <Button
                  block
                  danger
                  icon={<DeleteOutlined />}
                  onClick={onDelete}
                >
                  Delete
                </Button>
              </Tooltip>
            </>
          )}
          {!group.is_admin && (
            <Tooltip title="Leave this study group">
              <Button
                block
                danger
                icon={<LogoutOutlined />}
                onClick={onLeave}
              >
                Leave
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>
    </Layout.Sider>
  );
};
