import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Spin, Button, message } from 'antd';
import { authService } from '../../services/auth.service';

const { Title, Text } = Typography;

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      message.error('Invalid verification link.');
      return;
    }

    authService.verifyEmail(token)
      .then(() => {
        setStatus('success');
        message.success('Email successfully verified! You can now log in.');
      })
      .catch((err) => {
        setStatus('error');
        message.error(err.response?.data?.detail || 'Verification failed. Link may be expired.');
      });
  }, [searchParams]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ textAlign: 'center', padding: '40px', maxWidth: '400px' }}>
        <Title level={3}>Account Verification</Title>
        {status === 'loading' && <Spin size="large" style={{ margin: '20px 0' }} />}
        {status === 'success' && (
          <div>
            <Text type="success">Your email has been verified!</Text>
            <Button type="primary" block style={{ marginTop: '20px' }} onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </div>
        )}
        {status === 'error' && (
          <div>
            <Text type="danger">Verification failed or link expired.</Text>
            <Button block style={{ marginTop: '20px' }} onClick={() => navigate('/login')}>
              Return to Login
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};