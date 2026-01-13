import React, { useEffect, useState } from 'react';
import { Card, Switch, Slider, Select, Space, Spin, message, Divider, Row, Col, Typography, Tag, } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { agentConfigService } from '../../services/agentConfig.service';
import { useTheme } from '../../hooks/useTheme';

const { Text, Title } = Typography;

interface AgentConfig {
  rag_mode: string;
  rag_enabled: boolean;
  socratic_prompting: boolean;
  socratic_limits: {
    factual: number;
    conceptual: number;
    applied: number;
    complex: number;
  };
  temperature: number;
  max_tokens: number;
}

interface AgentSettingsTabProps {
  groupId: number;
  isAdmin: boolean;
}

export const AgentSettingsTab: React.FC<AgentSettingsTabProps> = ({
  groupId,
  isAdmin,
}) => {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [groupId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await agentConfigService.getAgentConfig(groupId);
      setConfig(data);
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to load agent settings');
    } finally {
      setLoading(false);
    }
  };

  const handleRagModeChange = async (value: string) => {
    try {
      setUpdating(true);
      await agentConfigService.updateRagMode(groupId, value);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              rag_mode: value,
              rag_enabled: value !== 'disabled',
            }
          : null
      );
      message.success(`RAG mode changed to ${value}`);
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to update RAG mode');
    } finally {
      setUpdating(false);
    }
  };

  const handleSocraticModeChange = async (checked: boolean) => {
    try {
      setUpdating(true);
      await agentConfigService.updateSocraticMode(groupId, checked);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              socratic_prompting: checked,
            }
          : null
      );
      message.success(`Socratic prompting ${checked ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to update socratic mode');
    } finally {
      setUpdating(false);
    }
  };

  const handleSocraticLimitChange = async (
    type: 'factual' | 'conceptual' | 'applied' | 'complex',
    value: number
  ) => {
    try {
      setUpdating(true);
      await agentConfigService.updateSocraticLimits(groupId, { [type]: value });
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              socratic_limits: {
                ...prev.socratic_limits,
                [type]: value,
              },
            }
          : null
      );
      message.success(`Socratic limit for ${type} questions updated to ${value}`);
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to update limits');
    } finally {
      setUpdating(false);
    }
  };

  const handleTemperatureChange = async (value: number) => {
    try {
      setUpdating(true);
      await agentConfigService.updateTemperature(groupId, value);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              temperature: value,
            }
          : null
      );
      // message.success(`Temperature updated to ${value.toFixed(2)}`);
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to update temperature');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <Spin size="large" />;
  }

  if (!config) {
    return <Text>Failed to load agent settings</Text>;
  }

  const cardStyle = {
    boxShadow: isDark
      ? '0 2px 8px rgba(0, 0, 0, 0.45)'
      : '0 1px 4px rgba(0, 0, 0, 0.2)',
    border: isDark ? '1px solid #434343' : '1px solid #9fa1a3ff',
    borderRadius: '8px',
  };

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <RobotOutlined /> TeachingAI Agent Settings
          </Title>
          <Text type="secondary">
            {isAdmin
              ? 'Configure how the AI teaching assistant behaves in this group.'
              : 'View AI teaching assistant settings (admins only).'}
          </Text>
        </div>

        {/* RAG Settings */}
        <Card style={cardStyle}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Title level={4}>📚 Study Material Access</Title>
            <Text>
              Enable the AI to reference study materials and previous conversations for better context.
            </Text>

            <div>
              <Text strong>AI Document Access:</Text>
              <Select
                style={{ width: '100%', marginTop: '8px' }}
                value={config.rag_mode}
                onChange={handleRagModeChange}
                disabled={!isAdmin || updating}
                options={[
                  { label: 'Disabled - No context references', value: 'disabled' },
                  {
                    label: 'With Documents - Use uploaded materials as context',
                    value: 'documents_only',
                  },
                  // {
                  //   label: 'Conversations Only - Use chat history',
                  //   value: 'conversations_only',
                  // },
                  // { label: 'Both - Use all available context', value: 'both' },
                ]}
              />
              <Text type="secondary" style={{ marginTop: '8px', display: 'block' }}>
                Current: <Tag>{config.rag_mode.replace(/_/g, ' ')}</Tag>
              </Text>
            </div>
          </Space>
        </Card>

        {/* Socratic Prompting Settings */}
        <Card style={cardStyle}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Title level={4}>🤔 Teaching Style</Title>
            <Text>
              Guide students through learning with thoughtful questions based on question type.
            </Text>

            {/* Toggle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                background: isDark ? '#1f1f1f' : '#f5f5f5',
                borderRadius: '6px',
              }}
            >
              <Text strong>Enable Leaning Mode:</Text>
              <Switch
                checked={config.socratic_prompting}
                onChange={handleSocraticModeChange}
                disabled={!isAdmin || updating}
              />
            </div>

            {config.socratic_prompting && (
              <>
                <Divider />
                <Text strong>Teaching Style by Question Type:</Text>

                {/* Factual Questions */}
                <div>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Text>
                        ✅ Factual Questions
                        <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                          (e.g., "What is...?")
                        </Text>
                      </Text>
                    </Col>
                    <Col>
                      <Tag color="blue">{config.socratic_limits.factual}</Tag>
                    </Col>
                  </Row>
                  <Slider
                    min={0}
                    max={3}
                    value={config.socratic_limits.factual}
                    onChange={(value) => handleSocraticLimitChange('factual', value)}
                    disabled={!isAdmin || updating}
                    marks={{
                      0: 'Direct',
                      1: 'Brief',
                      2: 'Guided',
                      3: 'Heavy',
                    }}
                    style={{ marginTop: '8px' }}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {config.socratic_limits.factual === 0 &&
                      'Always provide direct answers - best for facts'}
                    {config.socratic_limits.factual === 1 &&
                      'Brief guidance then answer - balanced approach'}
                    {config.socratic_limits.factual === 2 &&
                      'Guide first then provide answer'}
                    {config.socratic_limits.factual === 3 &&
                      'Ask questions before revealing answer'}
                  </Text>
                </div>

                {/* Conceptual Questions */}
                <div style={{ marginTop: '24px' }}>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Text>
                        💡 Conceptual Questions
                        <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                          (e.g., "Why...?", "How...?")
                        </Text>
                      </Text>
                    </Col>
                    <Col>
                      <Tag color="cyan">{config.socratic_limits.conceptual}</Tag>
                    </Col>
                  </Row>
                  <Slider
                    min={0}
                    max={4}
                    value={config.socratic_limits.conceptual}
                    onChange={(value) => handleSocraticLimitChange('conceptual', value)}
                    disabled={!isAdmin || updating}
                    marks={{
                      0: 'Direct',
                      1: 'Light',
                      2: 'Balanced',
                      3: 'Heavy',
                      4: 'Very Heavy',
                    }}
                    style={{ marginTop: '8px' }}
                  />
                </div>

                {/* Applied Questions */}
                <div style={{ marginTop: '24px' }}>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Text>
                        💻 Applied Questions
                        <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                          (e.g., "Code...", "Solve...")
                        </Text>
                      </Text>
                    </Col>
                    <Col>
                      <Tag color="green">{config.socratic_limits.applied}</Tag>
                    </Col>
                  </Row>
                  <Slider
                    min={0}
                    max={4}
                    value={config.socratic_limits.applied}
                    onChange={(value) => handleSocraticLimitChange('applied', value)}
                    disabled={!isAdmin || updating}
                    marks={{
                      0: 'Direct',
                      1: 'Light',
                      2: 'Balanced',
                      3: 'Heavy',
                      4: 'Very Heavy',
                    }}
                    style={{ marginTop: '8px' }}
                  />
                </div>

                {/* Complex Questions */}
                <div style={{ marginTop: '24px' }}>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Text>
                        🎯 Complex Questions
                        <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                          (e.g., "Analyze...", "Design...")
                        </Text>
                      </Text>
                    </Col>
                    <Col>
                      <Tag color="purple">{config.socratic_limits.complex}</Tag>
                    </Col>
                  </Row>
                  <Slider
                    min={0}
                    max={5}
                    value={config.socratic_limits.complex}
                    onChange={(value) => handleSocraticLimitChange('complex', value)}
                    disabled={!isAdmin || updating}
                    marks={{
                      0: 'Direct',
                      1: 'Light',
                      2: 'Balanced',
                      3: 'Heavy',
                      4: 'Very Heavy',
                      5: 'Max',
                    }}
                    style={{ marginTop: '8px' }}
                  />
                </div>
              </>
            )}
          </Space>
        </Card>

        {/* Temperature Settings */}
        <Card style={cardStyle}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Title level={4}>🌡️ Response Creativity</Title>
            <Text>
              Control how creative vs. deterministic the AI responses are.
            </Text>

            <div>
              <Row justify="space-between" align="middle">
                <Col>
                  <Text strong>Response Creativity:</Text>
                </Col>
                <Col>
                  <Tag color="magenta">{config.temperature.toFixed(2)}</Tag>
                </Col>
              </Row>
              <Slider
                min={0}
                max={2}
                step={0.1}
                value={config.temperature}
                onChange={handleTemperatureChange}
                disabled={!isAdmin || updating}
                marks={{
                  0: 'Precise',
                  1: 'Balanced',
                  2: 'Creative',
                }}
                style={{ marginTop: '8px' }}
              />
              <Text type="secondary" style={{ marginTop: '8px', display: 'block' }}>
                {config.temperature <= 0.5 &&
                  '❄️ Very precise and consistent responses'}
                {config.temperature > 0.5 && config.temperature <= 1 &&
                  '🎯 Balanced between precision and variety'}
                {config.temperature > 1 && config.temperature <= 1.5 &&
                  '✨ More creative and varied responses'}
                {config.temperature > 1.5 &&
                  '🎨 Very creative - responses may vary widely'}
              </Text>
            </div>
          </Space>
        </Card>

        {/* Admin Only Notice */}
        {!isAdmin && (
          <Card style={{ ...cardStyle, background: isDark ? '#1f1f1f' : '#f0f0f0' }}>
            <Text type="warning">
              🔒 Only group admins can change agent settings.
            </Text>
          </Card>
        )}
      </Space>
    </div>
  );
};