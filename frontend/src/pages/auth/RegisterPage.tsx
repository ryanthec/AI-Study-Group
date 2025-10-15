import React from 'react';
import { Card, Row, Col } from 'antd';
import { RegisterForm } from '../../components/auth/RegisterForm';

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  borderRadius: 12,
  boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
};

export const RegisterPage: React.FC = () => {
  return (
    <div style={pageStyle}>
      <Card style={cardStyle} bodyStyle={{ padding: 32 }}>
        <RegisterForm onSwitchToLogin={() => (window.location.href = '/login')} />
      </Card>
    </div>
  );
};