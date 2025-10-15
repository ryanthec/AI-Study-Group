import React from 'react';
import { Typography, Row, Col, Card, Button, Space, Empty, Statistic } from 'antd';
import { PlusOutlined, TeamOutlined, BookOutlined, TrophyOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';

const { Title, Text } = Typography;

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  // Mock data - replace with actual API calls
  const stats = {
    totalGroups: 3,
    activeStudyTime: 24,
    completedQuizzes: 8,
  };

  const recentGroups = [
    {
      id: '1',
      name: 'Mathematics Study Group',
      subject: 'Mathematics',
      members: 5,
      lastActivity: '2 hours ago',
    },
    {
      id: '2',
      name: 'Physics Fundamentals',
      subject: 'Physics',
      members: 3,
      lastActivity: '1 day ago',
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <Title level={2} style={{ marginBottom: '8px' }}>
          Welcome back, {user?.firstName}! 👋
        </Title>
        <Text type="secondary" style={{ fontSize: '16px' }}>
          Ready to continue your learning journey?
        </Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Study Groups"
              value={stats.totalGroups}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Study Hours"
              value={stats.activeStudyTime}
              prefix={<BookOutlined />}
              suffix="hrs"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Quizzes Completed"
              value={stats.completedQuizzes}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Card 
        title="Quick Actions" 
        style={{ marginBottom: '32px' }}
        extra={
          <Button type="primary" icon={<PlusOutlined />}>
            Create Study Group
          </Button>
        }
      >
        <Space wrap size="large">
          <Button size="large" icon={<TeamOutlined />}>
            Join Group
          </Button>
          <Button size="large" icon={<BookOutlined />}>
            Browse Subjects
          </Button>
          <Button size="large" icon={<TrophyOutlined />}>
            Take Quiz
          </Button>
        </Space>
      </Card>

      {/* Recent Study Groups */}
      <Card title="Your Study Groups">
        {recentGroups.length === 0 ? (
          <Empty
            description="No study groups yet"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" icon={<PlusOutlined />}>
              Create Your First Group
            </Button>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {recentGroups.map((group) => (
              <Col xs={24} sm={12} lg={8} key={group.id}>
                <Card
                  size="small"
                  hoverable
                  style={{ height: '100%' }}
                  actions={[
                    <Button type="link" key="join">
                      Join Chat
                    </Button>,
                    <Button type="link" key="settings">
                      Settings
                    </Button>,
                  ]}
                >
                  <Card.Meta
                    title={group.name}
                    description={
                      <Space direction="vertical" size="small">
                        <Text type="secondary">{group.subject}</Text>
                        <Text type="secondary">
                          <TeamOutlined /> {group.members} members
                        </Text>
                        <Text type="secondary">
                          Last activity: {group.lastActivity}
                        </Text>
                      </Space>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  );
};