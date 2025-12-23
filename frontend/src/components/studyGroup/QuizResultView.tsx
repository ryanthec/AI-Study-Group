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

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

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
  
  const handleExplain = (questionIdx: number) => {
    // Placeholder for future implementation
    console.log(`Explain question ${questionIdx}`);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header / Score Card */}
      <Card style={{ textAlign: 'center', marginBottom: '32px', borderTop: `4px solid ${result.passed ? '#52c41a' : '#ff4d4f'}` }}>
        <Title level={2} style={{ margin: 0 }}>
          {result.passed ? 'Great Job! 🎉' : 'Keep Practicing! 💪'}
        </Title>
        <Text type="secondary">You have completed {quiz.title}</Text>
        
        <Divider />
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '48px' }}>
          <div>
            <Title level={1} style={{ margin: 0, color: result.passed ? '#52c41a' : '#ff4d4f' }}>
              {Math.round(result.percentage)}%
            </Title>
            <Text>Your Score</Text>
          </div>
          <div>
            <Title level={1} style={{ margin: 0 }}>
              {result.score}/{result.total_questions}
            </Title>
            <Text>Correct Answers</Text>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={onBackToDashboard}>
            Back to Dashboard
          </Button>
          <Button type="primary" icon={<RedoOutlined />} onClick={onRetake}>
            Retake Quiz
          </Button>
        </div>
      </Card>

      {/* Question Review */}
      <Title level={4}>Review Answers</Title>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {quiz.questions.map((q, idx) => {
          const userAnswer = userAnswers[idx];
          const isCorrect = String(userAnswer) === String(q.correct_answer);

          return (
            <Card key={idx} size="small" style={{ borderColor: isCorrect ? '#b7eb8f' : '#ffa39e', background: isCorrect ? '#f6ffed' : '#fff1f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <Space>
                    {isCorrect ? 
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} /> : 
                        <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '20px' }} />
                    }
                    <Text strong>Question {idx + 1}</Text>
                </Space>
                <Button 
                    size="small" 
                    icon={<RobotOutlined />} 
                    onClick={() => handleExplain(idx)}
                >
                    Explain with AI
                </Button>
              </div>

              <Paragraph style={{ margin: '12px 0 12px 28px', fontSize: '16px' }}>
                {q.question}
              </Paragraph>

              <div style={{ marginLeft: '28px' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                    {/* User Answer */}
                    <div style={{ 
                        padding: '8px 12px', 
                        borderRadius: '6px', 
                        background: isCorrect ? '#fff' : '#fff',
                        border: '1px solid #d9d9d9'
                    }}>
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Your Answer:</Text>
                        <Text strong style={{ color: isCorrect ? '#52c41a' : '#ff4d4f' }}>
                            {userAnswer || "No Answer"}
                        </Text>
                    </div>

                    {/* Correct Answer (if wrong) */}
                    {!isCorrect && (
                         <div style={{ 
                            padding: '8px 12px', 
                            borderRadius: '6px', 
                            background: '#f6ffed',
                            border: '1px solid #b7eb8f'
                        }}>
                            <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Correct Answer:</Text>
                            <Text strong style={{ color: '#52c41a' }}>
                                {q.correct_answer}
                            </Text>
                        </div>
                    )}
                </Space>
                
                {/* Explanation text if provided by backend immediately */}
                {q.explanation && (
                    <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                        <Text italic>{q.explanation}</Text>
                    </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};