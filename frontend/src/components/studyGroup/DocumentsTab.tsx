import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Popconfirm, Empty, Spin, Tooltip, Tag, Card } from 'antd';
import { DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { studyGroupService } from '../../services/studyGroup.service';
import type { ColumnsType } from 'antd/es/table';
import { useTheme } from '../../hooks/useTheme';

interface Document {
  id: number;
  filename: string;
  file_type: string;
  file_size: number;
  created_at: string;
  uploader: {
    id: string;
    username: string;
  };
}

interface DocumentsTabProps {
  groupId: number;
  isAdmin: boolean;
  currentUserId: string;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({
  groupId,
  isAdmin,
  currentUserId,
}) => {
  const { isDark } = useTheme();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [groupId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await studyGroupService.getGroupDocuments(groupId);
      setDocuments(docs);
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (documentId: number) => {
    try {
      setDeleting(documentId);
      await studyGroupService.deleteDocument(groupId, documentId);
      message.success('Document deleted successfully');
      setDocuments(documents.filter((d) => d.id !== documentId));
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to delete document');
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
    );
  };

  const columns: ColumnsType<Document> = [
    {
      title: 'Filename',
      dataIndex: 'filename',
      key: 'filename',
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text.length > 25 ? text.substring(0, 25) + '...' : text}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'file_type',
      key: 'file_type',
      width: 80,
      render: (type: string) => <Tag>{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Size',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: 'Uploaded By',
      dataIndex: ['uploader', 'username'],
      key: 'uploader',
      width: 120,
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          {(isAdmin || record.uploader.id === currentUserId) && (
            <Popconfirm
              title="Delete Document"
              description="Are you sure you want to delete this document?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                icon={<DeleteOutlined />}
                danger
                size="small"
                loading={deleting === record.id}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (loading) {
    return <Spin />;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card
       style={{
          boxShadow: isDark
            ? '0 2px 8px rgba(0, 0, 0, 0.45)'
            : '0 2px 8px rgba(0, 0, 0, 0.2)',
          border: isDark ? '1px solid #434343' : '1px solid #9fa1a3ff',
          borderRadius: '8px',
        }}>
        {documents.length === 0 ? (
          <Empty description="No documents uploaded yet" />
        ) : (
          <Table
            dataSource={documents}
            columns={columns}
            rowKey="id"
            pagination={false}
            bordered
            style={{
              // Custom table styling
              borderRadius: '8px',
              overflow: 'hidden',
            }}
            className={isDark ? 'dark-table' : 'light-table'}
            // Add custom component styling
            components={{
              header: {
                cell: (props: any) => (
                  <th
                    {...props}
                    style={{
                      background: isDark ? '#2b2d31' : '#f5f7f9',
                      fontWeight: 600,
                      borderBottom: isDark
                        ? '2px solid #434343'
                        : '2px solid #d1d3d6',
                      ...props.style,
                    }}
                  />
                ),
              },
            }}
          />
        )}
      </Card>

      {/* Custom table CSS */}
      <style>{`
        .light-table .ant-table {
          border: 1px solid #bebfc0ff;
        }
        .light-table .ant-table-thead > tr > th {
          background: #f5f7f9 !important;
          border-bottom: 2px solid #6f7070ff !important;
          font-weight: 600;
        }
        .light-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #b0b0b1ff;
        }
        .light-table .ant-table-tbody > tr:hover > td {
          background: #f9fafb !important;
        }
        
        .dark-table .ant-table {
          border: 1px solid #434343;
        }
        .dark-table .ant-table-thead > tr > th {
          background: #2b2d31 !important;
          border-bottom: 2px solid #434343 !important;
          font-weight: 600;
        }
        .dark-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #3a3c40;
        }
      `}</style>

    </div>
  );
};
