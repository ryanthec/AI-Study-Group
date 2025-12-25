import React, { useState } from 'react';
import { Button, Card, Radio, Space, Typography, Layout, Modal, Progress, theme } from 'antd';
import { 
  LeftOutlined, 
  RightOutlined, 
  CloseOutlined, 
  CheckCircleFilled,
  ExclamationCircleOutlined 
} from '@ant-design/icons';
import { Quiz } from '../../services/quiz.service';
import { useTheme } from '../../hooks/useTheme';

const { Title, Text, Paragraph } = Typography;
const { Sider, Content } = Layout;

interface QuizAttemptViewProps {
  quiz: Quiz;
  onExit: () => void;
  onSubmit: (answers: Record<number, string>) => void;
}

export const QuizAttemptView: React.FC<QuizAttemptViewProps> = ({ quiz, onExit, onSubmit }) => {
  const { isDark } = useTheme();
  const { token } = theme.useToken();
  
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Safety check
  if (!quiz.questions || quiz.questions.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: isDark ? '#fff' : '#000' }}>
        <h3>Error Loading Quiz</h3>
        <p>This quiz appears to have no questions.</p>
        <Button onClick={onExit}>Return to Dashboard</Button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIdx];
  const totalQuestions = quiz.questions.length;
  const progressPercent = Math.round((Object.keys(answers).length / totalQuestions) * 100);

  // --- THEME COLORS ---
  const colors = {
    bg: isDark ? '#141414' : '#f5f7fa',
    siderBg: isDark ? '#1f1f1f' : '#ffffff',
    cardBg: isDark ? '#1f1f1f' : '#ffffff',
    text: isDark ? '#e6e6e6' : '#262626',
    textSecondary: isDark ? '#a6a6a6' : '#595959',
    border: isDark ? '#434343' : '#e8e8e8',
    primary: isDark ? '#722ed1' : '#1890ff',
    primaryLight: isDark ? 'rgba(114, 46, 209, 0.2)' : '#e6f7ff',
    success: '#52c41a',
    optionBorder: isDark ? '#434343' : '#d9d9d9',
    optionSelectedBorder: isDark ? '#722ed1' : '#1890ff',
    optionSelectedBg: isDark ? '#22075e' : '#e6f7ff',
  };

  const handleOptionSelect = (option: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestionIdx]: option
    }));
  };

  const handleExit = () => {
    Modal.confirm({
      title: 'Exit Quiz?',
      icon: <ExclamationCircleOutlined style={{ color: 'red' }} />,
      content: 'Your progress will not be saved. Are you sure you want to leave?',
      okText: 'Yes, Leave',
      cancelText: 'Continue',
      okButtonProps: { danger: true },
      onOk: onExit,
      styles: { body: { filter: isDark ? 'invert(0)' : 'none' } } 
    });
  };

  const handleSubmit = () => {
    Modal.confirm({
      title: 'Submit Quiz',
      icon: <CheckCircleFilled style={{ color: colors.success }} />,
      content: `You have answered ${Object.keys(answers).length} out of ${totalQuestions} questions. Ready to submit?`,
      okText: 'Submit',
      okButtonProps: { style: { background: colors.success, borderColor: colors.success } },
      onOk: () => onSubmit(answers),
    });
  };

  return (
    <Layout style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100vw', 
      height: '100vh', 
      zIndex: 1000, 
      background: colors.bg 
    }}>
      {/* Sidebar - Navigation */}
      <Sider 
        width={300} 
        style={{ 
          background: colors.siderBg, 
          borderRight: `1px solid ${colors.border}`, 
          padding: '24px',
          overflowY: 'auto'
        }}
      >
        <Title level={5} style={{ marginBottom: 16, color: colors.text }}>
          Question Navigator
        </Title>
        <Text style={{ display: 'block', marginBottom: 8, color: colors.textSecondary }}>
          {Object.keys(answers).length} of {totalQuestions} Answered
        </Text>
        <Progress 
          percent={progressPercent} 
          showInfo={false} 
          size="small" 
          strokeColor={colors.primary}
          trailColor={isDark ? '#434343' : '#f0f0f0'}
          style={{ marginBottom: 24 }} 
        />
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {quiz.questions.map((_, idx) => {
            const isAnswered = answers[idx] !== undefined;
            const isCurrent = currentQuestionIdx === idx;
            
            let borderColor = colors.border;
            let color = colors.textSecondary;
            let background = 'transparent';
            let fontWeight = 'normal';

            if (isCurrent) {
                borderColor = colors.primary;
                color = isDark ? '#fff' : colors.primary;
                fontWeight = 'bold';
                background = isDark ? colors.primaryLight : '#fff';
            } else if (isAnswered) {
                borderColor = colors.success;
                color = colors.success;
                background = isDark ? 'rgba(82, 196, 26, 0.1)' : '#f6ffed';
            }

            return (
              <Button
                key={idx}
                shape="default"
                style={{ 
                  borderColor,
                  color,
                  background,
                  fontWeight,
                  height: '40px'
                }}
                onClick={() => setCurrentQuestionIdx(idx)}
              >
                {idx + 1}
              </Button>
            );
          })}
        </div>
      </Sider>

      {/* Main Content */}
      <Content style={{ padding: '40px', overflowY: 'auto', background: colors.bg }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center' }}>
            <div>
                <Text strong style={{ fontSize: '18px', color: colors.primary }}>
                Question {currentQuestionIdx + 1}
                </Text>
                <Text style={{ fontSize: '18px', color: colors.textSecondary }}> / {totalQuestions}</Text>
            </div>
            <Button type="text" danger icon={<CloseOutlined />} onClick={handleExit}>
              Exit Attempt
            </Button>
          </div>

          {/* Question Card */}
          <Card 
            variant="borderless"
            style={{ 
                background: colors.cardBg, 
                boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.05)',
                borderRadius: '12px'
            }}
          >
            <Paragraph style={{ fontSize: '20px', marginBottom: 32, color: colors.text, lineHeight: 1.6 }}>
              {currentQuestion.question}
            </Paragraph>

            <Radio.Group 
              onChange={(e) => handleOptionSelect(e.target.value)} 
              value={answers[currentQuestionIdx]}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {currentQuestion.options.map((option, idx) => {
                    const isSelected = answers[currentQuestionIdx] === option;
                    return (
                        <Radio 
                            key={idx} 
                            value={option}
                            style={{ 
                                width: '100%', 
                                padding: '20px', 
                                border: `1px solid ${isSelected ? colors.optionSelectedBorder : colors.optionBorder}`, 
                                borderRadius: '12px',
                                background: isSelected ? colors.optionSelectedBg : 'transparent',
                                transition: 'all 0.2s',
                                color: colors.text
                            }}
                        >
                            <span style={{ fontSize: '16px', marginLeft: '8px' }}>{option}</span>
                        </Radio>
                    );
                })}
              </Space>
            </Radio.Group>
          </Card>

          {/* Navigation Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, paddingTop: 24 }}>
            <Button 
              size="large"
              icon={<LeftOutlined />} 
              disabled={currentQuestionIdx === 0}
              onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
              style={{ minWidth: '120px' }}
            >
              Previous
            </Button>
            
            {currentQuestionIdx < totalQuestions - 1 ? (
              <Button 
                size="large"
                type="primary"
                style={{ background: colors.primary, borderColor: colors.primary, minWidth: '120px' }}
                onClick={() => setCurrentQuestionIdx(prev => prev + 1)}
              >
                Next <RightOutlined />
              </Button>
            ) : (
              <Button 
                size="large"
                type="primary"
                style={{ background: colors.success, borderColor: colors.success, minWidth: '140px' }}
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