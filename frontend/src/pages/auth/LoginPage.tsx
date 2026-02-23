import React, { useState } from 'react';
import { Card, Row, Col } from 'antd';
import { LoginForm } from '../../components/auth/LoginForm';
import { RegisterForm } from '../../components/auth/RegisterForm';

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'var(--canvas-bg)',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  borderRadius: 12,
  border: '1px solid var(--border-color)',
};

export const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div style={pageStyle}>
      <Card style={cardStyle} styles={{ body: { padding: 32 } }}>
        {isLogin ? (
          <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
        )}
      </Card>
    </div>
  );
};