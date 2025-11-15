import React from 'react';
import { Layout as AntLayout } from 'antd';
import { Navbar } from './Navbar';
import { useTheme } from '../../hooks/useTheme';

const { Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isDark } = useTheme(); // ✅ Get theme state

  return (
    <AntLayout
      style={{
        minHeight: '100vh',
        background: isDark ? '#141414' : '#f5f5f5', // ✅ Dynamic background
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Navbar />

      <Content
        style={{
          padding: 24,
          background: isDark ? '#141414' : '#f5f5f5', // ✅ Dynamic background
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1200,
            background: isDark ? '#1f1f1f' : '#fff', // ✅ Dynamic container background
            borderRadius: 8,
            padding: 24,
            boxShadow: isDark 
              ? '0 2px 8px rgba(0,0,0,0.45)' 
              : '0 2px 8px rgba(0,0,0,0.06)', // ✅ Dynamic shadow
          }}
        >
          {children}
        </div>
      </Content>
    </AntLayout>
  );
};
