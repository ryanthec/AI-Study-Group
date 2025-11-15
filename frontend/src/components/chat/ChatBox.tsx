import React, { useEffect, useState, useRef } from 'react';
import { Input, Button, Avatar, Typography, Space, Tag, Spin, Tooltip } from 'antd';
import {
  SendOutlined,
  UserOutlined,
  RobotOutlined,
  PaperClipOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { message } from 'antd';

import { chatService } from '../../services/chat.service';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import type { ChatMessage } from '../../types/message.types';
import { studyGroupService } from '../../services/studyGroup.service';

const { Text } = Typography;

interface ChatBoxProps {
  groupId: number;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ groupId }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

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
  const readyRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isOpen = () => readyRef.current;

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

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
        } catch {
          /* ignore malformed frames */
        }
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
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
      readyRef.current = false;
      setConnected(false);
    };
  }, [groupId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle sending messages
  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    const ws = wsRef.current;
    if (!ws || !isOpen()) {
      return;
    }
    try {
      chatService.sendMessage(ws, text);
      setInputValue('');
    } catch {}
  };

  // Handle key down for input (send on Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Dynamic color definitions (Inspired by Discord Themes)
  const colors = {
    // Main backgrounds
    messageBg: isDark ? '#313338' : '#ffffff',
    chatBg: isDark ? '#313338' : '#f2f3f5',
    inputBg: isDark ? '#383a40' : '#ffffff',
    
    // Message bubbles
    ownBubble: isDark ? '#5865f2' : '#5865f2',
    otherBubble: isDark ? '#2b2d31' : '#e3e5e8',
    aiBubble: isDark ? '#2b2d31' : '#f2f3f5',
    
    // Text
    ownText: '#ffffff',
    otherText: isDark ? '#dbdee1' : '#313338',
    secondaryText: isDark ? '#949ba4' : '#4e5058',
    
    // Borders
    border: isDark ? '#1e1f22' : '#e3e5e8',
    inputBorder: isDark ? '#1e1f22' : '#d0d1d4',
    
    // Status indicator
    onlineGreen: '#23a559',
    offlineRed: '#f23f43',
  };

  // Render a single message
  const renderMessage = (msg: ChatMessage) => {
    const isOwn = msg.user?.id === user?.id;
    const isSystem = msg.message_type === 'system';
    const isAI = msg.message_type === 'ai_response';

    if (isSystem) {
      return (
        <div
          key={msg.id}
          style={{
            textAlign: 'center',
            margin: '8px 0',
            padding: '4px 0',
          }}
        >
          <Tag
            color={isDark ? 'blue' : 'blue'}
            style={{
              borderRadius: '12px',
              padding: '4px 12px',
              fontSize: '12px',
            }}
          >
            {msg.content}
          </Tag>
        </div>
      );
    }

    // ✅ Discord-style message layout
    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          flexDirection: 'row',
          padding: '4px 16px',
          marginTop: '4px',
          gap: 12,
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = isDark ? '#2e3035' : '#f9f9f9')
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = 'transparent')
        }
      >
        {/* Avatar */}
        <div style={{ flexShrink: 0, marginTop: '4px' }}>
          <Avatar
            size={40}
            icon={isAI ? <RobotOutlined /> : <UserOutlined />}
            src={msg.user?.avatar}
            style={{
              backgroundColor: isAI
                ? '#7289da'
                : isOwn
                ? colors.ownBubble
                : '#99aab5',
            }}
          />
        </div>

        {/* Message content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header: username + timestamp */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginBottom: 2,
            }}
          >
            <Text
              strong
              style={{
                fontSize: '15px',
                color: isOwn
                  ? colors.ownBubble
                  : isAI
                  ? '#7289da'
                  : isDark
                  ? '#f2f3f5'
                  : '#313338',
              }}
            >
              {isAI ? 'AI Assistant' : msg.user?.username || 'Unknown'}
            </Text>
            <Text
              type="secondary"
              style={{
                fontSize: '11px',
                color: colors.secondaryText,
              }}
            >
              {new Date(msg.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </div>

          {/* Message text */}
          <div
            style={{
              fontSize: '15px',
              lineHeight: '1.375rem',
              color: colors.otherText,
              wordWrap: 'break-word',
            }}
          >
            {msg.content}
          </div>
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
    const hasValidExtension = allowedExtensions.some((ext) =>
      fileName.endsWith(ext)
    );

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '400px', // Minimum height when no messages
        maxHeight: '100%', // Prevent growing beyond container
        background: colors.chatBg,
      }}
    >
      {/* Status bar */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.messageBg,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? colors.onlineGreen : colors.offlineRed,
          }}
        />
        <Text style={{ fontSize: '14px', color: colors.secondaryText }}>
          {connected ? 'Connected' : 'Disconnected'}
        </Text>
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto', // Only this section scrolls
          overflowX: 'hidden',
          background: colors.messageBg,
          minHeight: 0,
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '300px',
            }}
          >
            <Spin size="large" />
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '300px',
              padding: 40,
            }}
          >
            <Text
              type="secondary"
              style={{ fontSize: '16px', color: colors.secondaryText }}
            >
              No messages yet. Start the conversation!
            </Text>
          </div>
        ) : (
          <>
            <div style={{ paddingTop: 16, paddingBottom: 16 }}>
              {messages.map(renderMessage)}
            </div>
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area - fixed at bottom */}
      <div
        style={{
          padding: '16px',
          background: colors.messageBg,
          borderTop: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: colors.inputBg,
            borderRadius: '8px',
            border: `1px solid ${colors.inputBorder}`,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept=".pdf,.txt,.docx,.doc,.md"
          />
          <Tooltip title="Attach document">
            <Button
              type="text"
              icon={uploading ? <LoadingOutlined /> : <PaperClipOutlined />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                color: colors.secondaryText,
                padding: '4px 8px',
              }}
            />
          </Tooltip>

          <Input
            placeholder={`Type Message`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!connected}
            variant = "borderless"
            style={{
              background: 'transparent',
              color: colors.otherText,
              fontSize: '15px',
              padding: '11px 0',
            }}
          />

          <Button
            type="text"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!connected || !inputValue.trim()}
            style={{
              color: inputValue.trim() ? colors.ownBubble : colors.secondaryText,
              padding: '4px 8px',
            }}
          />
        </div>
      </div>
    </div>
  );
};
