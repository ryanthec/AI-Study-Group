import React, { useEffect, useState } from 'react';
import { Card, List, Button, Tag, Space, Typography, Input, Empty, message, Pagination, } from 'antd';
import {
  TeamOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { studyGroupService } from '../../services/studyGroup.service';
import type { StudyGroup } from '../../types/studyGroup.types';

const { Title, Text } = Typography;

export const MyGroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    loadGroups();
  }, [page]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await studyGroupService.getMyGroups(page, pageSize);
      setGroups(data.groups);
      setTotal(data.total);
    } catch (error) {
      message.error('Failed to load study groups');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>My Study Groups</Title>
          <Space>
            <Button
              icon={<SearchOutlined />}
              onClick={() => navigate('/groups/browse')}
            >
              Browse Groups
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/groups/create')}
            >
              Create Group
            </Button>
          </Space>
        </div>

        <Card>
          {groups.length === 0 && !loading ? (
            <Empty
              description="You haven't joined any study groups yet"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={() => navigate('/groups/browse')}>
                Browse Study Groups
              </Button>
            </Empty>
          ) : (
            <>
              <List
                loading={loading}
                dataSource={groups}
                renderItem={(group) => (
                  <List.Item
                    key={group.id}
                    actions={[
                      group.is_admin && (
                        <Button
                          icon={<SettingOutlined />}
                          onClick={() => navigate(`/groups/${group.id}/edit`)}
                        >
                          Manage
                        </Button>
                      ),
                      <Button
                        type="primary"
                        onClick={() => navigate(`/groups/${group.id}`)}
                      >
                        Open
                      </Button>,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      avatar={<TeamOutlined style={{ fontSize: 32, color: '#1890ff' }} />}
                      title={
                        <Space>
                          {group.name}
                          {group.is_admin && (
                            <Tag color="gold" icon={<CrownOutlined />}>
                              Admin
                            </Tag>
                          )}
                          <Tag color={group.status === 'active' ? 'green' : 'default'}>
                            {group.status}
                          </Tag>
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
                            <Text type="secondary">
                              Created {new Date(group.created_at).toLocaleDateString()}
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
            </>
          )}
        </Card>
      </Space>
    </div>
  );
};
