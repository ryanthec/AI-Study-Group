import React from 'react';
import { Form, Input, Button, Checkbox, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import type { LoginRequest } from '../../types/auth.types';

const { Title, Text, Link } = Typography;

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const { login, isLoading } = useAuth();
  const [form] = Form.useForm();

  const onFinish = async (values: LoginRequest) => {
    try {
      await login(values.email, values.password);
    } catch (error) {
      // Error is handled in the auth context
    }
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={2} style={{ marginBottom: '8px' }}>
            Welcome Back
          </Title>
          <Text type="secondary">
            Sign in to your AI Study Group account
          </Text>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          autoComplete="off"
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email!' },
              { type: 'email', message: 'Please enter a valid email!' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Enter your email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter your password!' },
              { min: 6, message: 'Password must be at least 6 characters!' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter your password"
            />
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>Remember me</Checkbox>
              </Form.Item>
              <Link href="#" style={{ color: '#1890ff' }}>
                Forgot password?
              </Link>
            </div>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              style={{ height: '48px', fontSize: '16px' }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            Don't have an account?{' '}
            <Link onClick={onSwitchToRegister} style={{ color: '#1890ff' }}>
              Sign up now
            </Link>
          </Text>
        </div>
      </Space>
    </div>
  );
};