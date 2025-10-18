import React from 'react';
import { Layout as AntLayout } from 'antd';
import { Navbar } from './Navbar';

const { Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <AntLayout
      style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',   // ensure Header then Content stack
      }}
    >
      <Navbar />

      <Content
        style={{
          padding: 24,
          background: '#f5f5f5',
          display: 'flex',
          justifyContent: 'center',  // center the inner container
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1200,
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          {children}
        </div>
      </Content>
    </AntLayout>
  );
};