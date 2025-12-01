import React, { useState, useEffect } from 'react';
import { 
  Card, Form, Input, Button, Avatar, 
  Typography, ColorPicker, message, Row, Col, Divider 
} from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const { Title, Text } = Typography;

export const AccountDetailsPage: React.FC = () => {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Watch the color field for live preview
  const watchedColor = Form.useWatch('avatarColor', form);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        username: user.username,
        email: user.email,
        firstName: user.firstName, 
        lastName: user.lastName,
        // Default to a safe fallback if no preference exists
        avatarColor: user.preferences?.avatarColor || '#1890ff',
      });
    }
  }, [user, form]);

  const handleUpdateProfile = async (values: any) => {
    setLoading(true);
    try {
      // Convert Color object to hex string if it's from Antd ColorPicker
      const colorHex = typeof values.avatarColor === 'string' 
        ? values.avatarColor 
        : values.avatarColor.toHexString();

      await api.patch('/users/me', {
        username: values.username,
        preferences: {
          avatarColor: colorHex
        }
      });
      
      message.success('Profile updated successfully');
      
      // Reload to refresh the User Context with new data
      window.location.reload(); 
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Determine color for the preview (Live form value > Saved User value > Default)
  const displayColor = typeof watchedColor === 'object' 
    ? watchedColor.toHexString() 
    : (watchedColor || user?.preferences?.avatarColor || '#1890ff');

  // Determine text for preview
  const displayInitial = form.getFieldValue('username') 
    ? form.getFieldValue('username').charAt(0).toUpperCase() 
    : (user?.username?.charAt(0).toUpperCase() || 'U');

  return (
    <div style={{ maxWidth: 800, margin: '24px auto', padding: '0 24px' }}>
      <Title level={2}>Account Details</Title>
      
      <Row gutter={[24, 24]}>
        {/* Left Column: Avatar Preview */}
        <Col xs={24} md={8}>
          <Card style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>
              <Avatar 
                size={120} 
                icon={<UserOutlined />}
                style={{ 
                  backgroundColor: displayColor,
                  fontSize: '48px',
                  verticalAlign: 'middle'
                }} 
              >
                {displayInitial}
              </Avatar>
            </div>
            
            <Title level={4}>{user?.username}</Title>
            <Text type="secondary">{user?.email}</Text>
          </Card>
        </Col>

        {/* Right Column: Editable Forms */}
        <Col xs={24} md={16}>
          <Card title="Edit Details">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleUpdateProfile}
            >
              {/* Read Only Fields */}
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="First Name" name="firstName">
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Last Name" name="lastName">
                    <Input disabled />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Email Address" name="email">
                <Input disabled />
              </Form.Item>
              
              <Divider />

              {/* Editable Fields */}
              <Form.Item 
                label="Username" 
                name="username"
                rules={[{ required: true, min: 3, message: 'Username must be at least 3 characters' }]}
              >
                <Input onChange={() => form.validateFields(['username'])} />
              </Form.Item>

              <Form.Item label="Profile Color" name="avatarColor">
                 <ColorPicker showText />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  Save Changes
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};