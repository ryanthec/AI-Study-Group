import React from 'react';
import { Layout as AntLayout } from 'antd';
import { Navbar } from './Navbar';
import { useTheme } from '../../hooks/useTheme';

const { Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isDark } = useTheme(); //  Get theme state

  return (
    <AntLayout
      style={{
        minHeight: '100vh',
        background: 'var(--canvas-bg)', //  Dynamic background
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Navbar />

      <Content
        style={{
          padding: 24,
          background: 'var(--canvas-bg)', //  Dynamic background
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1200,
            background: 'var(--nav-bg)', //  Dynamic container background
            borderRadius: 8,
            padding: 24,
            border: '1px solid var(--border-color)', //  Added explicit border
            boxShadow: 'var(--card-shadow)', //  Dynamic shadow
          }}
        >
          {children}
        </div>
      </Content>
    </AntLayout>
  );
};
