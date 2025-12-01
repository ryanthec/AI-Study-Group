import React, { useMemo, useState } from 'react';
import { Layout, Button, Avatar, Dropdown, MenuProps } from 'antd';
import {
  HomeOutlined,
  TeamOutlined,
  SearchOutlined,
  UserOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

const { Header } = Layout;


// 1. Avatar Color Generator
const getAvatarColor = (username: string) => {
  const colors = ['#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#1890ff', '#52c41a'];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash % colors.length)];
};

// 2. Custom NavButton (Handles Hover Logic)
interface NavButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  isDark: boolean;
}

const NavButton: React.FC<NavButtonProps> = ({ label, icon, onClick, isDark }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Button
      type="text"
      icon={icon}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderRadius: '8px', // Rounded "pill" edges
        height: '36px',
        fontWeight: 500,
        transition: 'all 0.2s ease',
        // Text Color: Blue on hover, Standard otherwise
        color: isHovered
          ? (isDark ? '#177ddc' : '#1890ff') 
          : (isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.88)'),
        // Background: Subtle blue on hover, Transparent otherwise (regardless of being "active")
        backgroundColor: isHovered
          ? (isDark ? 'rgba(23, 125, 220, 0.15)' : '#e6f7ff')
          : 'transparent',
      }}
    >
      {label}
    </Button>
  );
};

// --- Main Navbar Component ---

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const username = user?.username || 'User';

  const avatarColor = useMemo(() => {
    return user?.preferences?.avatarColor || getAvatarColor(username);
  }, [username, user?.preferences]);

  const navItems = [
    { key: '/dashboard', icon: <HomeOutlined />, label: 'Dashboard' },
    { key: '/groups', icon: <TeamOutlined />, label: 'My Groups' },
    { key: '/groups/browse', icon: <SearchOutlined />, label: 'Browse Groups' },
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'theme',
      icon: isDark ? <SunOutlined /> : <MoonOutlined />,
      label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      onClick: toggleTheme,
    },
    { type: 'divider' },
    { key: 'profile', icon: <UserOutlined />, label: 'Account Details', onClick: () => navigate('/profile') },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', onClick: logout },
  ];

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    background: isDark ? '#1f1f1f' : '#fff',
    borderBottom: isDark ? '1px solid #434343' : '1px solid #e0e0e0',
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.45)' : '0 1px 4px rgba(0,0,0,0.08)',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
  };

  return (
    <Header style={headerStyle}>
      {/* Brand Logo */}
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          color: isDark ? '#fff' : '#1890ff',
          marginRight: '40px',
        }}
        onClick={() => navigate('/dashboard')}
      >
        AI Study Group
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
        
        {/* Navigation Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '24px' }}>
          {navItems.map((item) => (
            <NavButton
              key={item.key}
              label={item.label}
              icon={item.icon}
              onClick={() => navigate(item.key)}
              isDark={isDark}
            />
          ))}
        </div>

        {/* Profile Dropdown */}
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
          <div style={{ cursor: 'pointer' }}>
            <Avatar
              size="large"
              src={user?.avatar}
              style={{
                backgroundColor: avatarColor,
                color: '#fff',
                verticalAlign: 'middle',
                fontWeight: 600,
                border: isDark ? '2px solid #434343' : '2px solid #fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              {!user?.avatar && username.charAt(0).toUpperCase()}
            </Avatar>
          </div>
        </Dropdown>
      </div>
    </Header>
  );
};