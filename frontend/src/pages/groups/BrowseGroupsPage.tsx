import React, { useEffect, useState } from 'react';
import { Card, List, Button, Tag, Space, Typography, Input, Empty, message, Pagination, Select, Row, Col,} from 'antd';
import { TeamOutlined, SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { studyGroupService } from '../../services/studyGroup.service';
import type { StudyGroup } from '../../types/studyGroup.types';
import { useTheme } from '../../hooks/useTheme';

const { Title, Text } = Typography;

const subjects = ['Math', 'Science', 'English', 'History', 'Computer Science', 'Languages'];

export const BrowseGroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    searchGroups();
  }, [page, searchQuery, selectedSubject]);

  const searchGroups = async () => {
    try {
      setLoading(true);
      const data = await studyGroupService.searchGroups(
        searchQuery,
        selectedSubject,
        page,
        pageSize
      );
      setGroups(data.groups);
      setTotal(data.total);
    } catch (error) {
      message.error('Failed to search groups');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (groupId: number) => {
    try {
      await studyGroupService.joinGroup(groupId);
      message.success('Successfully joined the group');
      searchGroups(); // Refresh list
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to join group');
    }
  };


  const cardStyle = {
    boxShadow: isDark
      ? '0 2px 8px rgba(0, 0, 0, 0.45)'
      : '0 2px 8px rgba(0, 0, 0, 0.2)',
    border: isDark ? '1px solid #434343' : '1px solid #9fa1a3ff',
    borderRadius: '8px',
    marginBottom: '16px',
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>Browse Study Groups</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/groups/create')}
          >
            Create Group
          </Button>
        </div>

        <Card style={cardStyle}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={16}>
              <Input
                size="large"
                placeholder="Search groups by name or description..."
                prefix={<SearchOutlined />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={8}>
              <Select
                size="large"
                placeholder="Filter by subject"
                style={{ width: '100%' }}
                value={selectedSubject || undefined}
                onChange={setSelectedSubject}
                allowClear
              >
                {subjects.map((subject) => (
                  <Select.Option key={subject} value={subject}>
                    {subject}
                  </Select.Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Card>
        <Card style={cardStyle}>
          <List
            loading={loading}
            dataSource={groups}
            locale={{ emptyText: <Empty description="No study groups found" /> }}
            renderItem={(group) => (
              <List.Item
                style={{
                  borderBottom: isDark
                    ? '1px solid #434343'
                    : '1px solid #767677ff',
                  padding: '16px 0',
                }}
                actions={[
                  group.is_member ? (
                    <Button type="primary" onClick={() => navigate(`/groups/${group.id}`)}>
                      Open
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      disabled={group.member_count >= group.max_members}
                      onClick={() => handleJoin(group.id)}
                    >
                      {group.member_count >= group.max_members ? 'Full' : 'Join'}
                    </Button>
                  ),
                ]}
              >
                <List.Item.Meta
                  avatar={<TeamOutlined style={{ fontSize: 32, color: '#1890ff' }} />}
                  title={
                    <Space>
                      {group.name}
                      {group.is_member && <Tag color="green">Joined</Tag>}
                      {group.member_count >= group.max_members && <Tag color="red">Full</Tag>}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4}>
                      <Text type="secondary">{group.description || 'No description'}</Text>
                      <Space size={12}>
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

          {total > pageSize && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Pagination
                current={page}
                total={total}
                pageSize={pageSize}
                onChange={setPage}
                showSizeChanger={false}
              />
            </div>
          )}
        </Card>
      </Space>
    </div>
  );
};
