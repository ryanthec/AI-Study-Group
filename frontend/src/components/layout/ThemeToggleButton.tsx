import React from 'react';
import { Button } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useTheme } from '../../hooks/useTheme';

export const ThemeToggleButton: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <Button
      type="text"
      icon={isDark ? <SunOutlined /> : <MoonOutlined />}
      onClick={toggleTheme}
      size="large"
      style={{
        borderRadius: '6px',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    />
  );
};
