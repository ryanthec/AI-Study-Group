import React, { useEffect, useState, useRef } from 'react';
import { Input, Button, Avatar, Typography, Space, Tag, Spin } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, PaperClipOutlined, LoadingOutlined } from '@ant-design/icons';
import { message } from 'antd';


import { chatService } from '../../services/chat.service';
import { useAuth } from '../../hooks/useAuth';
import type { ChatMessage } from '../../types/message.types';
import { studyGroupService } from '../../services/studyGroup.service';

const { Text } = Typography;

interface ChatBoxProps { groupId: number; }

export const ChatBox: React.FC<ChatBoxProps> = ({ groupId }) => {
  const { user } = useAuth();

  // states for messages and connection
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // useStates & refs for document file upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // refs for WebSocket and connection state
  const wsRef = useRef<WebSocket | null>(null);
  const readyRef = useRef(false); // single source of truth for OPEN
  const messagesEndRef = useRef<HTMLDivElement>(null);



  const isOpen = () => readyRef.current;   // gate send on this

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // useEffect to load message history and setup WebSocket
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const history = await chatService.getMessages(groupId);
        if (!cancelled) setMessages(history);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    // open a single socket per group
    if (!wsRef.current) {
      const ws = chatService.connectWebSocket(groupId);
      wsRef.current = ws;
      readyRef.current = false;

      ws.onopen = () => {
        readyRef.current = true;
        setConnected(true);
      };

      ws.onmessage = (e) => {
        try {
          const msg: ChatMessage = JSON.parse(e.data);
          setMessages((prev) => [...prev, msg]);
        } catch { /* ignore malformed frames */ }
      };

      ws.onerror = () => {
        readyRef.current = false;
        setConnected(false);
      };

      ws.onclose = () => {
        readyRef.current = false;
        setConnected(false);
        wsRef.current = null;
      };
    }

    return () => {
      cancelled = true;
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
      readyRef.current = false;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]); // StrictMode will mount/unmount twice in dev

  useEffect(() => { scrollToBottom(); }, [messages]);


  // Handle sending messages
  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    const ws = wsRef.current;
    if (!ws || !isOpen()) {
      // message.warning('Not connected yet, please wait');
      return;
    }
    try {
      chatService.sendMessage(ws, text);
      setInputValue('');
    } catch {
      // message.error('Failed to send message');
    }
  };

  // Handle key down for input (send on Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Render a single message
  const renderMessage = (message: ChatMessage) => {
    const isOwn = message.user?.id === user?.id;
    const isSystem = message.message_type === 'system';
    const isAI = message.message_type === 'ai_response';

    if (isSystem) {
      return (
        <div key={message.id} style={{ textAlign: 'center', margin: '12px 0' }}>
          <Tag color="blue">{message.content}</Tag>
        </div>
      );
    }

    return (
      <div
        key={message.id}
        style={{
          display: 'flex',
          flexDirection: isOwn ? 'row-reverse' : 'row',
          marginBottom: 16,
          gap: 8,
        }}
      >
        <Avatar
          icon={isAI ? <RobotOutlined /> : <UserOutlined />}
          src={message.user?.avatar}
          style={{ flexShrink: 0 }}
        />
        <div style={{ maxWidth: '70%' }}>
          {!isOwn && (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              {message.user?.username}
            </Text>
          )}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: isOwn ? '#1890ff' : isAI ? '#f0f0f0' : '#e6f7ff',
              color: isOwn ? '#fff' : '#000',
              wordBreak: 'break-word',
            }}
          >
            <Text style={{ color: isOwn ? '#fff' : '#000' }}>{message.content}</Text>
          </div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
            {new Date(message.created_at).toLocaleTimeString()}
          </Text>
        </div>
      </div>
    );
  };


  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      message.error('File size exceeds 10MB limit');
      return;
    }

    const allowedExtensions = ['.pdf', '.txt', '.docx', '.doc', '.md'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      message.error(`Unsupported file format. Allowed: ${allowedExtensions.join(', ')}`);
      return;
    }

    setUploading(true);
    try {
      await studyGroupService.uploadDocument(groupId, file);
      message.success(`Document "${file.name}" uploaded successfully`);
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Status */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Space>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connected ? '#52c41a' : '#ff4d4f',
            }}
          />
          <Text type="secondary">{connected ? 'Connected' : 'Disconnected'}</Text>
        </Space>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#fafafa' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Text type="secondary">No messages yet. Start the conversation!</Text>
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: 16, borderTop: '1px solid #f0f0f0', background: '#fff' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!connected}
            size="large"
          />
          {/* Send button */}
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!connected || !inputValue.trim()}
            size="large"
          >
            Send
          </Button>

          {/* File upload */}
          <div style={{ marginTop: '8px' }}>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              accept=".pdf,.txt,.docx,.doc,.md"
            />
            <Button
              icon={uploading ? <LoadingOutlined /> : <PaperClipOutlined />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              loading={uploading}
            >
              Attach Document
            </Button>
          </div>
        </Space.Compact>
      </div>
    </div>
  );
};
