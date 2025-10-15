// src/components/layout/Layout.tsx
import React from 'react';
import { Layout as AntLayout } from 'antd';
import { Navbar } from './Navbar';

const { Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <AntLayout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Navbar />
      <Content style={{ 
        padding: '24px',
        background: '#f5f5f5'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto',
          background: '#fff',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}>
          {children}
        </div>
      </Content>
    </AntLayout>
  );
};