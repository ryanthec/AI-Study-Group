import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Space, Typography } from 'antd';
import { 
  UserOutlined, 
  LogoutOutlined, 
  SettingOutlined,
  BookOutlined,
  BellOutlined
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import type { MenuProps } from 'antd';

const { Header } = Layout;
const { Text } = Typography;

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  // User dropdown menu items
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: logout,
    },
  ];

  return (
    <Header 
      style={{ 
        background: '#fff', 
        padding: '0 24px',
        borderBottom: '1px solid #f0f0f0',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
      }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        height: '100%'
      }}>
        {/* Logo and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BookOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
          <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
            AI Study Group
          </Text>
        </div>

        {/* Navigation Menu */}
        <Menu
          mode="horizontal"
          defaultSelectedKeys={['dashboard']}
          style={{ 
            border: 'none',
            background: 'transparent',
            minWidth: '200px'
          }}
          items={[
            {
              key: 'dashboard',
              label: 'Dashboard',
            },
            {
              key: 'study-groups',
              label: 'Study Groups',
            },
            {
              key: 'my-groups',
              label: 'My Groups',
            },
          ]}
        />

        {/* User Section */}
        <Space size="middle">
          {/* Notifications */}
          <Button
            type="text"
            icon={<BellOutlined />}
            size="large"
            style={{ color: '#666' }}
          />

          {/* User Info and Dropdown */}
          <Space>
            <Text style={{ color: '#666' }}>
              Welcome, <strong>{user?.firstName}</strong>
            </Text>
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              arrow
            >
              <Avatar
                size="default"
                src={user?.avatar}
                icon={<UserOutlined />}
                style={{ 
                  cursor: 'pointer',
                  border: '2px solid #1890ff'
                }}
              />
            </Dropdown>
          </Space>
        </Space>
      </div>
    </Header>
  );
};