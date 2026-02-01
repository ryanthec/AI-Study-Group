import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Typography, List, Modal, Input, Progress, Select, message, Form, Tag } from 'antd';
import { PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { documentService } from '../../services/document.service';
import { gameService } from '../../services/game.service';

const { Title, Text } = Typography;
const { Option } = Select;

export const FlashcardGameTab = ({ groupId }: { groupId: number }) => {
  const { user } = useAuth();
  const [games, setGames] = useState<any[]>([]);
  const [activeGame, setActiveGame] = useState<any>(null); // Current connected game state
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'result' | 'finished'>('lobby');
  const [currentCard, setCurrentCard] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  
  // WebSocket Reference
  const ws = useRef<WebSocket | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [creatingLoading, setCreatingLoading] = useState(false);
  
  // Form State
  const [form] = Form.useForm();

  // --- 1. Cleanup WebSocket on Unmount ---
  useEffect(() => {
    return () => {
      if (ws.current) {
        console.log("Cleaning up active game connection...");
        ws.current.close();
        ws.current = null;
      }
    };
  }, []);

  // --- 2. Initial Data Loading ---
  useEffect(() => {
    if (groupId) {
      loadGames();
    }
  }, [groupId]);

  // Fetch documents when opening modal
  useEffect(() => {
    if (isModalOpen) {
      loadDocuments();
    }
  }, [isModalOpen]);

  const loadGames = async () => {
    try {
      const data = await gameService.getActiveGames(groupId);
      setGames(data);
    } catch (error) {
      console.error("Failed to load games", error);
    }
  };

  const loadDocuments = async () => {
    try {
      const docs = await documentService.getGroupDocuments(groupId);
      setDocuments(docs);
    } catch (error) {
      console.error("Failed to load documents", error);
    }
  };

  const handleCreateGame = async (values: any) => {
    setCreatingLoading(true);
    try {
      await gameService.createGame(groupId, {
        topic: values.topic,
        num_cards: values.num_cards || 10,
        document_ids: values.document_ids || [],
        difficulty: values.difficulty || 'medium'
      });
      message.success("Game created successfully!");
      setIsModalOpen(false);
      form.resetFields();
      loadGames(); // Refresh list
    } catch (error) {
      message.error("Failed to create game. Please try again.");
    } finally {
      setCreatingLoading(false);
    }
  };

  // Helper for Difficulty Colors
  const getDiffColor = (diff: string) => {
    switch(diff) {
      case 'easy': return 'success';
      case 'medium': return 'processing'; // Blue
      case 'hard': return 'error'; // Red
      default: return 'default';
    }
  };

  // --- 3. Join a Game ---
  const joinGame = (gameId: number) => {
    // Close existing connection if any
    if (ws.current) {
        ws.current.close();
    }

    // Use service to connect (ensures correct URL/Token logic)
    ws.current = gameService.connectWebSocket(gameId);
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'new_card') {
        setGameState('playing');
        setCurrentCard(data.card);
        setTimeLeft(data.time_limit);
      } else if (data.type === 'round_end') {
        setGameState('result');
        setLeaderboard(data.leaderboard);
      } else if (data.type === 'game_over') {
        setGameState('finished');
        setLeaderboard(data.leaderboard);
      }
    };
    setActiveGame({ id: gameId });
  };

  // --- 4. Game View Render ---
  if (gameState === 'playing' && currentCard) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Progress type="circle" percent={(timeLeft / 15) * 100} format={() => `${timeLeft}s`} />
        <Title level={2} style={{ marginTop: 20 }}>{currentCard.front}</Title>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 40 }}>
          {currentCard.options.map((opt: string) => (
            <Button 
                key={opt} 
                size="large" 
                style={{ height: 80, fontSize: 18 }}
                onClick={() => ws.current?.send(JSON.stringify({ action: "answer", value: opt }))}
            >
              {opt}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // --- 5. Lobby List Render ---
  return (
    <div style={{ padding: 24 }}>
      
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <Title level={3}>Active Battles</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
            New Game
        </Button>
      </div>
      
      <List
        grid={{ gutter: 16, column: 3 }}
        dataSource={games}
        locale={{ emptyText: "No active games. Start one!" }}
        renderItem={(game: any) => (
          <List.Item>
            <Card 
                title={game.topic} 
                extra={<Tag color={getDiffColor(game.difficulty)}>{game.difficulty?.toUpperCase()}</Tag>}
                actions={[<Button onClick={() => joinGame(game.id)}>Join Game</Button>]}
            >
              <Text>Host: User {game.host_id}</Text>
            </Card>
          </List.Item>
        )}
      />

      <Modal
        title="Start a New Flashcard Battle"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateGame}>
          
          <Form.Item 
            name="topic" 
            label="Topic / Theme" 
            rules={[{ required: true, message: 'Please enter a topic' }]}
            help="E.g., 'Chapter 3 Review', 'Organic Chemistry'"
          >
            <Input placeholder="Enter game topic..." />
          </Form.Item>

          <Form.Item 
            name="document_ids" 
            label="Select Context Documents"
            help="The AI will generate questions based on these files."
          >
            <Select
              mode="multiple"
              placeholder="Select documents..."
              optionFilterProp="children"
            >
              {documents.map(doc => (
                <Option key={doc.id} value={doc.id}>
                  <FileTextOutlined style={{ marginRight: 8 }} />
                  {doc.filename}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item 
                name="num_cards" 
                label="Questions" 
                initialValue={10}
                style={{ flex: 1 }}
            >
              <Select>
                <Option value={5}>5 Questions</Option>
                <Option value={10}>10 Questions</Option>
                <Option value={15}>15 Questions</Option>
              </Select>
            </Form.Item>

            <Form.Item 
                name="difficulty" 
                label="Difficulty" 
                initialValue="medium"
                style={{ flex: 1 }}
            >
              <Select>
                <Option value="easy">
                    <span style={{ color: '#52c41a' }}>Easy</span>
                </Option>
                <Option value="medium">
                    <span style={{ color: '#1890ff' }}>Medium</span>
                </Option>
                <Option value="hard">
                    <span style={{ color: '#ff4d4f' }}>Hard (15s limit)</span>
                </Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={creatingLoading} block>
              Generate & Create Lobby
            </Button>
          </Form.Item>
        </Form>
      </Modal>
      
    </div>
  );
};