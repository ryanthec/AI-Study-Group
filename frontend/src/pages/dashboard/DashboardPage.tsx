import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, List, Tag, Typography, Space, Layout } from 'antd';
import {
  TeamOutlined,
  BookOutlined,
  TrophyOutlined,
  PlusOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { studyGroupService } from '../../services/studyGroup.service';
import type { StudyGroup, StudyGroupStats } from '../../types/studyGroup.types';

const { Title, Text } = Typography;

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [stats, setStats] = useState<StudyGroupStats>({
    total_groups: 0,
    groups_created: 0,
    sessions_completed: 0,
  });
  const [recentGroups, setRecentGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, groupsData] = await Promise.all([
        studyGroupService.getStats(),
        studyGroupService.getMyGroups(1, 5),
      ]);
      setStats(statsData);
      setRecentGroups(groupsData.groups);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };


  // Define shadows (for visual contrast between components) and color based on theme
  const cardStyle = {
    boxShadow: isDark 
      ? '0 2px 8px rgba(0, 0, 0, 0.45)' 
      : '0 1px 4px rgba(0, 0, 0, 0.08)',
    border: isDark ? '1px solid #434343' : '1px solid #f0f0f0',
    borderRadius: '8px',
  };

  const bgColor = isDark ? '#1f1f1f' : '#f9f9f9';

  return (
    <Layout style={{ minHeight: '100vh', background: bgColor }}>
      <Layout.Content style={{ padding: '24px', background: bgColor,}}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <Title level={2} style={{ margin: 0 }}>
            Dashboard
          </Title>
          <Text type="secondary">Welcome back! Here's your study group overview.</Text>
        </div>

        {/* Create Group Button */}
        <div style={{ marginBottom: '24px' }}>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => navigate('/groups/create')}
            style={{ borderRadius: '6px' }}
          >
            Create Study Group
          </Button>
        </div>

        {/* Stats Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
          <Col xs={24} sm={8}>
            <Card style={cardStyle} loading={loading}>
              <Statistic
                title="Total Groups"
                value={stats.total_groups}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={cardStyle} loading={loading}>
              <Statistic
                title="Groups Created"
                value={stats.groups_created}
                prefix={<BookOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={cardStyle} loading={loading}>
              <Statistic
                title="Sessions Completed"
                value={stats.sessions_completed}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Recent Groups */}
        <Card
          title="Your Recent Study Groups"
          extra={
            <Button
              type="link"
              onClick={() => navigate('/groups')}
              icon={<ArrowRightOutlined />}
            >
              View All
            </Button>
          }
          style={cardStyle}
          loading={loading}
        >
          {recentGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Text type="secondary">No study groups yet</Text>
              <div style={{ marginTop: '16px' }}>
                <Button
                  type="primary"
                  onClick={() => navigate('/groups/browse')}
                >
                  Browse Groups
                </Button>
              </div>
            </div>
          ) : (
            <List
              dataSource={recentGroups}
              renderItem={(group) => (
                <List.Item
                  key={group.id}
                  actions={[
                    <Button
                      type="link"
                      onClick={() => navigate(`/groups/${group.id}`)}
                    >
                      View
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={group.name}
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary">
                          {group.description || 'No description'}
                        </Text>
                        <Space size="small">
                          {group.subject && <Tag>{group.subject}</Tag>}
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {group.member_count}/{group.max_members} members
                          </Text>
                          {group.is_admin && <Tag color="blue">Admin</Tag>}
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </Layout.Content>
    </Layout>
  );
};