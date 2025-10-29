import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Spin, Result, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { invitationService } from '../../services/invitation.service';

export const AcceptInvitationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    acceptInvitation(token);
  }, [searchParams]);

  const acceptInvitation = async (token: string) => {
    try {
      const response = await invitationService.acceptInvitation(token);
      setSuccess(true);
      setGroupId(response.group_id);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <Spin size="large" tip="Processing invitation..." />
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        padding: '20px'
      }}>
        <Card style={{ maxWidth: 500, width: '100%' }}>
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="Successfully Joined!"
            subTitle="You have successfully joined the study group."
            extra={[
              <Button type="primary" key="group" onClick={() => navigate(`/groups/${groupId}`)}>
                Go to Group
              </Button>,
              <Button key="dashboard" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      padding: '20px'
    }}>
      <Card style={{ maxWidth: 500, width: '100%' }}>
        <Result
          icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
          title="Invitation Error"
          subTitle={error || 'This invitation is invalid or has expired.'}
          extra={[
            <Button type="primary" key="dashboard" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>,
          ]}
        />
      </Card>
    </div>
  );
};
