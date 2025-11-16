import React from 'react';
import { Card, Descriptions, Tag, Space, Avatar, List, Empty, Spin } from 'antd';
import { CrownOutlined, UserOutlined } from '@ant-design/icons';
import type { StudyGroup } from '../../types/studyGroup.types';
import {useTheme} from "../../hooks/useTheme";

interface GroupMember {
  id: string;
  username: string;
  avatar?: string;
  role: string;
  isOnline: boolean;
}

interface GroupDetailsTabProps {
  group: StudyGroup | null;
  loading: boolean;
  members: GroupMember[];
  membersLoading: boolean;
}

export const GroupDetailsTab: React.FC<GroupDetailsTabProps> = ({
  group,
  loading,
  members,
  membersLoading,
}) => {

  const { isDark } = useTheme();

  const cardStyle = {
    boxShadow: isDark 
      ? '0 2px 8px rgba(0, 0, 0, 0.45)' 
      : '0 1px 4px rgba(0, 0, 0, 0.2)',
    border: isDark ? '1px solid #434343' : '1px solid #9fa1a3ff',
    borderRadius: '8px',
  };

  if (loading || !group) {
    return <Spin />;
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Group Information Card */}
      <Card style={cardStyle}>
        <Descriptions
          title={<h2>{group.name}</h2>}
          bordered
          column={1}
          size="small"
        >
          <Descriptions.Item label="Description">
            {group.description || 'No description provided'}
          </Descriptions.Item>
          <Descriptions.Item label="Subject">
            {group.subject ? <Tag>{group.subject}</Tag> : <Tag>N/A</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={group.status === 'active' ? 'green' : 'red'}>
              {group.status?.toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Members">
            <Tag color="blue">
              {group.member_count}/{group.max_members}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {new Date(group.created_at).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Updated">
            {new Date(group.updated_at).toLocaleString()}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Members List Card */}
      <Card title="Group Members" loading={membersLoading} style={{ ...cardStyle, marginTop: '24px' }}>
        {members && members.length > 0 ? (
          <List
            dataSource={members}
            renderItem={(member) => (
              <List.Item
                style={{
                  padding: '12px 0',
                  borderBottom: isDark ? '1px solid #434343' : '1px solid #9fa1a3ff',
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      src={member.avatar}
                      icon={<UserOutlined />}
                      style={{
                        backgroundColor: member.isOnline ? '#52c41a' : '#e62828ff',
                      }}
                    />
                  }
                  title={
                    <Space>
                      <span>{member.username}</span>
                      {member.role === 'admin' && (
                        <Tag icon={<CrownOutlined />} color="gold">
                          Admin
                        </Tag>
                      )}
                      {member.isOnline && (
                        <Tag color="green" style={{ marginLeft: '8px' }}>
                          Online
                        </Tag>
                      )}
                      {!member.isOnline && (
                        <Tag color="red" style={{ marginLeft: '8px' }}>
                          Offline
                        </Tag>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="No members in this group" />
        )}
      </Card>
    </div>
  );
};
