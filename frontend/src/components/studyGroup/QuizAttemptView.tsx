import React, { useState } from 'react';
import { Button, Card, Radio, Space, Typography, Layout, Modal, Progress, Divider } from 'antd';
import { 
  LeftOutlined, 
  RightOutlined, 
  CloseOutlined, 
  FlagOutlined,
  CheckCircleFilled 
} from '@ant-design/icons';
import { Quiz } from '../../services/quiz.service';

const { Title, Text, Paragraph } = Typography;
const { Sider, Content } = Layout;

interface QuizAttemptViewProps {
  quiz: Quiz;
  onExit: () => void;
  onSubmit: (answers: Record<number, string>) => void;
}

export const QuizAttemptView: React.FC<QuizAttemptViewProps> = ({ quiz, onExit, onSubmit }) => {
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Safety check in case quiz has no questions
  if (!quiz.questions || quiz.questions.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h3>Error Loading Quiz</h3>
        <p>This quiz appears to have no questions.</p>
        <Button onClick={onExit}>Return to Dashboard</Button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIdx];
  const totalQuestions = quiz.questions.length;
  const progressPercent = Math.round((Object.keys(answers).length / totalQuestions) * 100);

  const handleOptionSelect = (option: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestionIdx]: option
    }));
  };

  const handleExit = () => {
    Modal.confirm({
      title: 'Exit Quiz?',
      icon: <CloseOutlined style={{ color: 'red' }} />,
      content: 'Your progress will not be saved. Are you sure you want to leave?',
      okText: 'Yes, Leave',
      cancelText: 'Continue Quiz',
      okButtonProps: { danger: true },
      onOk: onExit,
    });
  };

  const handleSubmit = () => {
    Modal.confirm({
      title: 'Submit Quiz',
      content: `You have answered ${Object.keys(answers).length} out of ${totalQuestions} questions. Ready to submit?`,
      okText: 'Submit',
      onOk: () => onSubmit(answers),
    });
  };

  return (
    <Layout style={{ height: 'calc(100vh - 120px)', background: '#fff' }}>
      {/* Sidebar - Question Navigation */}
      <Sider width={280} theme="light" style={{ borderRight: '1px solid #f0f0f0', padding: '16px' }}>
        <Title level={5} style={{ marginBottom: 16 }}>{quiz.title}</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {Object.keys(answers).length}/{totalQuestions} Answered
        </Text>
        <Progress percent={progressPercent} showInfo={false} size="small" style={{ marginBottom: 24 }} />
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {quiz.questions.map((_, idx) => {
            const isAnswered = answers[idx] !== undefined;
            const isCurrent = currentQuestionIdx === idx;
            return (
              <Button
                key={idx}
                type={isCurrent ? 'primary' : 'default'}
                shape="default"
                style={{ 
                  borderColor: isAnswered && !isCurrent ? '#52c41a' : undefined,
                  color: isAnswered && !isCurrent ? '#52c41a' : undefined,
                  fontWeight: isCurrent ? 'bold' : 'normal'
                }}
                onClick={() => setCurrentQuestionIdx(idx)}
              >
                {idx + 1}
              </Button>
            );
          })}
        </div>
      </Sider>

      {/* Main Content - Question Area */}
      <Content style={{ padding: '40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text strong style={{ fontSize: '16px', color: '#666' }}>
              Question {currentQuestionIdx + 1}
            </Text>
            <Button type="text" danger icon={<CloseOutlined />} onClick={handleExit}>
              Exit Attempt
            </Button>
          </div>

          <Card bordered={false} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <Paragraph style={{ fontSize: '18px', marginBottom: 32 }}>
              {currentQuestion.question}
            </Paragraph>

            <Radio.Group 
              onChange={(e) => handleOptionSelect(e.target.value)} 
              value={answers[currentQuestionIdx]}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {currentQuestion.options.map((option, idx) => (
                  <Radio 
                    key={idx} 
                    value={option} // Assuming options are strings 'A', 'B' etc or the full text. If backend sends index, adjust here.
                    style={{ 
                      width: '100%', 
                      padding: '16px', 
                      border: '1px solid #d9d9d9', 
                      borderRadius: '8px',
                      background: answers[currentQuestionIdx] === option ? '#e6f7ff' : 'transparent',
                      borderColor: answers[currentQuestionIdx] === option ? '#1890ff' : '#d9d9d9'
                    }}
                  >
                    <span style={{ fontSize: '16px', marginLeft: '8px' }}>{option}</span>
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </Card>

          {/* Navigation Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, borderTop: '1px solid #f0f0f0', paddingTop: 24 }}>
            <Button 
              size="large"
              icon={<LeftOutlined />} 
              disabled={currentQuestionIdx === 0}
              onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
            >
              Previous
            </Button>
            
            {currentQuestionIdx < totalQuestions - 1 ? (
              <Button 
                size="large"
                type="primary" 
                onClick={() => setCurrentQuestionIdx(prev => prev + 1)}
              >
                Next <RightOutlined />
              </Button>
            ) : (
              <Button 
                size="large"
                type="primary"
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                icon={<CheckCircleFilled />}
                onClick={handleSubmit}
              >
                Submit Quiz
              </Button>
            )}
          </div>
        </div>
      </Content>
    </Layout>
  );
};