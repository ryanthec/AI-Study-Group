import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { Input, Button, Card, Avatar, Typography, Space, Tag, Spin, Tooltip, Segmented, Divider, message, notification, Modal, Popover, List, Empty} from 'antd';
import {
  SendOutlined, UserOutlined, RobotOutlined, PaperClipOutlined, LoadingOutlined, FileTextOutlined, BulbOutlined, ReadOutlined, 
  CloseOutlined, CopyOutlined, UploadOutlined, FilePdfOutlined, FileWordOutlined, FileOutlined, FileUnknownOutlined, TrophyOutlined,
  PlusOutlined
} from '@ant-design/icons';

import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { studyGroupService } from '../../services/studyGroup.service';
import { chatService } from '../../services/chat.service';
import { quizService, Quiz } from '../../services/quiz.service';
import { agentConfigService, AgentConfig } from '../../services/agentConfig.service';
import type { ChatMessage } from '../../types/message.types';

const { Text, Paragraph } = Typography;

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

interface PendingAttachment {
    id: string;
    type: 'file' | 'quiz';
    title: string;
    data: any; // File object or Quiz object
    icon?: React.ReactNode;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ groupId, onOnlineUsersUpdate }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Chat mode state and ref
  const [chatMode, setChatMode] = useState<'public' | 'private'>('public'); // 'public' = Group Chat, 'private' = My Tutor
  const chatModeRef = useRef(chatMode);

  // Sync Ref with State
  useEffect(() => {
    chatModeRef.current = chatMode;
  }, [chatMode]);


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

  // Pending Attachments State
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  // Modals & Menus
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);

  // useStates for Summary
  const [showSummaryPrompt, setShowSummaryPrompt] = useState(false);
  const [missedCount, setMissedCount] = useState(0);
  const [isSummarising, setIsSummarising] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);

  // refs for WebSocket and connection state
  const wsRef = useRef<WebSocket | null>(null);
  const readyRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

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
    activeSocratic: '#722ed1',
    chipBg: isDark ? '#2b2d31' : '#e6e6e6',
  };

  const isOpen = () => readyRef.current;

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });


  // WEBSOCKET CONNECTION
  useEffect(() => {
    let cancelled = false;

    if (!wsRef.current) {
      const ws = chatService.connectWebSocket(groupId);
      wsRef.current = ws;
      readyRef.current = false;

      ws.onopen = () => {
        if (cancelled) return;
        readyRef.current = true;
        setConnected(true);
        ws.send(JSON.stringify({ type: 'client_ready' }));
      };

      ws.onmessage = (e) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(e.data);
          
          if (data.type === 'online_users_update') {
            onOnlineUsersUpdate?.(data.users);
            return;
          }

          if (data.type === 'ai_typing') {
            setStreamingMessage({
              id: `streaming_${Date.now()}`,
              username: 'TeachingAI',
              content: '',
              isStreaming: true,
            });
            return;
          }
          
          if (data.type === 'ai_stream') {
            setStreamingMessage((prev) => {
              if (!prev) return null;
              return { ...prev, content: prev.content + data.content };
            });
            setTimeout(() => scrollToBottom(), 0);
            return;
          }

          if (data.type === 'ai_error') {
            setStreamingMessage(null);
            message.error(data.content);
            return;
          }

          // Filtering logic
          if (data.type === 'ai_complete' || !data.type) {
            const msg: ChatMessage = data.type === 'ai_complete' ? data.message : data;
            
            // Check the REF (always fresh) against the message type
            const currentMode = chatModeRef.current;
            const msgIsPrivate = msg.is_private === true;
            const viewIsPrivate = currentMode === 'private';

            // Only add to state if it belongs in the current view
            if (msgIsPrivate === viewIsPrivate) {
               setMessages((prev) => [...prev, msg]);
            }

            if (data.type === 'ai_complete') {
              setStreamingMessage(null);
            }
          }
        } catch {}
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
  }, [groupId]);


  // ====== EFFECT: FETCH HISTORY (RUNS ON MODE TOGGLE) ======
  // This handles switching the view between Public and Private
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        // Clear messages immediately to avoid ghosting
        setMessages([]); 
        
        // Fetch new history for the selected mode
        const history = await chatService.getMessages(groupId, 100, 0, chatMode);
        setMessages(history);

        // Load config if needed
        const config = await agentConfigService.getAgentConfig(groupId);
        setAgentConfig(config);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [groupId, chatMode]);



  // useEffect to check missed messages on mount
  useEffect(() => {
    const checkMissed = async () => {
      try {
        const data = await chatService.getMissedCount(groupId);
        if (data.missed_count > 30) {
          setMissedCount(data.missed_count);
          setShowSummaryPrompt(true);
        } else {
          // If count is low, just update "viewed" status immediately
          await chatService.updateLastViewed(groupId);
        }
      } catch (e) {
        console.error("Failed to check missed messages", e);
      }
    };
    checkMissed();

    return () => {
        chatService.updateLastViewed(groupId).catch(() => {});
    };
  }, [groupId]);


  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  // ====== TA Agent Config Toggle Handlers ======

  const toggleRag = async () => {
      if (!agentConfig || configLoading) return;
      const isCurrentlyDocuments = agentConfig.rag_mode === 'documents_only';
      const newMode = isCurrentlyDocuments ? 'disabled' : 'documents_only';
      
      const previousConfig = { ...agentConfig };
      setAgentConfig({ 
        ...agentConfig, 
        rag_enabled: newMode === 'documents_only', 
        rag_mode: newMode 
      });
      
      try {
        setConfigLoading(true);
        await agentConfigService.updateRagMode(groupId, newMode);
        message.success(newMode === 'documents_only' ? "Documents enabled in prompt" : "Documents disabled");
      } catch (error) {
        setAgentConfig(previousConfig);
        message.error("Failed to update RAG settings");
      } finally {
        setConfigLoading(false);
      }
    };

  const toggleSocratic = async () => {
    if (!agentConfig || configLoading) return;
    const newState = !agentConfig.socratic_prompting;

    const previousConfig = { ...agentConfig };
    setAgentConfig({ ...agentConfig, socratic_prompting: newState });

    try {
      setConfigLoading(true);
      await agentConfigService.updateSocraticMode(groupId, newState);
      message.success(newState ? "Learning mode enabled" : "Learning mode disabled");
    } catch (error) {
      setAgentConfig(previousConfig);
      message.error("Failed to update Learning mode");
    } finally {
      setConfigLoading(false);
    }
  };

  // ====== INPUT HANDLERS ======

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

  // ====== SEND HANDLER ======
  const handleSend = async () => {
    const text = inputValue.trim();
    if ((!text && attachments.length === 0) || !connected) return;

    const ws = wsRef.current;
    if (!ws || !isOpen()) return;

    if (attachments.length > 0) setUploading(true);

    try {
        // --- PRIVATE MODE: Send Structured Context ---
        if (chatMode === 'private') {
            const tempContext: Array<{ title: string; content: string }> = [];
            let quizAttemptId: number | undefined = undefined;
            let displayContent = text; // This is what shows in the chat bubble

            // Process Attachments
            for (const att of attachments) {
                if (att.type === 'file') {
                    // Add to HIDDEN context array
                    tempContext.push({
                        title: att.title,
                        content: att.data as string
                    });
                    // Add a small tag to the visible message, but NOT the full text
                    displayContent = `[Attached: ${att.title}]\n${displayContent}`;
                } 
                else if (att.type === 'quiz') {
                    quizAttemptId = att.data as number;
                    displayContent = `[Reviewing Quiz: ${att.title}]\n${displayContent}`;
                }
            }

            // Send via Service (Handles JSON construction)
            chatService.sendMessage(ws, displayContent.trim(), 'private', quizAttemptId, tempContext);
        } 
        
        // --- PUBLIC MODE: Simple Text Send ---
        else {
            // Note: Attachments should be empty here because we block adding them in Public mode
            chatService.sendMessage(ws, text, 'public');
        }

        setInputValue('');
        setAttachments([]);
        
    } catch (error) {
        message.error("Failed to send message");
    } finally {
        setUploading(false);
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && inputValue.match(/^@\w+\s$/)) {
      e.preventDefault();
      setInputValue('');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { message.error('File size exceeds 10MB limit'); return; }
    
    // 1. PUBLIC MODE: Upload to Shared Documents (Old Workflow)
    if (chatMode === 'public') {
        setUploading(true);
        setIsAttachMenuOpen(false);
        try {
            await studyGroupService.uploadDocument(groupId, file);
            message.success(`Document "${file.name}" uploaded to group files`);
            // Optional: You could send a chat message saying "I uploaded a file"
        } catch (error) {
            message.error("Failed to upload document");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
        return;
    }

    // 2. PRIVATE MODE: Extract Context (New Workflow)
    // Only show chips in private mode
    setUploading(true);
    setIsAttachMenuOpen(false);

    try {
        const result = await chatService.extractContext(file);
        
        let icon = <FileUnknownOutlined />;
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.pdf')) icon = <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
        else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) icon = <FileWordOutlined style={{ color: '#1890ff' }} />;
        else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) icon = <FileTextOutlined style={{ color: '#52c41a' }} />;

        const newAttachment: PendingAttachment = {
            id: `file_${Date.now()}`,
            type: 'file',
            title: file.name,
            data: result.content, // EXTRACTED TEXT
            icon: icon
        };
        
        setAttachments(prev => [...prev, newAttachment]);
    } catch (error) {
        message.error("Failed to process file context");
    } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ====== HANDLE QUIZ SELECTION ======
  const handleShareQuiz = (quiz: Quiz) => {
    if (!quiz.latest_attempt) return;
    
    const newAttachment: PendingAttachment = {
        id: `quiz_${quiz.id}`,
        type: 'quiz',
        title: quiz.title,
        data: quiz.latest_attempt.id,
        icon: <TrophyOutlined style={{ color: '#faad14' }} />
    };
    setAttachments(prev => [...prev, newAttachment]);
    setIsQuizModalOpen(false);
  };
  

  // Helper to remove attachment
  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const openQuizModal = async () => {
    setIsAttachMenuOpen(false); setIsQuizModalOpen(true); setQuizzesLoading(true);
    try {
        const allQuizzes = await quizService.getGroupQuizzes(groupId);
        const attempted = allQuizzes.filter(q => q.latest_attempt && q.latest_attempt.completed_at);
        setAvailableQuizzes(attempted);
    } catch { message.error("Failed to load quizzes"); } finally { setQuizzesLoading(false); }
  };


  // ====== RENDERING HELPERS ======

  const preprocessContent = (content: string) => {
    if (!content) return '';
    let processed = content.replace(/\n/g, '  \n');
    return processed.replace(/\n\s*\n/g, '\n\n&#8203;\n\n');
  };

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

  // ====== SUMMARY HANDLERS ======

  const handleGenerateSummary = async () => {
    setIsSummarising(true);
    try {
      const result = await chatService.summariseMissed(groupId);
      setSummaryText(result.summary);
      setShowSummaryPrompt(false); 
      await chatService.updateLastViewed(groupId);
    } catch (e) {
      message.error("Failed to generate summary");
    } finally {
      setIsSummarising(false);
    }
  };

  const handleDismissSummary = () => {
    setShowSummaryPrompt(false);
    setSummaryText(null);
    chatService.updateLastViewed(groupId);
  };

  const handleCopySummary = () => {
    if (summaryText) {
        navigator.clipboard.writeText(summaryText);
        message.success("Summary copied to clipboard!");
    }
  };



  // ====== ATTACHMENT MENU UI ======
  const attachmentMenu = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
        <Button 
            type="text" 
            icon={<FileOutlined />} 
            style={{ textAlign: 'left', justifyContent: 'flex-start' }}
            onClick={() => fileInputRef.current?.click()}
        >
            Upload File
        </Button>
        <Tooltip title={chatMode === 'public' ? "Switch to 'My Tutor' mode to share quiz results" : ""}>
            <Button 
                type="text" 
                icon={<TrophyOutlined />} 
                style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                disabled={chatMode !== 'private'}
                onClick={openQuizModal}
            >
                Share Quiz Results
            </Button>
        </Tooltip>
    </div>
  );


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '400px', maxHeight: '100%', background: colors.chatBg }}>
      
      {/* ====== TOGGLE HEADER ====== */}
      <div style={{ 
        padding: '10px 16px', 
        borderBottom: `1px solid ${colors.border}`, 
        background: colors.messageBg, 
        display: 'flex', 
        justifyContent: 'center',
        flexShrink: 0 
      }}>
        <Segmented
          options={[
            { label: 'Group Chat', value: 'public', icon: <UserOutlined /> },
            { label: 'My Tutor', value: 'private', icon: <RobotOutlined /> },
          ]}
          value={chatMode}
          onChange={(val) => setChatMode(val as 'public' | 'private')}
          block
          style={{ maxWidth: 300 }}
        />
      </div>

      {/* Status bar */}
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${colors.border}`, background: colors.messageBg, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
            {chatMode === 'public' ? (
                <>
                    <Text type="secondary" style={{ fontSize: '16px', color: colors.secondaryText }}>No messages yet. Start the conversation!</Text>
                    <Text type="secondary" style={{ fontSize: '14px', color: colors.secondaryText, marginTop: 8 }}>Type <Tag>@TeachingAI</Tag> to ask the AI assistant</Text>
                </>
            ) : (
                <>
                    <RobotOutlined style={{ fontSize: '40px', color: '#7289da', marginBottom: 16 }} />
                    <Text type="secondary" style={{ fontSize: '16px', color: colors.secondaryText }}>This is your private space.</Text>
                    <Text type="secondary" style={{ fontSize: '14px', color: colors.secondaryText, marginTop: 8 }}>Ask me anything! Your group members won't see this.</Text>
                </>
            )}
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


      {/* SUMMARY NOTIFICATION PROMPT*/}
      {showSummaryPrompt && chatMode === 'public' && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          right: '24px',
          zIndex: 1000,
          width: '300px'
        }}>
          <Card 
            size="small" 
            title={
                <Space>
                    <ReadOutlined style={{ color: '#1890ff' }} />
                    <Text strong>Welcome Back!</Text>
                </Space>
            }
            extra={<Button type="text" size="small" icon={<CloseOutlined />} onClick={handleDismissSummary} />}
            style={{ 
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                background: isDark ? '#1f1f1f' : '#fff',
                borderColor: isDark ? '#434343' : '#f0f0f0'
            }}
          >
            <Paragraph style={{ margin: 0, color: colors.otherText }}>
              You missed <strong>{missedCount}</strong> messages while you were away.
            </Paragraph>
            <Button 
              type="primary" 
              block 
              style={{ marginTop: '12px' }} 
              onClick={handleGenerateSummary}
              loading={isSummarising}
            >
              Summarize Conversation
            </Button>
          </Card>
        </div>
      )}

      {/* SUMMARY RESULT MODAL */}
      <Modal
        title={<Space><TrophyOutlined style={{ color: '#faad14' }} /> Select a Quiz to Review</Space>}
        open={isQuizModalOpen}
        onCancel={() => setIsQuizModalOpen(false)}
        footer={null}
        width={500}
      >
        {quizzesLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Spin /></div> : availableQuizzes.length === 0 ? <Empty description="No completed quizzes found" /> : (
            <List
                dataSource={availableQuizzes}
                renderItem={(quiz) => (
                    <List.Item>
                        <Card hoverable style={{ width: '100%', cursor: 'pointer', borderColor: colors.border, background: isDark ? '#1f1f1f' : '#fff' }} 
                          onClick={() => handleShareQuiz(quiz)} bodyStyle={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <Text strong style={{ color: colors.otherText, display: 'block' }}>
                                    {quiz.title}
                                  </Text>

                                  <Text type="secondary" style={{ fontSize: '12px' }}>
                                    Completed: {new Date(quiz.latest_attempt?.completed_at || '').toLocaleDateString()}
                                    </Text>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <Tag color={quiz.latest_attempt?.passed ? 'green' : 'red'}>
                                    {quiz.latest_attempt?.score}/{quiz.latest_attempt?.total_questions}
                                    </Tag>
                                </div>
                            </div>
                        </Card>
                    </List.Item>
                )}
            />
        )}
      </Modal>

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

        {/* Attachment Chips Container */}
        {attachments.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', paddingBottom: '12px', overflowX: 'auto' }}>
                {attachments.map(att => (
                    <div key={att.id} style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', 
                        background: colors.chipBg, padding: '4px 8px', borderRadius: '8px',
                        border: `1px solid ${colors.border}`, fontSize: '12px'
                    }}>
                        {att.icon}
                        <Text style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: colors.otherText }}>
                            {att.title}
                        </Text>
                        <Button 
                            type="text" size="small" icon={<CloseOutlined style={{ fontSize: '10px' }} />} 
                            onClick={() => removeAttachment(att.id)}
                            style={{ width: '16px', height: '16px', minWidth: '16px', color: colors.secondaryText, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        />
                    </div>
                ))}
            </div>
        )}

        {/* Input Container */}
        <div style={{ background: colors.inputBg, borderRadius: '8px', border: `1px solid ${colors.inputBorder}`, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} style={{ display: 'none' }} accept=".pdf,.txt,.docx,.doc,.md" />
          
          {/* Attachment menu */}
          <Popover 
            content={attachmentMenu} 
            trigger="click" 
            open={isAttachMenuOpen} 
            onOpenChange={setIsAttachMenuOpen}
            placement="topLeft"
            overlayStyle={{ padding: 0 }}
          >
            <Tooltip title="Attachments">
                <Button 
                    type="text" 
                    icon={uploading ? <LoadingOutlined /> : <PlusOutlined style={{ fontSize: '16px', color: colors.secondaryText }} />} 
                    disabled={uploading} 
                    style={{ 
                        borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isAttachMenuOpen ? (isDark ? '#4f545c' : '#e3e5e8') : 'transparent'
                    }} 
                />
            </Tooltip>
          </Popover>


          {/* Vertical Divider */}
          <Divider type="vertical" style={{ height: '20px', borderColor: colors.border }} />

          {/* RAG Toggle */}
          <Tooltip title={agentConfig?.rag_enabled ? "Disable documents" : "Use documents in prompt"}>
            <Button 
              type="text" 
              icon={<FileTextOutlined />} 
              onClick={toggleRag} 
              loading={configLoading}
              style={{ 
                color: agentConfig?.rag_enabled ? '#fff' : colors.secondaryText,
                backgroundColor: agentConfig?.rag_enabled ? colors.activeRag : 'transparent',
                borderRadius: '6px',
                padding: '4px 8px',
                transition: 'all 0.2s'
              }} 
            />
          </Tooltip>

          {/* Socratic Toggle */}
          <Tooltip title={agentConfig?.socratic_prompting ? "Disable learning mode" : "Enable learning mode"}>
            <Button 
              type="text" 
              icon={<BulbOutlined />} 
              onClick={toggleSocratic} 
              loading={configLoading}
              style={{ 
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
            placeholder={chatMode === 'private' ? "Ask your private AI tutor..." : `Message #${groupId} (Type @ to mention TeachingAI)`}
            variant="borderless"
            autoSize={{ minRows: 1, maxRows: 3 }}
            style={{ flex: 1, background: 'transparent', color: colors.otherText, fontSize: '15px', padding: '11px 0', resize: 'none' }}
          />
        
          <Button type="text" icon={<SendOutlined />} onClick={handleSend} disabled={!connected || !inputValue.trim()} style={{ color: inputValue.trim() ? colors.ownBubble : colors.secondaryText, padding: '4px 8px' }} />
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .chat-markdown p {
          margin-bottom: 6px; 
        }
        .chat-markdown p:last-child {
          margin-bottom: 0; 
        }
      `}</style>
    </div>
  );
};