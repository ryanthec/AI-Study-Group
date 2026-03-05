import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { Input, Button, Card, Avatar, Typography, Space, Tag, Spin, Tooltip, Segmented, Divider, message, notification, Modal, Popover, List, Empty } from 'antd';
import {
  SendOutlined, UserOutlined, RobotOutlined, PaperClipOutlined, LoadingOutlined, FileTextOutlined, BulbOutlined, ReadOutlined,
  CloseOutlined, CopyOutlined, UploadOutlined, FilePdfOutlined, FileWordOutlined, FileOutlined, FileUnknownOutlined, TrophyOutlined,
  PlusOutlined, EyeInvisibleOutlined
} from '@ant-design/icons';

import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { studyGroupService } from '../../services/studyGroup.service';
import { chatService } from '../../services/chat.service';
import { quizService, Quiz } from '../../services/quiz.service';
import { agentConfigService, AgentConfig } from '../../services/agentConfig.service';
import type { ChatMessage } from '../../types/message.types';
import incognitoIcon from '../../assets/incognito_icon.png';

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

  // Chatmode states and refs
  const [chatMode, setChatMode] = useState<'public' | 'private'>('public');
  const chatModeRef = useRef(chatMode);
  const [transitionStatus, setTransitionStatus] = useState<'idle' | 'scanning'>('idle');

  // Frozen state for the transition overlay
  const [frozenMessages, setFrozenMessages] = useState<ChatMessage[] | null>(null);
  const [frozenMode, setFrozenMode] = useState<'public' | 'private' | null>(null);

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


  // Color generator
  const getColors = (mode: 'public' | 'private') => ({
    // Backgrounds
    chatBg: mode === 'private'
      ? (isDark ? '#000000' : '#d4d4d4')
      : (isDark ? '#313338' : '#f2f3f5'),

    messageBg: mode === 'private'
      ? (isDark ? '#111214' : '#e8e8e8')
      : (isDark ? '#313338' : '#ffffff'),

    // Dynamic input bar color
    inputBg: mode === 'private'
      ? (isDark ? '#1e1f22' : '#bfbfbf') // Darker input for private
      : (isDark ? '#383a40' : '#ffffff'), // Standard for public

    ownBubble: isDark ? '#5865f2' : '#5865f2',
    otherBubble: isDark ? '#2b2d31' : '#e3e5e8',
    aiBubble: isDark ? '#2b2d31' : '#f2f3f5',
    ownText: '#ffffff',
    otherText: isDark ? '#b8b9bbff' : '#313338',
    secondaryText: isDark ? '#949ba4' : '#3e3e41ff',
    border: isDark ? '#1e1f22' : '#e3e5e8',

    // Borders match input bg slightly
    inputBorder: mode === 'private'
      ? (isDark ? '#000000' : '#a6a6a6')
      : (isDark ? '#1e1f22' : '#8c8c8c'),

    onlineGreen: '#23a559',
    offlineRed: '#f23f43',
    activeRag: '#1890ff',
    activeSocratic: '#722ed1',
    chipBg: isDark ? '#2b2d31' : '#e6e6e6',
    placeholder: isDark ? '#8e9297' : '#595959',
    segmentedTrack: isDark ? 'rgba(255,255,255,0.08)' : '#d9d9d9',
  });

  // Current Active Colors
  const colors = getColors(chatMode);

  const isOpen = () => readyRef.current;

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // Scanning mode switch
  const handleModeSwitch = (val: 'public' | 'private') => {
    if (val === chatMode) return;

    // 1. Freeze current state for the "Top Layer"
    setFrozenMessages([...messages]);
    setFrozenMode(chatMode);

    // 2. Switch actual state (Bottom Layer will update immediately)
    setChatMode(val);

    // 3. Trigger Scan Animation
    setTransitionStatus('scanning');

    // 4. Cleanup
    setTimeout(() => {
      setTransitionStatus('idle');
      setFrozenMessages(null);
      setFrozenMode(null);
    }, 1200);
  };


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
              username: 'Bob the Bot',
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
        } catch { }
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
        try { wsRef.current.close(); } catch { }
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
      chatService.updateLastViewed(groupId).catch(() => { });
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
        setAutocompleteOptions([{ value: '@Bob' }]);
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

      // Sticky mention: keep the mention if the user is in public mode
      const mentionMatch = inputValue.match(/^(@\w+)\s/);
      if (chatMode === 'public' && mentionMatch) {
        setInputValue(`${mentionMatch[1]} `);
      } else {
        setInputValue('');
      }

      setAttachments([]);

    } catch (error) {
      message.error("Failed to send message");
    } finally {
      setUploading(false);
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && showAutocomplete && autocompleteOptions.length > 0) {
      e.preventDefault();
      handleAutocompleteSelect(autocompleteOptions[0].value);
      return;
    }
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
              {isAI ? 'Bob the Bot' : msg.user?.username || 'Unknown'}
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
            <Text strong style={{ fontSize: '15px', color: '#7289da' }}>Bob the Bot</Text>
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


  // ====== RENDER HELPER (Reuses Logic for Scanning) ======
  const renderInterface = (mode: 'public' | 'private', messagesList: ChatMessage[] | null) => {
    // Get colors for this specific mode layer
    const theme = getColors(mode);
    const msgs = messagesList || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.chatBg }}>
        {/* Header */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${theme.border}`, background: theme.messageBg, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <Segmented
            options={[
              { label: 'Group Chat', value: 'public', icon: <UserOutlined /> },
              { label: 'My Tutor', value: 'private', icon: <RobotOutlined /> },
            ]}
            value={mode} // Forced value for frozen layer
            onChange={(val) => handleModeSwitch(val as 'public' | 'private')}
            block
            style={{ maxWidth: 400, minWidth: 300, background: theme.segmentedTrack }}
          />
        </div>

        {/* Status Bar */}
        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${theme.border}`, background: theme.messageBg, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? theme.onlineGreen : theme.offlineRed }} />
          <Text style={{ fontSize: '14px', color: theme.secondaryText }}>{connected ? 'Connected' : 'Disconnected'}</Text>
          {streamingMessage && (<> <div style={{ width: 4, height: 4, borderRadius: '50%', background: theme.secondaryText, margin: '0 4px', animation: 'pulse 1.5s infinite' }} /> <Text style={{ fontSize: '12px', color: theme.secondaryText, fontStyle: 'italic' }}><RobotOutlined /> Bob the Bot is typing...</Text> </>)}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: theme.messageBg, minHeight: 0, position: 'relative' }}>
          {mode === 'private' && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              opacity: 0.05, pointerEvents: 'none', zIndex: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}>
              <EyeInvisibleOutlined style={{ fontSize: '120px', color: theme.otherText }} />
              <Text strong style={{ fontSize: '24px', color: theme.otherText, marginTop: '20px' }}>PRIVATE SESSION</Text>
            </div>
          )}

          <div style={{ position: 'relative', zIndex: 1, paddingBottom: 16 }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}><Spin size="large" /></div>
            ) : msgs.length === 0 && !streamingMessage ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', padding: 40 }}>
                {mode === 'public' ? (
                  <>
                    <Text type="secondary" style={{ fontSize: '16px', color: theme.secondaryText }}>No messages yet. Start the conversation!</Text>
                    <Text type="secondary" style={{ fontSize: '14px', color: theme.secondaryText, marginTop: 8 }}>Type <Tag>@Bob</Tag> to ask the AI assistant</Text>
                  </>
                ) : (
                  <>
                    <Text type="secondary" style={{ fontSize: '16px', color: theme.secondaryText }}>Private Tutoring Session</Text>
                    <Text type="secondary" style={{ fontSize: '14px', color: theme.secondaryText, marginTop: 8 }}>Your chat here is not visible to other group members.</Text>
                  </>
                )}
              </div>
            ) : (
              <>
                <div style={{ paddingTop: 16 }}>
                  {msgs.map(renderMessage)}
                  {streamingMessage && renderStreamingMessage(streamingMessage)}
                </div>
                {/* Only attach Ref if it's the active mode to prevent stealing */}
                {mode === chatMode && <div ref={messagesEndRef} />}
              </>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div style={{ padding: '16px', background: theme.messageBg, borderTop: `1px solid ${theme.border}`, flexShrink: 0, position: 'relative' }}>

          {/* Autocomplete (Active Mode Only) */}
          {mode === chatMode && showAutocomplete && (
            <div style={{ position: 'absolute', bottom: '100%', left: '16px', right: '16px', background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: '8px 8px 0 0', marginBottom: '-1px', boxShadow: isDark ? '0 -2px 8px rgba(0, 0, 0, 0.45)' : '0 -2px 8px rgba(0, 0, 0, 0.15)', zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
              {autocompleteOptions.map((option) => (
                <div key={option.value} onClick={() => handleAutocompleteSelect(option.value)} onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? '#2e3035' : '#f9f9f9')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} style={{ padding: '12px 16px', cursor: 'pointer', color: theme.otherText, display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s' }}>
                  <RobotOutlined style={{ color: '#7289da', fontSize: '16px' }} />
                  <Text style={{ color: theme.otherText, fontWeight: 500 }}>Bob the Bot</Text>
                  <Tag color="purple" style={{ fontSize: '10px', padding: '0 4px', marginLeft: 'auto' }}>BOT</Tag>
                </div>
              ))}
            </div>
          )}

          {/* Attachment Chips (Active Mode Only) */}
          {mode === chatMode && attachments.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', paddingBottom: '12px', overflowX: 'auto' }}>
              {attachments.map(att => (
                <div key={att.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: theme.chipBg, padding: '4px 8px', borderRadius: '8px',
                  border: `1px solid ${theme.border}`, fontSize: '12px'
                }}>
                  {att.icon}
                  <Text style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: theme.otherText }}>
                    {att.title}
                  </Text>
                  <Button
                    type="text" size="small" icon={<CloseOutlined style={{ fontSize: '10px' }} />}
                    onClick={() => removeAttachment(att.id)}
                    style={{ width: '16px', height: '16px', minWidth: '16px', color: theme.secondaryText, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  />
                </div>
              ))}
            </div>
          )}

          <div style={{ background: theme.inputBg, borderRadius: '8px', border: `1px solid ${theme.inputBorder}`, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>

            {/* Fake Inputs for Frozen Layer (No interaction) */}
            {mode !== chatMode ? (
              <>
                <Button type="text" icon={<PlusOutlined />} disabled style={{ color: theme.secondaryText }} />
                <Divider type="vertical" style={{ height: '20px', borderColor: theme.border }} />
                <Button type="text" icon={<FileTextOutlined />} disabled style={{ color: theme.secondaryText }} />
                <Button type="text" icon={<BulbOutlined />} disabled style={{ color: theme.secondaryText }} />
                <Input.TextArea value={inputValue} disabled variant="borderless" autoSize={{ minRows: 1, maxRows: 3 }} style={{ flex: 1, color: theme.otherText, padding: '11px 12px', resize: 'none' }} />
                <Button type="text" icon={<SendOutlined />} disabled style={{ color: theme.secondaryText }} />
              </>
            ) : (
              // Real Inputs for Active Layer
              <>
                <input ref={fileInputRef} type="file" onChange={handleFileSelect} style={{ display: 'none' }} accept=".pdf,.txt,.docx,.doc,.md" />

                <Popover content={attachmentMenu} trigger="click" open={isAttachMenuOpen} onOpenChange={setIsAttachMenuOpen} placement="topLeft" overlayStyle={{ padding: 0 }}>
                  <Tooltip title="Add Context">
                    <Button type="text" icon={uploading ? <LoadingOutlined /> : <PlusOutlined style={{ fontSize: '16px', color: theme.secondaryText }} />} disabled={uploading} style={{ borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isAttachMenuOpen ? (isDark ? '#4f545c' : '#e3e5e8') : 'transparent' }} />
                  </Tooltip>
                </Popover>

                <Divider type="vertical" style={{ height: '20px', borderColor: theme.border }} />

                <Tooltip title={agentConfig?.rag_enabled ? "Disable documents" : "Use documents in prompt"}>
                  <Button type="text" icon={<FileTextOutlined />} onClick={toggleRag} loading={configLoading} style={{ color: agentConfig?.rag_enabled ? '#fff' : theme.secondaryText, backgroundColor: agentConfig?.rag_enabled ? theme.activeRag : 'transparent', borderRadius: '6px', padding: '4px 8px', transition: 'all 0.2s' }} />
                </Tooltip>

                <Tooltip title={agentConfig?.socratic_prompting ? "Disable learning mode" : "Enable learning mode"}>
                  <Button type="text" icon={<BulbOutlined />} onClick={toggleSocratic} loading={configLoading} style={{ color: agentConfig?.socratic_prompting ? '#fff' : theme.secondaryText, backgroundColor: agentConfig?.socratic_prompting ? theme.activeSocratic : 'transparent', borderRadius: '6px', padding: '4px 8px', transition: 'all 0.2s' }} />
                </Tooltip>

                <Input.TextArea ref={inputRef} value={inputValue} onChange={(e) => handleInputChange(e.target.value)} onKeyDown={handleKeyDown} disabled={!connected} placeholder={mode === 'private' ? "Ask your private AI tutor..." : `Message #${groupId} (Type @ to mention Bob)`} variant="borderless" autoSize={{ minRows: 1, maxRows: 3 }} style={{ flex: 1, background: 'transparent', color: theme.otherText, fontSize: '15px', padding: '11px 12px', resize: 'none' }} />

                <Button type="text" icon={<SendOutlined />} onClick={handleSend} disabled={!connected || (!inputValue.trim() && attachments.length === 0)} style={{ color: (inputValue.trim() || attachments.length > 0) ? theme.ownBubble : theme.secondaryText, padding: '4px 8px' }} />
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', minHeight: '400px', maxHeight: '100%', position: 'relative', overflow: 'hidden' }}>

      {/* 1. BASE LAYER (Active Mode) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {renderInterface(chatMode, messages)}
      </div>

      {/* 2. OVERLAY LAYER (Frozen Old Mode) */}
      {transitionStatus === 'scanning' && frozenMode && (
        <div className="scan-overlay">
          {renderInterface(frozenMode, frozenMessages)}
        </div>
      )}

      {/* 3. SCANNING LINE */}
      {transitionStatus === 'scanning' && <div className="scan-line" />}


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

      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .chat-markdown p { margin-bottom: 6px; }
        .chat-markdown p:last-child { margin-bottom: 0; }

        /* SCAN ANIMATIONS */
        @keyframes scanMove {
            0% { left: 0%; }
            100% { left: 100%; }
        }
        @keyframes scanClip {
            0% { clip-path: inset(0 0 0 0); }
            100% { clip-path: inset(0 0 0 100%); }
        }

        .scan-overlay {
            position: absolute;
            inset: 0;
            z-index: 50; /* Higher than base, covers everything */
            pointer-events: none; /* Let clicks pass through if needed, though mostly visual */
            /* We reveal the underlying layer (New Mode) by clipping this overlay (Old Mode) from L -> R */
            animation: scanClip 1s ease-in-out forwards;
        }

        .scan-line {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 2px;
            /* 3. BLACK SCAN LINE */
            background: #000000;
            box-shadow: 0 0 10px rgba(0,0,0,0.5); 
            z-index: 51; /* Above the overlay */
            pointer-events: none;
            animation: scanMove 1s ease-in-out forwards;
        }

        /* FORCE PLACEHOLDER COLOR */
        .ant-input::placeholder {
            color: ${colors.placeholder} !important;
            opacity: 1;
        }
        textarea::placeholder {
            color: ${colors.placeholder} !important;
            opacity: 1;
        }

        .ant-segmented-item-label {
            overflow: visible !important;
            white-space: normal !important;
        }
      `}</style>
    </div>
  );
};