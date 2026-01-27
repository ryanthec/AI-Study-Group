import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  Typography,
  message,
  Space,
  Switch,
} from 'antd';
import { GlobalOutlined, LockOutlined } from '@ant-design/icons';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { studyGroupService } from '../../services/studyGroup.service';
import type { StudyGroup, UpdateStudyGroupRequest } from '../../types/studyGroup.types';

const { Title } = Typography;
const { TextArea } = Input;

const subjects = ['Math', 'Science', 'English', 'History', 'Computer Science', 'Languages', 'Other'];

export const EditGroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<StudyGroup | null>(null);

  useEffect(() => {
    if (groupId) {
      loadGroup();
    }
  }, [groupId]);

  const loadGroup = async () => {
    try {
      const data = await studyGroupService.getGroup(Number(groupId));
      setGroup(data);
      form.setFieldsValue({
        name: data.name,
        description: data.description,
        module: data.module,
        max_members: data.max_members,
        is_public: data.is_public,
      });
    } catch (error) {
      message.error('Failed to load group');
      navigate('/groups');
    }
  };

  const handleSubmit = async (values: UpdateStudyGroupRequest) => {
    try {
      setLoading(true);
      await studyGroupService.updateGroup(Number(groupId), values);
      message.success('Group updated successfully!');
      navigate(`/groups/${groupId}`);
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/groups/${groupId}`)}>
            Back
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            Edit Study Group
          </Title>
        </Space>

        <Card>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label="Group Name"
              name="name"
              rules={[
                { required: true, message: 'Please enter a group name' },
                { min: 1, max: 100, message: 'Name must be 1-100 characters' },
              ]}
            >
              <Input size="large" placeholder="e.g., Calculus Study Group" />
            </Form.Item>

            <Form.Item
              label="Description"
              name="description"
              rules={[{ max: 500, message: 'Description must be at most 500 characters' }]}
            >
              <TextArea
                rows={4}
                placeholder="Describe what this group is about, topics covered, goals, etc."
              />
            </Form.Item>

            <Form.Item label="Module" name="module">
               <Input 
                size="large" 
                placeholder="e.g., SC1005 -  Digital Logic"
              />
            </Form.Item>

            <Form.Item
              label="Maximum Members"
              name="max_members"
              rules={[{ required: true, message: 'Please set maximum members' }]}
              extra="Note: Cannot reduce below current member count"
            >
              <InputNumber
                size="large"
                min={group?.member_count || 2}
                max={10}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
                label="Group Visibility"
                name="is_public"
                valuePropName="checked"
                extra="Public groups are visible to everyone in the 'Browse Groups' page."
            >
                <Switch 
                    checkedChildren={<Space><GlobalOutlined /> Public</Space>}
                    unCheckedChildren={<Space><LockOutlined /> Private</Space>}
                />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" size="large" loading={loading}>
                  Save Changes
                </Button>
                <Button size="large" onClick={() => navigate(`/groups/${groupId}`)}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </div>
  );
};
