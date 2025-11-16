import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, MenuProps } from 'antd';
import { HomeOutlined, TeamOutlined, SearchOutlined, UserOutlined, LogoutOutlined, SettingOutlined,} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { ThemeToggleButton } from './ThemeToggleButton';

const { Header } = Layout;
const { Text } = Typography;

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isDark } = useTheme();

  const menuItems: MenuProps['items'] = [
    { key: '/dashboard', icon: <HomeOutlined />, label: 'Dashboard' },
    { key: '/groups', icon: <TeamOutlined />, label: 'My Groups' },
    { key: '/groups/browse', icon: <SearchOutlined />, label: 'Browse Groups' },
  ];

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: 'Profile', onClick: () => navigate('/profile') },
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings', onClick: () => navigate('/settings') },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', onClick: logout },
  ];

  // Darkmode styles
  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    background: isDark ? '#1f1f1f' : '#fff',
    borderBottom: isDark ? '1px solid #434343' : '1px solid #9fa1a3ff',
    boxShadow: isDark 
      ? '0 2px 8px rgba(0, 0, 0, 0.45)' 
      : '0 1px 4px rgba(0, 0, 0, 0.15)',
    gap: 16,
  };

  return (
    <Header style={headerStyle}>
      {/* Left: Brand */}
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flex: '0 0 auto',
        }}
        onClick={() => navigate('/dashboard')}
      >
        AI Study Group
      </div>

      {/* Middle: Tabs that can shrink and ellipsize */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        <Menu
          mode="horizontal"
          selectedKeys={[
            location.pathname.startsWith('/groups')
              ? location.pathname.includes('/browse')
                ? '/groups/browse'
                : '/groups'
              : location.pathname,
          ]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            border: 'none',
            overflow: 'hidden',
            background: 'transparent',
          }}
        />
      </div>

      <Space>
        {/* Theme toggle */}
        <ThemeToggleButton />
      </Space>

      {/* Right: Profile gets priority width and can take space from tabs */}
      <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            flex: '0 1 10%',                // allow this block to take up to 40% width
            minWidth: 150,                  // ensure it doesn't collapse too small
            justifyContent: 'flex-end',     // keep right aligned visually
          }}
        >
          <Avatar icon={<UserOutlined />} src={user?.avatar} />
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: '1',
              display: 'inline-block',
              width: '100%',                // use all available space from flex
              textAlign: 'left',            // text flows immediately after avatar
            }}
            title={user?.username}
          >
            {user?.username}
          </span>
        </div>
      </Dropdown>
    </Header>
  );
};
