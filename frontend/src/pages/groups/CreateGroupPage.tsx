import React, { useState } from 'react';
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
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { studyGroupService } from '../../services/studyGroup.service';
import type { CreateStudyGroupRequest } from '../../types/studyGroup.types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const subjects = ['Math', 'Science', 'English', 'History', 'Computer Science', 'Languages', 'Other'];

export const CreateGroupPage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: CreateStudyGroupRequest) => {
    try {
      setLoading(true);
      const group = await studyGroupService.createGroup(values);
      message.success('Study group created successfully!');
      navigate(`/groups/${group.id}`);
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to create study group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>Create Study Group</Title>
          <Text type="secondary">
            Create a new study group and invite others to join your learning journey
          </Text>
        </div>

        <Card>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ max_members: 5 }}
          >
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

            <Form.Item label="Subject" name="subject">
              <Select size="large" placeholder="Select a subject" allowClear>
                {subjects.map((subject) => (
                  <Select.Option key={subject} value={subject}>
                    {subject}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="Maximum Members"
              name="max_members"
              rules={[{ required: true, message: 'Please set maximum members' }]}
              extra="Recommended: 4-6 members for optimal collaboration"
            >
              <InputNumber
                size="large"
                min={2}
                max={10}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" size="large" loading={loading}>
                  Create Group
                </Button>
                <Button size="large" onClick={() => navigate('/groups')}>
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
