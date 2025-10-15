import React from 'react';
import { Spin, Space } from 'antd';

interface LoadingSpinnerProps {
  size?: 'small' | 'default' | 'large';
  tip?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'large', 
  tip = 'Loading...' 
}) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        width: '100%',
      }}
    >
      <Space direction="vertical" align="center">
        <Spin size={size} tip={tip} />
      </Space>
    </div>
  );
};