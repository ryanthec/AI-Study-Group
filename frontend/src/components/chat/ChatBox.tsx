import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { Input, Button, Avatar, Typography, Space, Tag, Spin, Tooltip, AutoComplete, Divider} from 'antd';
import {
  SendOutlined,
  UserOutlined,
  RobotOutlined,
  PaperClipOutlined,
  LoadingOutlined,
  FileTextOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { message } from 'antd';

import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { studyGroupService } from '../../services/studyGroup.service';
import { chatService } from '../../services/chat.service';
import { agentConfigService, AgentConfig } from '../../services/agentConfig.service';
import type { ChatMessage } from '../../types/message.types';

const { Text } = Typography;

interface ChatBoxProps {
  groupId: number;
  onOnlineUsersUpdate?: (users: any[]) => void;
}

interface StreamingMessage {
  id: string;
  username: string;
  content: string;
  isStreaming: boolean;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ groupId, onOnlineUsersUpdate }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Messages and connection states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // Agent Configuration State
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  // Streaming message state
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);

  // Autocomplete states
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteOptions, setAutocompleteOptions] = useState<{ value: string }[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);

  // useStates & refs for document file upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // refs for WebSocket and connection state
  const wsRef = useRef<WebSocket | null>(null);
  const readyRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  const isOpen = () => readyRef.current;

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });


  // useEffect to load message history and setup WebSocket
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);

        // Load message history
        const history = await chatService.getMessages(groupId);
        if (!cancelled) setMessages(history);

        // Load agent config
        const config = await agentConfigService.getAgentConfig(groupId);
        if (!cancelled) setAgentConfig(config);

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
          const data = JSON.parse(e.data);
          
          if (data.type === 'online_users_update') {
            // Pass the list of users to the parent
            if (onOnlineUsersUpdate) {
              onOnlineUsersUpdate(data.users);
            }
            return;
          }

          // Handle AI typing indicator
          if (data.type === 'ai_typing') {
            setStreamingMessage({
              id: `streaming_${Date.now()}`,
              username: 'TeachingAI',
              content: '',
              isStreaming: true,
            });
            return;
          }
          
          // Handle AI streaming chunks
          if (data.type === 'ai_stream') {
            setStreamingMessage((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                content: prev.content + data.content,
              };
            });
            setTimeout(() => scrollToBottom(), 0);
            return;
          }

          // Handle AI stream complete
          if (data.type === 'ai_complete') {
            const aiMsg: ChatMessage = data.message;
            setMessages((prev) => [...prev, aiMsg]);
            setStreamingMessage(null);
            return;
          }

          // Handle AI error
          if (data.type === 'ai_error') {
            setStreamingMessage(null);
            message.error(data.content);
            return;
          }

          // Handle regular chat messages
          const msg: ChatMessage = data;
          setMessages((prev) => [...prev, msg]);
        } catch {
          // ignore malformed frames
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


  // === TA Agent Config Toggle Handlers ===

  const toggleRag = async () => {
      if (!agentConfig || configLoading) return;
      

      const isCurrentlyDocuments = agentConfig.rag_mode === 'documents_only';
      // Toggle: If ON -> switch to 'disabled'. If OFF -> switch to 'documents_only'.
      const newMode = isCurrentlyDocuments ? 'disabled' : 'documents_only';
      
      // Optimistic update
      const previousConfig = { ...agentConfig };
      setAgentConfig({ 
        ...agentConfig, 
        rag_enabled: newMode === 'documents_only', // Update boolean for UI consistency
        rag_mode: newMode 
      });
      
      try {
        setConfigLoading(true);
        // Calls updateRagMode from service
        await agentConfigService.updateRagMode(groupId, newMode);
        message.success(newMode === 'documents_only' ? "Documents enabled in prompt" : "Documents disabled");
      } catch (error) {
        // Revert on error
        setAgentConfig(previousConfig);
        message.error("Failed to update RAG settings");
      } finally {
        setConfigLoading(false);
      }
    };

  const toggleSocratic = async () => {
    if (!agentConfig || configLoading) return;
    const newState = !agentConfig.socratic_prompting;

    // Optimistic update
    const previousConfig = { ...agentConfig };
    setAgentConfig({ ...agentConfig, socratic_prompting: newState });

    try {
      setConfigLoading(true);
      // Calls updateSocraticMode from service
      await agentConfigService.updateSocraticMode(groupId, newState);
      message.success(newState ? "Learning mode enabled" : "Learning mode disabled");
    } catch (error) {
      // Revert on error
      setAgentConfig(previousConfig);
      message.error("Failed to update Learning mode");
    } finally {
      setConfigLoading(false);
    }
  };

  // ==== INPUT HANDLERS ====

  // Handle input change with @ detection
  const handleInputChange = (value: string) => {
    setInputValue(value);

    // Get cursor position
    const input = inputRef.current?.resizableTextArea?.textArea;

    if (input) {
      const pos = input.selectionStart || 0;
      setCursorPosition(pos);

      // Check if user typed @ and show autocomplete
      const textBeforeCursor = value.substring(0, pos);
      const lastWord = textBeforeCursor.split(/\s/).pop() || '';

      if (lastWord.startsWith('@') && lastWord.length === 1) {
        setAutocompleteOptions([{ value: '@TeachingAI' }]);
        setShowAutocomplete(true);
      } else if (!lastWord.startsWith('@')) {
        setShowAutocomplete(false);
      }
    }
  };

  // Handle autocomplete selection
  const handleAutocompleteSelect = (value: string) => {
    const input = inputRef.current?.resizableTextArea?.textArea;
    if (!input) return;

    const pos = cursorPosition;
    const textBefore = inputValue.substring(0, pos);
    const textAfter = inputValue.substring(pos);

    const words = textBefore.split(/\s/);
    words[words.length - 1] = value;
    const newTextBefore = words.join(' ');

    setInputValue(newTextBefore + ' ' + textAfter);
    setShowAutocomplete(false);
    setTimeout(() => input.focus(), 0);
  };

  // handleSend with "Sticky Mention" logic
  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    const ws = wsRef.current;
    if (!ws || !isOpen()) {
      return;
    }
    try {
      chatService.sendMessage(ws, text);
      
      // Check if the message started with a mention (e.g., "@TeachingAI ...")
      // Regex: Starts with @, followed by characters, space/end
      const mentionMatch = text.match(/^(@\w+)/);
      
      if (mentionMatch) {
        // If it was a mention, keep it for the next message
        setInputValue(`${mentionMatch[1]} `);
      } else {
        // Otherwise clear normally
        setInputValue('');
      }
    } catch {}
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 1. Send on Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // "Atomic" Delete for sticky mentions
    // If the input is EXACTLY a tag + space (e.g. "@TeachingAI "), and user hits Backspace/Delete, clear the whole thing.
    if ((e.key === 'Backspace' || e.key === 'Delete') && inputValue.match(/^@\w+\s$/)) {
      e.preventDefault();
      setInputValue('');
    }
  };

  // Dynamic color definitions
  const colors = {
    messageBg: isDark ? '#313338' : '#ffffff',
    chatBg: isDark ? '#313338' : '#f2f3f5',
    inputBg: isDark ? '#383a40' : '#ffffff',
    ownBubble: isDark ? '#5865f2' : '#5865f2',
    otherBubble: isDark ? '#2b2d31' : '#e3e5e8',
    aiBubble: isDark ? '#2b2d31' : '#f2f3f5',
    ownText: '#ffffff',
    otherText: isDark ? '#dbdee1' : '#313338',
    secondaryText: isDark ? '#949ba4' : '#3e3e41ff',
    border: isDark ? '#1e1f22' : '#e3e5e8',
    inputBorder: isDark ? '#1e1f22' : '#59595aff',
    onlineGreen: '#23a559',
    offlineRed: '#f23f43',
    // Agent Settings Toggle Button Colors
    activeRag: '#1890ff',
    activeSocratic: '#722ed1'
  };


  // Helper to force Markdown to respect vertical spacing
  const preprocessContent = (content: string) => {
    if (!content) return '';
    
    // 1. Replace every newline with a "hard break" (two spaces + newline)
    let processed = content.replace(/\n/g, '  \n');
    
    // 2. Handle multiple consecutive empty lines
    // Markdown collapses multiple breaks. We trick it by inserting a 
    // Zero-Width Space (&#8203;) on empty lines so they aren't collapsed.
    // This regex finds lines that are just whitespace/newlines and keeps them alive.
    return processed.replace(/\n\s*\n/g, '\n\n&#8203;\n\n');
  };

  // Render a single normal message
  const renderMessage = (msg: ChatMessage) => {
    const isOwn = msg.user?.id === user?.id;
    const isSystem = msg.message_type === 'system';
    const isAI = msg.message_type === 'ai_response';

    if (isSystem) {
      return (
        <div key={msg.id} style={{ textAlign: 'center', margin: '8px 0', padding: '4px 0' }}>
          <Tag color={isDark ? 'blue' : 'blue'} style={{ borderRadius: '12px', padding: '4px 12px', fontSize: '12px' }}>
            {msg.content}
          </Tag>
        </div>
      );
    }

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
        onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? '#2e3035' : '#f9f9f9')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ flexShrink: 0, marginTop: '4px' }}>
          <Avatar
            size={40}
            icon={isAI ? <RobotOutlined /> : <UserOutlined />}
            src={msg.user?.avatar}
            style={{ backgroundColor: isAI ? '#7289da' : isOwn ? colors.ownBubble : '#99aab5' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
            <Text
              strong
              style={{
                fontSize: '15px',
                color: isOwn ? colors.ownBubble : isAI ? '#7289da' : isDark ? '#f2f3f5' : '#313338',
              }}
            >
              {isAI ? 'TeachingAI' : msg.user?.username || 'Unknown'}
            </Text>

            {isAI && (
               <Tag color="purple" style={{ fontSize: '10px', padding: '0 4px' }}>BOT</Tag>
            )}

            <Text type="secondary" style={{ fontSize: '11px', color: colors.secondaryText }}>
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </div>

          <div
            className="chat-markdown"
            style={{
              fontSize: '15px',
              lineHeight: '1.375rem',
              color: colors.otherText,
              wordWrap: 'break-word',
              // whiteSpace: 'pre-wrap', 
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>
              {preprocessContent(msg.content)}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  };

  const renderStreamingMessage = (msg: StreamingMessage) => {
    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          flexDirection: 'row',
          padding: '8px 16px',
          marginTop: '4px',
          gap: 12,
          background: isDark ? 'rgba(46, 48, 53, 0.5)' : 'rgba(249, 249, 249, 0.5)',
          borderRadius: '4px',
        }}
      >
        <div style={{ flexShrink: 0, marginTop: '4px' }}>
          <Avatar size={40} icon={<RobotOutlined />} style={{ backgroundColor: '#7289da' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
            <Text strong style={{ fontSize: '15px', color: '#7289da' }}>TeachingAI</Text>
            <Tag color="purple" style={{ fontSize: '10px', padding: '0 4px' }}>BOT</Tag>
            <LoadingOutlined style={{ color: colors.secondaryText, fontSize: '12px' }} />
          </div>

          <div
            className="chat-markdown"
            style={{
              fontSize: '15px',
              lineHeight: '1.375rem',
              color: colors.otherText,
              wordWrap: 'break-word',
              // whiteSpace: 'pre-wrap',
              minHeight: '20px',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>
              {preprocessContent(msg.content)}
            </ReactMarkdown>
            {msg.isStreaming && (
              <span
                style={{
                  display: 'inline-block',
                  width: '2px',
                  height: '1em',
                  backgroundColor: colors.otherText,
                  marginLeft: '2px',
                  animation: 'blink 1s infinite',
                }}
              />
            )}
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
    const hasValidExtension = allowedExtensions.some((ext) => fileName.endsWith(ext));

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '400px', maxHeight: '100%', background: colors.chatBg }}>
      {/* Status bar */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}`, background: colors.messageBg, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? colors.onlineGreen : colors.offlineRed }} />
        <Text style={{ fontSize: '14px', color: colors.secondaryText }}>{connected ? 'Connected' : 'Disconnected'}</Text>
        {streamingMessage && (
          <>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: colors.secondaryText, margin: '0 4px', animation: 'pulse 1.5s infinite' }} />
            <Text style={{ fontSize: '12px', color: colors.secondaryText, fontStyle: 'italic' }}><RobotOutlined /> TeachingAI is typing...</Text>
          </>
        )}
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: colors.messageBg, minHeight: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}><Spin size="large" /></div>
        ) : messages.length === 0 && !streamingMessage ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', padding: 40 }}>
            <Text type="secondary" style={{ fontSize: '16px', color: colors.secondaryText }}>No messages yet. Start the conversation!</Text>
            <Text type="secondary" style={{ fontSize: '14px', color: colors.secondaryText, marginTop: 8 }}>Type <Tag>@TeachingAI</Tag> to ask the AI assistant</Text>
          </div>
        ) : (
          <>
            <div style={{ paddingTop: 16, paddingBottom: 16 }}>
              {messages.map(renderMessage)}
              {streamingMessage && renderStreamingMessage(streamingMessage)}
            </div>
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div style={{ padding: '16px', background: colors.messageBg, borderTop: `1px solid ${colors.border}`, flexShrink: 0, position: 'relative' }}>
        {showAutocomplete && (
          <div style={{ position: 'absolute', bottom: '100%', left: '16px', right: '16px', background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: '8px 8px 0 0', marginBottom: '-1px', boxShadow: isDark ? '0 -2px 8px rgba(0, 0, 0, 0.45)' : '0 -2px 8px rgba(0, 0, 0, 0.15)', zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
            {autocompleteOptions.map((option) => (
              <div key={option.value} onClick={() => handleAutocompleteSelect(option.value)} onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? '#2e3035' : '#f9f9f9')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} style={{ padding: '12px 16px', cursor: 'pointer', color: colors.otherText, display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s' }}>
                <RobotOutlined style={{ color: '#7289da', fontSize: '16px' }} />
                <Text style={{ color: colors.otherText, fontWeight: 500 }}>TeachingAI</Text>
                <Tag color="purple" style={{ fontSize: '10px', padding: '0 4px', marginLeft: 'auto' }}>BOT</Tag>
              </div>
            ))}
          </div>
        )}

        {/* Input Container */}
        <div style={{ background: colors.inputBg, borderRadius: '8px', border: `1px solid ${colors.inputBorder}`, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} style={{ display: 'none' }} accept=".pdf,.txt,.docx,.doc,.md" />
          
          {/* 1. Attachment Button */}
          <Tooltip title="Attach document">
            <Button type="text" icon={uploading ? <LoadingOutlined /> : <PaperClipOutlined />} onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ color: colors.secondaryText, padding: '4px 8px' }} />
          </Tooltip>

          {/* Vertical Divider between attachments and toggles */}
          <Divider type="vertical" style={{ height: '20px', borderColor: colors.border }} />

          {/* 2. RAG Toggle (Use Documents) */}
          <Tooltip title={agentConfig?.rag_enabled ? "Disable documents" : "Use documents in prompt"}>
            <Button 
              type="text" 
              icon={<FileTextOutlined />} 
              onClick={toggleRag} 
              loading={configLoading}
              style={{ 
                // Active: Solid Blue Background, White Text
                // Inactive: Transparent Background, Secondary Text
                color: agentConfig?.rag_enabled ? '#fff' : colors.secondaryText,
                backgroundColor: agentConfig?.rag_enabled ? colors.activeRag : 'transparent',
                borderRadius: '6px',
                padding: '4px 8px',
                transition: 'all 0.2s'
              }} 
            />
          </Tooltip>

          {/* 3. Socratic Toggle (Learning Mode) */}
          <Tooltip title={agentConfig?.socratic_prompting ? "Disable learning mode" : "Enable learning mode"}>
            <Button 
              type="text" 
              icon={<BulbOutlined />} 
              onClick={toggleSocratic} 
              loading={configLoading}
              style={{ 
                // Active: Solid Purple Background, White Text
                // Inactive: Transparent Background, Secondary Text
                color: agentConfig?.socratic_prompting ? '#fff' : colors.secondaryText,
                backgroundColor: agentConfig?.socratic_prompting ? colors.activeSocratic : 'transparent',
                borderRadius: '6px',
                padding: '4px 8px',
                transition: 'all 0.2s'
              }} 
            />
          </Tooltip>
          
          <Input.TextArea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!connected}
            placeholder={`Message #${groupId} (Type @ to mention TeachingAI)`}
            variant="borderless"
            autoSize={{ minRows: 1, maxRows: 3 }}
            style={{
              flex: 1,
              background: 'transparent',
              color: colors.otherText,
              fontSize: '15px',
              padding: '11px 0',
              resize: 'none',
            }}
          />
        
          <Button type="text" icon={<SendOutlined />} onClick={handleSend} disabled={!connected || !inputValue.trim()} style={{ color: inputValue.trim() ? colors.ownBubble : colors.secondaryText, padding: '4px 8px' }} />
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .chat-markdown p {
          margin-bottom: 6px; /* Adds space between paragraphs */
        }
        .chat-markdown p:last-child {
          margin-bottom: 0; /* Prevents extra space at the bottom of the bubble */
        }
      `}</style>
    </div>
  );
};