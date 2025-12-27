import React, { useState, useEffect } from 'react';
import { 
  Button, Table, Tag, Modal, Form, Input, 
  Select, Radio, InputNumber, message, Tooltip, Space 
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  RocketOutlined, 
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { quizService, Quiz, QuizAttemptResult, CreateQuizRequest } from '../../services/quiz.service';
import { documentService, Document } from '../../services/document.service';
import { QuizAttemptView } from './QuizAttemptView';
import { QuizResultView } from './QuizResultView';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

export const QuizTab: React.FC<{ groupId: number }> = ({ groupId }) => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  
  // --- View State ---
  const [viewMode, setViewMode] = useState<'dashboard' | 'attempt' | 'result'>('dashboard');
  
  // --- Data State ---
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  
  // Results State
  const [attemptResult, setAttemptResult] = useState<QuizAttemptResult | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});

  // --- UI State ---
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const [createForm] = Form.useForm();

  // --- COLOR THEMES ---
  const colors = {
    primary: isDark ? '#722ed1' : '#1890ff', // Dark Purple vs Blue
    text: isDark ? '#e6e6e6' : '#000000',
    textSecondary: isDark ? '#a6a6a6' : '#666666',
    modalBg: isDark ? '#1f1f1f' : '#ffffff',
  };

  useEffect(() => {
    if (groupId) {
        fetchQuizzes();
        fetchDocuments();
    }
  }, [groupId]);

  const fetchQuizzes = async () => {
    setIsLoading(true);
    try {
      const data = await quizService.getGroupQuizzes(groupId);
      setQuizzes(data);
    } catch (error) {
      message.error('Failed to load quizzes');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDocuments = async () => {
      try {
          const docs = await documentService.getGroupDocuments(groupId);
          setDocuments(docs);
      } catch (error) {
          console.error("Failed to fetch documents", error);
      }
  };

  const handleCreate = async (values: any) => {
    setIsCreating(true);
    try {
        const request: CreateQuizRequest = {
            ...values,
            num_questions: Number(values.num_questions)
        };
        await quizService.createQuiz(groupId, request);
        message.success('Quiz generated successfully!');
        setIsCreateModalOpen(false);
        createForm.resetFields();
        fetchQuizzes();
    } catch (error) {
        message.error('Failed to generate quiz.');
    } finally {
        setIsCreating(false);
    }
  };

  const handleDelete = async (quizId: number) => {
      try {
        await quizService.deleteQuiz(groupId, quizId);
        message.success('Quiz deleted');
        fetchQuizzes();
      } catch (error) {
        message.error('Failed to delete quiz');
      }
  };

  // --- Navigation Handlers ---

  const startAttempt = (quiz: Quiz) => {
      setActiveQuiz(quiz);
      setUserAnswers({});
      setViewMode('attempt');
  };

  const viewPastResults = async (quiz: Quiz) => {
      if (!quiz.latest_attempt) return;
      
      try {
          // Fetch full details including answers
          const fullResult = await quizService.getLatestAttempt(groupId, quiz.id);
          
          setActiveQuiz(quiz);
          setAttemptResult(fullResult);
          setUserAnswers(fullResult.answers || {});
          setViewMode('result');
      } catch (error) {
          message.error("Failed to load past results");
      }
  };

  const handleAttemptSubmit = async (answers: Record<number, string>) => {
      if (!activeQuiz) return;
      try {
          const result = await quizService.submitAttempt(groupId, activeQuiz.id, answers);
          setAttemptResult(result);
          setUserAnswers(answers);
          setViewMode('result');
          // Refresh list in background so dashboard is updated when they return
          fetchQuizzes(); 
      } catch (error) {
          message.error('Failed to submit quiz');
      }
  };

  const exitAttempt = () => {
      setActiveQuiz(null);
      setAttemptResult(null);
      setUserAnswers({});
      setViewMode('dashboard');
  };

  const retakeQuiz = () => {
      if (activeQuiz) {
        startAttempt(activeQuiz);
      }
  };

  // --- Table Columns ---
  const columns: ColumnsType<Quiz> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500, color: colors.text }}>{text}</div>
          <div style={{ fontSize: '12px', color: colors.textSecondary }}>{record.description || "No description"}</div>
        </div>
      ),
    },
    {
      title: 'Questions',
      dataIndex: 'num_questions',
      key: 'num_questions',
      width: 100,
      render: (count) => <Tag color={isDark ? 'purple' : 'default'}>{count}</Tag>,
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      render: (_, record) => {
        if (!record.latest_attempt) {
          return <Tag icon={<MinusCircleOutlined />} style={{ color: colors.textSecondary }}>Not Attempted</Tag>;
        }
        const { score, total_questions, passed } = record.latest_attempt;
        return (
          <Tag 
            icon={passed ? <CheckCircleOutlined /> : <CloseCircleOutlined />} 
            color={passed ? 'success' : 'error'}
          >
            {score}/{total_questions} ({Math.round((score/total_questions)*100)}%)
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 300,
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="primary" 
            size="small"
            style={{ background: colors.primary, borderColor: colors.primary }}
            icon={<RocketOutlined />} 
            onClick={() => startAttempt(record)}
          >
            {record.latest_attempt ? "Retake" : "Attempt"}
          </Button>

          <Tooltip title={!record.latest_attempt ? "Complete the quiz to view results" : "View your last attempt"}>
            <Button 
                size="small"
                icon={<EyeOutlined />} 
                disabled={!record.latest_attempt}
                onClick={() => viewPastResults(record)}
            >
                Results
            </Button>
          </Tooltip>

          {(user?.id && record.creator_name.includes(user.firstName)) && (
            <Button 
                danger 
                type="text" 
                size="small"
                icon={<DeleteOutlined />} 
                onClick={() => handleDelete(record.id)}
            />
          )}
        </Space>
      ),
    },
  ];

  // --- Views ---

  if (viewMode === 'attempt' && activeQuiz) {
      return (
          <QuizAttemptView 
            quiz={activeQuiz} 
            onExit={exitAttempt}
            onSubmit={handleAttemptSubmit}
          />
      );
  }

  if (viewMode === 'result' && activeQuiz && attemptResult) {
      return (
          <QuizResultView 
            quiz={activeQuiz}
            result={attemptResult}
            userAnswers={userAnswers}
            onBackToDashboard={exitAttempt}
            onRetake={retakeQuiz}
          />
      );
  }

  // Dashboard
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
        <div>
            <h2 style={{ margin: 0, color: colors.text }}>Quizzes</h2>
            <span style={{ color: colors.textSecondary }}>Generate AI quizzes from your study materials</span>
        </div>
        <Button 
            type="primary" 
            size="large" 
            icon={<PlusOutlined />} 
            style={{ background: colors.primary, borderColor: colors.primary }}
            onClick={() => setIsCreateModalOpen(true)}
        >
          Create Quiz
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={quizzes} 
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />

      {/* Creation Modal */}
      <Modal
        title={<span style={{ color: colors.text }}>Generate New AI Quiz</span>}
        open={isCreateModalOpen}
        onCancel={() => !isCreating && setIsCreateModalOpen(false)}
        footer={null}
        width={600}
        maskClosable={!isCreating}
        styles={{ header: { background: colors.modalBg }, body: { background: colors.modalBg }, content: { background: colors.modalBg } }}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
            <Form.Item name="title" label={<span style={{ color: colors.text }}>Quiz Title</span>} rules={[{ required: true }]}>
                <Input placeholder="e.g., Midterm Revision" />
            </Form.Item>
            
            <Form.Item name="topic_prompt" label={<span style={{ color: colors.text }}>Topic / Focus Area</span>} rules={[{ required: true }]}>
                <Input.TextArea rows={3} placeholder="Focus on..." />
            </Form.Item>

            <Form.Item name="document_ids" label={<span style={{ color: colors.text }}>Source Documents</span>}>
                <Select mode="multiple" placeholder="Select documents (optional)">
                    {documents.map(doc => (
                        <Select.Option key={doc.id} value={doc.id}>{doc.filename}</Select.Option>
                    ))}
                </Select>
            </Form.Item>

            <div style={{ display: 'flex', gap: '16px' }}>
                <Form.Item name="num_questions" label={<span style={{ color: colors.text }}>Questions</span>} initialValue={10} style={{ flex: 1 }}>
                    <InputNumber min={5} max={20} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="scope" label={<span style={{ color: colors.text }}>Visibility</span>} initialValue="group" style={{ flex: 1 }}>
                    <Radio.Group style={{ width: '100%', display: 'flex' }}>
                        <Radio.Button value="group" style={{ flex: 1, textAlign: 'center' }}>Group</Radio.Button>
                        <Radio.Button value="personal" style={{ flex: 1, textAlign: 'center' }}>Private</Radio.Button>
                    </Radio.Group>
                </Form.Item>
            </div>

            <Button 
                type="primary" 
                htmlType="submit" 
                loading={isCreating} 
                block 
                size="large"
                style={{ background: colors.primary, borderColor: colors.primary, marginTop: '16px' }}
            >
                Generate Quiz
            </Button>
        </Form>
      </Modal>
    </div>
  );
};