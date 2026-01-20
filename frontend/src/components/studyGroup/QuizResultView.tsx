import React, { useRef } from 'react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Button, Card, Typography, Tag, Divider, Collapse, Space, message, Spin, Modal } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  RobotOutlined, 
  ArrowLeftOutlined,
  RedoOutlined,
  FileTextOutlined,
  CopyOutlined,
  DownloadOutlined,
  BarChartOutlined
} from '@ant-design/icons';

import { Quiz, QuizAttemptResult, quizService } from '../../services/quiz.service';
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

    // States for Analysis
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    // Initialize with existing report if available
    const [analysisText, setAnalysisText] = useState(result.analysis_report || '');

    // Ref for PDF generation
    const reportRef = useRef<HTMLDivElement>(null);

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

    const handleAnalyze = async () => {
        if (analysisText) {
            setIsModalOpen(true);
            return;
        }

        setIsAnalyzing(true);
        try {
            const updatedResult = await quizService.analyzeAttempt(quiz.study_group_id, result.attempt_id);
            if (updatedResult.analysis_report) {
                setAnalysisText(updatedResult.analysis_report);
                setIsModalOpen(true);
                message.success("Analysis generated successfully!");
            }
        } catch (error) {
            message.error("Failed to analyze results. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(analysisText);
        message.success("Report copied to clipboard!");
    };

    const handleDownloadPDF = async () => {
        if (!reportRef.current) return;
        
        try {
            message.loading({ content: "Generating PDF...", key: 'pdf_gen' });
            
            const element = reportRef.current;
            const canvas = await html2canvas(element, {
                scale: 2, // Higher scale for better quality
                backgroundColor: isDark ? '#1f1f1f' : '#ffffff',
                useCORS: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Gap_Analysis_${quiz.title.replace(/\s+/g, '_')}.pdf`);
            
            message.success({ content: "PDF Downloaded!", key: 'pdf_gen' });
        } catch (error) {
            console.error(error);
            message.error({ content: "Failed to generate PDF", key: 'pdf_gen' });
        }
    };

    const hasAnalysis = !!analysisText;
  

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
                borderTopWidth: '4px'
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

            {/* Gap Analysis Button */}
            <Button 
                    type="primary" 
                    icon={isAnalyzing ? <Spin size="small" /> : (hasAnalysis ? <FileTextOutlined /> : <BarChartOutlined />)} 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    style={{ 
                        background: hasAnalysis ? '#1890ff' : '#722ed1', 
                        borderColor: hasAnalysis ? '#1890ff' : '#722ed1'
                    }}
                >
                    {isAnalyzing ? 'Analyzing...' : (hasAnalysis ? 'View Results Analysis' : 'Analyze my results')}
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
                    variant = "borderless"
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

        {/* ANALYSIS MODAL */}
        <Modal
            title={<Title level={3} style={{ margin: 0 }}>📊 Performance Analysis</Title>}
            open={isModalOpen}
            onCancel={() => setIsModalOpen(false)}
            footer={[
                <Button key="copy" icon={<CopyOutlined />} onClick={handleCopy}>
                    Copy Text
                </Button>,
                <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={handleDownloadPDF}>
                    Download PDF
                </Button>,
            ]}
            width={1000}
            centered
            styles={{ body: { maxHeight: '70vh', overflowY: 'auto', padding: 0 } }}
        >
            <div style={{ padding: '40px', background: isDark ? '#1f1f1f' : '#ffffff' }}>
                <div ref={reportRef} style={{ background: isDark ? '#1f1f1f' : '#ffffff', color: colors.text, padding: '20px' }}>
                    <ReactMarkdown
                        components={{
                            h1: ({node, ...props}) => <h1 style={{ color: colors.text, borderBottom: `2px solid ${colors.border}`, paddingBottom: '10px', marginBottom: '20px', fontSize: '28px' }} {...props} />,
                            h2: ({node, ...props}) => <h2 style={{ color: '#1890ff', marginTop: '30px', marginBottom: '15px', fontSize: '22px' }} {...props} />,
                            h3: ({node, ...props}) => <h3 style={{ color: colors.text, marginTop: '20px', marginBottom: '10px', fontSize: '18px', fontWeight: 'bold' }} {...props} />,
                            strong: ({node, ...props}) => <strong style={{ color: isDark ? '#adc6ff' : '#0050b3' }} {...props} />,
                            p: ({node, ...props}) => <p style={{ fontSize: '16px', lineHeight: '1.8', marginBottom: '16px', color: colors.text }} {...props} />,
                            li: ({node, ...props}) => <li style={{ fontSize: '16px', lineHeight: '1.8', marginBottom: '8px', marginLeft: '20px', color: colors.text }} {...props} />,
                            ul: ({node, ...props}) => <ul style={{ marginBottom: '16px' }} {...props} />,
                        }}
                    >
                        {analysisText}
                    </ReactMarkdown>
                </div>
            </div>
        </Modal>
        
      </div>
    </div>
  );
};