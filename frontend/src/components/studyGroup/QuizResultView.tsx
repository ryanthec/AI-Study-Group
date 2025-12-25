import React from 'react';
import { Button, Card, Typography, Tag, Divider, Collapse, Space } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  RobotOutlined, 
  ArrowLeftOutlined,
  RedoOutlined
} from '@ant-design/icons';
import { Quiz, QuizAttemptResult } from '../../services/quiz.service';
import { useTheme } from '../../hooks/useTheme';

const { Title, Text, Paragraph } = Typography;


interface QuizResultViewProps {
  quiz: Quiz;
  result: QuizAttemptResult;
  userAnswers: Record<number, string>;
  onBackToDashboard: () => void;
  onRetake: () => void;
}

export const QuizResultView: React.FC<QuizResultViewProps> = ({
  quiz,
  result,
  userAnswers,
  onBackToDashboard,
  onRetake
}) => {

  const { isDark } = useTheme();

  // Color themes
  const colors = {
    bg: isDark ? '#141414' : '#f5f7fa',
    cardBg: isDark ? '#1f1f1f' : '#ffffff',
    border: isDark ? '#434343' : '#f0f0f0',
    text: isDark ? '#e6e6e6' : '#262626',
    
    // Status Colors
    success: '#52c41a',
    error: '#ff4d4f',
    
    // Backgrounds for answer blocks
    successBg: isDark ? 'rgba(82, 196, 26, 0.15)' : '#f6ffed',
    successBorder: isDark ? '#2b4a11' : '#b7eb8f',
    
    errorBg: isDark ? 'rgba(255, 77, 79, 0.15)' : '#fff1f0',
    errorBorder: isDark ? '#5c1c1c' : '#ffa39e',
    
    neutralBg: isDark ? '#262626' : '#fafafa'
  };
  
  const handleExplain = (questionIdx: number) => {
    // Placeholder for future implementation
    console.log(`Explain question ${questionIdx}`);
  };

  return (
    <div style={{ padding: '24px', background: colors.bg, minHeight: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Score Card */}
        <Card 
            style={{ 
                textAlign: 'center', 
                marginBottom: '32px', 
                background: colors.cardBg,
                borderTop: `4px solid ${result.passed ? colors.success : colors.error}`,
                border: `1px solid ${colors.border}`,
                borderTopWidth: '4px' // Override override
            }}
        >
            <Title level={2} style={{ margin: 0, color: colors.text }}>
            {result.passed ? 'Great Job! 🎉' : 'Keep Practicing! 💪'}
            </Title>
            <Text type="secondary">You have completed {quiz.title}</Text>
            
            <Divider style={{ borderColor: colors.border }} />
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '48px' }}>
            <div>
                <Title level={1} style={{ margin: 0, color: result.passed ? colors.success : colors.error }}>
                {Math.round(result.percentage)}%
                </Title>
                <Text style={{ color: colors.text }}>Your Score</Text>
            </div>
            <div>
                <Title level={1} style={{ margin: 0, color: colors.text }}>
                {result.score}/{result.total_questions}
                </Title>
                <Text style={{ color: colors.text }}>Correct Answers</Text>
            </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <Button icon={<ArrowLeftOutlined />} onClick={onBackToDashboard}>
                Dashboard
            </Button>
            <Button type="primary" icon={<RedoOutlined />} onClick={onRetake}>
                Retake Quiz
            </Button>
            </div>
        </Card>

        {/* Question Review */}
        <Title level={4} style={{ color: colors.text }}>Review Answers</Title>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {quiz.questions.map((q, idx) => {
            const userAnswer = userAnswers[idx];
            const isCorrect = String(userAnswer) === String(q.correct_answer);

            return (
                <Card 
                    key={idx} 
                    size="small" 
                    bordered={false}
                    style={{ 
                        background: isCorrect ? colors.successBg : colors.errorBg,
                        border: `1px solid ${isCorrect ? colors.successBorder : colors.errorBorder}`
                    }}
                >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <Space>
                        {isCorrect ? 
                            <CheckCircleOutlined style={{ color: colors.success, fontSize: '20px' }} /> : 
                            <CloseCircleOutlined style={{ color: colors.error, fontSize: '20px' }} />
                        }
                        <Text strong style={{ color: colors.text }}>Question {idx + 1}</Text>
                    </Space>
                    <Button 
                        size="small" 
                        icon={<RobotOutlined />} 
                        onClick={() => handleExplain(idx)}
                        style={{ 
                            background: colors.cardBg, 
                            borderColor: colors.border,
                            color: colors.text 
                        }}
                    >
                        Explain
                    </Button>
                </div>

                <Paragraph style={{ margin: '12px 0 16px 28px', fontSize: '16px', color: colors.text }}>
                    {q.question}
                </Paragraph>

                <div style={{ marginLeft: '28px' }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        {/* User Answer Block */}
                        <div style={{ 
                            padding: '12px 16px', 
                            borderRadius: '8px', 
                            background: colors.cardBg,
                            border: `1px solid ${colors.border}`
                        }}>
                            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                Your Answer:
                            </Text>
                            <Text strong style={{ color: isCorrect ? colors.success : colors.error, fontSize: '15px' }}>
                                {userAnswer || "No Answer"}
                            </Text>
                        </div>

                        {/* Correct Answer Block (Only show if wrong) */}
                        {!isCorrect && (
                            <div style={{ 
                                padding: '12px 16px', 
                                borderRadius: '8px', 
                                background: colors.successBg,
                                border: `1px solid ${colors.successBorder}`
                            }}>
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                    Correct Answer:
                                </Text>
                                <Text strong style={{ color: colors.success, fontSize: '15px' }}>
                                    {q.correct_answer}
                                </Text>
                            </div>
                        )}
                    </Space>
                    
                    {/* Explanation */}
                    {q.explanation && (
                        <div style={{ 
                            marginTop: '16px', 
                            padding: '12px', 
                            background: colors.neutralBg, 
                            borderRadius: '6px',
                            borderLeft: `3px solid ${colors.border}`
                        }}>
                            <Text strong style={{ color: colors.text }}>Explanation:</Text>
                            <br/>
                            <Text italic style={{ color: colors.text }}>{q.explanation}</Text>
                        </div>
                    )}
                </div>
                </Card>
            );
            })}
        </div>
      </div>
    </div>
  );
};