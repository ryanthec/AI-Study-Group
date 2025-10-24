import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Space, Typography, Tag, Descriptions, message, Modal, } from 'antd';
import {
  ArrowLeftOutlined,
  SettingOutlined,
  LogoutOutlined,
  DeleteOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { studyGroupService } from '../../services/studyGroup.service';
import { ChatBox } from '../../components/chat/ChatBox';
import type { StudyGroup } from '../../types/studyGroup.types';

const { Title, Text } = Typography;

export const GroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (groupId) {
      loadGroup();
    }
  }, [groupId]);

  const loadGroup = async () => {
    try {
      setLoading(true);
      const data = await studyGroupService.getGroup(Number(groupId));
      setGroup(data);
    } catch (error) {
      message.error('Failed to load group');
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = () => {
    Modal.confirm({
      title: 'Leave Study Group',
      content: 'Are you sure you want to leave this study group?',
      okText: 'Leave',
      okType: 'danger',
      onOk: async () => {
        try {
          await studyGroupService.leaveGroup(Number(groupId));
          message.success('Left the group successfully');
          navigate('/groups');
        } catch (error: any) {
          message.error(error.response?.data?.detail || 'Failed to leave group');
        }
      },
    });
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Study Group',
      content: 'Are you sure you want to delete this study group? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await studyGroupService.deleteGroup(Number(groupId));
          message.success('Group deleted successfully');
          navigate('/groups');
        } catch (error: any) {
          message.error(error.response?.data?.detail || 'Failed to delete group');
        }
      },
    });
  };

  if (loading) {
    return <Card loading />;
  }

  if (!group) {
    return null;
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/groups')}>
              Back
            </Button>
            <Title level={2} style={{ margin: 0 }}>
              {group.name}
            </Title>
            {group.is_admin && (
              <Tag color="gold" icon={<CrownOutlined />}>
                Admin
              </Tag>
            )}
          </Space>

          <Space>
            {group.is_admin && (
              <>
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => navigate(`/groups/${groupId}/edit`)}
                >
                  Settings
                </Button>
                <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
                  Delete Group
                </Button>
              </>
            )}
            {!group.is_admin && (
              <Button danger icon={<LogoutOutlined />} onClick={handleLeave}>
                Leave Group
              </Button>
            )}
          </Space>
        </div>

        <Card>
          <Descriptions column={2} bordered>
            <Descriptions.Item label="Description" span={2}>
              {group.description || 'No description'}
            </Descriptions.Item>
            <Descriptions.Item label="Subject">
              {group.subject ? <Tag>{group.subject}</Tag> : 'None'}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={group.status === 'active' ? 'green' : 'default'}>
                {group.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Members">
              {group.member_count}/{group.max_members}
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {new Date(group.created_at).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Chat Interface */}
        <Card title="Group Chat" style={{ height: 600 }} bodyStyle={{ height: 'calc(100% - 57px)', padding: 0 }}>
          <ChatBox groupId={Number(groupId)} />
        </Card>
      </Space>
    </div>
  );
};
