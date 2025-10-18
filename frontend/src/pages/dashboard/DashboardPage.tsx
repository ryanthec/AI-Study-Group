import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, List, Tag, Typography, Space } from 'antd';
import {
  TeamOutlined,
  BookOutlined,
  TrophyOutlined,
  PlusOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { studyGroupService } from '../../services/studyGroup.service';
import type { StudyGroup, StudyGroupStats } from '../../types/studyGroup.types';

const { Title, Text } = Typography;

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
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

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>Dashboard</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => navigate('/groups/create')}
          >
            Create Study Group
          </Button>
        </div>

        {/* Stats Cards */}
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card loading={loading}>
              <Statistic
                title="Total Groups"
                value={stats.total_groups}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card loading={loading}>
              <Statistic
                title="Groups Created"
                value={stats.groups_created}
                prefix={<BookOutlined/>}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card loading={loading}>
              <Statistic
                title="Study Sessions Completed"
                value={stats.sessions_completed}
                prefix={<TrophyOutlined/>}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Recent Groups */}
        <Card
          title="Recent Study Groups"
          loading={loading}
          extra={
            <Button
              type="link"
              icon={<ArrowRightOutlined />}
              onClick={() => navigate('/groups')}
            >
              View All
            </Button>
          }
        >
          {recentGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Text type="secondary">No study groups yet</Text>
              <br />
              <Button
                type="primary"
                style={{ marginTop: 16 }}
                onClick={() => navigate('/groups/browse')}
              >
                Browse Groups
              </Button>
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
                    title={
                      <Space>
                        {group.name}
                        {group.is_admin && <Tag color="blue">Admin</Tag>}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={4}>
                        <Text type="secondary">{group.description || 'No description'}</Text>
                        <Space size={8}>
                          {group.subject && <Tag>{group.subject}</Tag>}
                          <Text type="secondary">
                            {group.member_count}/{group.max_members} members
                          </Text>
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </Space>
    </div>
  );
};
