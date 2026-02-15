import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Typography, List, Modal, Input, Progress, Select, message, Form, Tag, Avatar, Space, Divider, Slider, Result, Tabs } from 'antd';
import { PlusOutlined, FileTextOutlined, UserOutlined, CrownOutlined, LogoutOutlined, ThunderboltFilled, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, BookOutlined, RocketOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme'; 
import { documentService } from '../../services/document.service';
import { gameService } from '../../services/game.service';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;

interface FlashcardGameTabProps {
    groupId: number;
    setGameActive: (active: boolean) => void;
}

export const FlashcardGameTab = ({ groupId, setGameActive }: FlashcardGameTabProps) => {
  const { user } = useAuth();
  const { isDark } = useTheme(); 
  
  // Data State
  const [games, setGames] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [triviaCategories, setTriviaCategories] = useState<any[]>([]);
  
  // Game Session State
  const [gameState, setGameState] = useState<'browsing' | 'lobby' | 'playing' | 'result' | 'finished'>('browsing');
  const [activeGame, setActiveGame] = useState<any>(null); 
  const [connectedPlayers, setConnectedPlayers] = useState<any[]>([]);
  
  // Round State
  const [currentCard, setCurrentCard] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  
  const [selectedOption, setSelectedOption] = useState<string | null>(null); 
  const selectedOptionRef = useRef<string | null>(null);

  const [roundResultInfo, setRoundResultInfo] = useState<any>(null);
  
  const ws = useRef<WebSocket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creatingLoading, setCreatingLoading] = useState(false);
  
  // Create Game Mode
  const [gameMode, setGameMode] = useState<'study' | 'trivia'>('study');
  
  const [form] = Form.useForm();

  const isHost = activeGame && user && String(activeGame.host_id) === String(user.id);

  // --- Theme Colors ---
  const successBg = isDark ? '#135200' : '#d9f7be'; 
  const errorBg = isDark ? '#5c0011' : '#ffa39e';   
  const textColor = isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)';
  const cardBg = isDark ? '#1f1f1f' : '#fff';
  const leaderboardItemBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)';

  // Update parent state on game status change
  useEffect(() => {
    if (gameState === 'lobby' || gameState === 'playing' || gameState === 'result') {
        setGameActive(true);
    } else {
        setGameActive(false);
    }
  }, [gameState, setGameActive]);

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      leaveGame();
      setGameActive(false); // Ensure guard is disabled on unmount
    };
  }, []);

  // --- Initial Load ---
  useEffect(() => {
    if (groupId) {
      loadGames();
    }
  }, [groupId]);

  useEffect(() => {
    if (isModalOpen) {
      loadDocuments();
      loadTriviaCategories();
    }
  }, [isModalOpen]);

  // --- Visual Timer ---
  useEffect(() => {
    let timer: any;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);


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

  const loadTriviaCategories = async () => {
    try {
        const res = await axios.get('https://opentdb.com/api_category.php');
        setTriviaCategories(res.data.trivia_categories || []);
    } catch (error) {
        console.error("Failed to fetch trivia categories");
    }
  };

  const handleDeleteGame = async (gameId: number) => {
    try {
      await gameService.deleteGame(gameId);
      message.success("Game deleted");
      loadGames();
    } catch (error) {
      message.error("Failed to delete game");
    }
  };

  const handleCreateGame = async (values: any) => {
    setCreatingLoading(true);
    try {
      const timeLimit = values.time_limit || 15;
      
      // Determine topic based on mode
      let topicName = values.topic;
      
      if (gameMode === 'trivia') {
          // If in Trivia mode, use the category name as topic
          const cat = triviaCategories.find(c => c.id === values.trivia_category);
          topicName = cat ? cat.name : "General Trivia";
      }

      // Convert category to string if needed to satisfy backend Optional[str]
      const triviaCatStr = values.trivia_category ? String(values.trivia_category) : undefined;

      const response = await gameService.createGame(groupId, {
        topic: topicName,
        num_cards: values.num_cards || 10,
        document_ids: gameMode === 'study' ? (values.document_ids || []) : [],
        difficulty: values.difficulty || 'medium',
        time_limit: timeLimit,
        mode: gameMode,
        trivia_category: triviaCatStr
      });
      message.success("Game created successfully!");
      setIsModalOpen(false);
      form.resetFields();
      
      await loadGames();
      
      const newGame = {
        id: response.game_id,
        topic: topicName,
        host_id: user?.id, 
        difficulty: values.difficulty || 'medium',
        host_name: user?.username,
        time_limit: timeLimit
      };
      
      joinGame(newGame);

    } catch (error) {
      message.error("Failed to create game. Please try again.");
    } finally {
      setCreatingLoading(false);
    }
  };

  // --- Join Logic ---
  const joinGame = (game: any) => {
    if (ws.current) ws.current.close();
    setActiveGame(game);
    ws.current = gameService.connectWebSocket(game.id);
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'player_update':
          setConnectedPlayers(data.players);
          setGameState(prev => (prev === 'browsing' ? 'lobby' : prev));
          break;
          
        case 'new_card':
          setGameState('playing');
          setCurrentCard(data.card);
          setTimeLeft(data.time_limit);
          setSelectedOption(null);
          selectedOptionRef.current = null;
          setRoundResultInfo(null);
          break;
          
        case 'round_end':
          setGameState('result');
          setRoundResultInfo({
            correct_answer: data.correct_answer,
            leaderboard: data.leaderboard,
            is_correct: selectedOptionRef.current === data.correct_answer 
          });
          break;
          
        case 'game_over':
          setGameState('finished');
          setRoundResultInfo({ leaderboard: data.leaderboard });
          break;
      }
    };
  };

  const leaveGame = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setActiveGame(null);
    setGameState('browsing');
    setConnectedPlayers([]);
    setCurrentCard(null);
  };

  const startGame = () => {
    if (ws.current) ws.current.send(JSON.stringify({ action: "start_game" }));
  };

  const handleAnswer = (opt: string) => {
    setSelectedOption(opt);
    selectedOptionRef.current = opt;
    ws.current?.send(JSON.stringify({ action: "answer", value: opt }));
  };

  const getDiffColor = (diff: string) => {
    switch(diff) {
      case 'easy': return 'success';
      case 'medium': return 'processing';
      case 'hard': return 'error';
      default: return 'default';
    }
  };


  // --- VIEW: PLAYING ---
  if (gameState === 'playing' && currentCard) {
    const totalTime = activeGame?.time_limit || 15;
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
         <div style={{ marginBottom: 20 }}>
            <Tag color="blue">{activeGame?.topic}</Tag>
            <Tag color={getDiffColor(activeGame?.difficulty)}>{activeGame?.difficulty?.toUpperCase()}</Tag>
         </div>
        <Progress type="circle" percent={(timeLeft / totalTime) * 100} format={() => `${timeLeft}s`} status={timeLeft < 5 ? 'exception' : 'active'} strokeColor={isDark && timeLeft < 5 ? '#ff4d4f' : undefined}/>
        <Title level={2} style={{ marginTop: 20, color: textColor }}>{currentCard.front}</Title>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 40 }}>
          {currentCard.options.map((opt: string) => {
            const isSelected = selectedOption === opt;
            return (
                <Button key={opt} size="large" type={isSelected ? "primary" : "default"} 
                    style={{ 
                        height: 80, fontSize: 18, whiteSpace: 'normal',
                        border: isSelected ? '3px solid #1890ff' : `1px solid ${isDark ? '#434343' : '#d9d9d9'}`,
                        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                        transition: 'all 0.2s',
                        background: isSelected ? undefined : (isDark ? '#141414' : '#fff'),
                        color: isSelected ? '#fff' : textColor
                    }}
                    onClick={() => handleAnswer(opt)}
                    disabled={timeLeft === 0} 
                >{opt}</Button>
            );
          })}
        </div>
      </div>
    );
  }

  // --- VIEW: ROUND RESULT ---
  if (gameState === 'result') {
    const isCorrect = roundResultInfo?.is_correct;
    return (
      <div style={{ padding: 40, textAlign: 'center', backgroundColor: isCorrect ? successBg : errorBg, height: '100%', borderRadius: 12, transition: 'background-color 0.3s' }}>
        <div style={{ marginBottom: 40 }}>
            {isCorrect ? (
                <Result status="success" icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 72 }} />} title={<span style={{ fontSize: 36, color: isDark && isCorrect ? '#fff' : '#52c41a' }}>Correct!</span>} subTitle={<span style={{ fontSize: 24, color: textColor }}>+ Points</span>}/>
            ) : (
                <Result status="error" icon={<CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 72 }} />} title={<span style={{ fontSize: 36, color: isDark && !isCorrect ? '#fff' : '#ff4d4f' }}>Wrong!</span>} subTitle={<span style={{color: textColor}}>Keep trying!</span>}/>
            )}
        </div>
        <Card style={{ marginTop: 20, border: isCorrect ? '2px solid #52c41a' : '2px solid #ff4d4f', background: cardBg }}>
            <Text type="secondary">Correct Answer:</Text>
            <Title level={3} style={{ color: textColor }}>{roundResultInfo?.correct_answer}</Title>
        </Card>
        <Divider style={{ borderColor: isDark ? '#434343' : '#a0a0a0' }}>Leaderboard</Divider>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <List itemLayout="horizontal" dataSource={roundResultInfo?.leaderboard?.slice(0, 5)} renderItem={(item: any, index: number) => (
                <List.Item style={{ justifyContent: 'center', background: leaderboardItemBg, marginBottom: 8, borderRadius: 8, padding: '12px 24px', border: isDark ? '1px solid #434343' : '1px solid #d9d9d9'}}>
                    <List.Item.Meta avatar={<Avatar style={{ backgroundColor: index === 0 ? '#fadb14' : '#1890ff' }}>{index + 1}</Avatar>} title={<span style={{ color: textColor, fontSize: 16 }}>{item.username}</span>} description={<span style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontWeight: 'bold' }}>{item.score} pts</span>} style={{ alignItems: 'center', textAlign: 'left' }}/>
                </List.Item>
            )}/>
        </div>
      </div>
    );
  }

  // --- VIEW: GAME OVER ---
  if (gameState === 'finished') {
     return (
        <div style={{ padding: 40, textAlign: 'center' }}>
            <Result status="info" icon={<CrownOutlined style={{ color: '#fadb14', fontSize: 72 }} />} title={<span style={{ color: textColor }}>Game Over!</span>} subTitle={<span style={{ color: textColor }}>Final Standings</span>}/>
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
                <List itemLayout="horizontal" dataSource={roundResultInfo?.leaderboard} renderItem={(item: any, index: number) => (
                    <List.Item style={{ justifyContent: 'center', background: leaderboardItemBg, marginBottom: 8, borderRadius: 8, padding: '12px 24px', border: index === 0 ? '2px solid #fadb14' : (isDark ? '1px solid #434343' : '1px solid #d9d9d9')}}>
                        <List.Item.Meta avatar={<Avatar style={{ backgroundColor: index === 0 ? '#fadb14' : '#1890ff' }}>{index + 1}</Avatar>} title={<Text strong style={{ color: textColor, fontSize: 16 }}>{item.username}</Text>} description={<span style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>{item.score} pts</span>} style={{ alignItems: 'center' }}/>
                    </List.Item>
                )}/>
            </div>
            <Button type="primary" size="large" onClick={leaveGame} style={{ marginTop: 40 }}>Return to Lobby List</Button>
        </div>
     );
  }

  // --- VIEW: LOBBY ---
  if (gameState === 'lobby') {
    return (
        <div style={{ padding: 24 }}>
            <Button icon={<LogoutOutlined />} onClick={leaveGame} style={{ marginBottom: 16 }}>Leave Lobby</Button>
            <Card title={<Space><ThunderboltFilled style={{ color: '#fadb14' }} /><span style={{ color: textColor }}>{activeGame?.topic}</span><Tag>{activeGame?.difficulty?.toUpperCase()}</Tag></Space>}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={4} style={{ color: textColor }}>Waiting for players...</Title>
                    {isHost ? (<Button type="primary" size="large" onClick={startGame} disabled={connectedPlayers.length < 1}>Start Game</Button>) : (<Text type="secondary">Waiting for host to start...</Text>)}
                </div>
                <Divider orientation="left">Connected Players ({connectedPlayers.length})</Divider>
                <List grid={{ gutter: 16, column: 4 }} dataSource={connectedPlayers} renderItem={player => (
                    <List.Item><Card size="small" style={{ textAlign: 'center', background: cardBg }}><Avatar size="large" icon={<UserOutlined />} /><div style={{ marginTop: 8, fontWeight: 'bold', color: textColor }}>{player.username}</div></Card></List.Item>
                )}/>
            </Card>
        </div>
    );
  }

  // --- VIEW: BROWSING ---
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <Title level={3} style={{ color: textColor }}>Active Battles</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>New Game</Button>
      </div>
      
      <List
        grid={{ gutter: 16, column: 3 }}
        dataSource={games}
        locale={{ emptyText: "No active games. Start one!" }}
        renderItem={(game: any) => {
            const canDelete = String(game.host_id) === String(user?.id);
            return (
              <List.Item>
                <Card 
                    title={game.topic} 
                    extra={<Tag color={getDiffColor(game.difficulty)}>{game.difficulty?.toUpperCase()}</Tag>}
                    actions={[
                        <Button type="primary" onClick={() => joinGame(game)}>Join Game</Button>,
                        canDelete && (
                            <Button danger onClick={() => handleDeleteGame(game.id)}>Delete Game</Button>
                        )
                    ].filter(Boolean)}
                >
                  <Text style={{ color: textColor }}>Host: {game.host_name}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>Time: {game.time_limit || 15}s</Text>
                </Card>
              </List.Item>
            );
        }}
      />

      {/* GAME MODAL */}
      <Modal 
        title="Start a New Battle" 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateGame}>
            
            {/* TABS SWITCHING */}
            <Tabs 
                activeKey={gameMode} 
                onChange={(k: any) => setGameMode(k)}
                destroyOnHidden={true} // Replaced deprecated destroyInactiveTabPane
                items={[
                    {
                        key: 'study',
                        label: <span><BookOutlined /> Study Quiz</span>,
                        children: (
                            <div style={{ marginTop: 16 }}>
                                <Form.Item name="topic" label="Topic" rules={[{ required: true, message: 'Please enter a topic' }]}>
                                    <Input placeholder="E.g. History" />
                                </Form.Item>
                                <Form.Item name="document_ids" label="From Documents" help="Questions generated from your files">
                                    <Select mode="multiple" placeholder="Select files...">
                                    {documents.map(doc => <Option key={doc.id} value={doc.id}>{doc.filename}</Option>)}
                                    </Select>
                                </Form.Item>
                            </div>
                        )
                    },
                    {
                        key: 'trivia',
                        label: <span><RocketOutlined /> Fun Trivia</span>,
                        children: (
                            <div style={{ marginTop: 16 }}>
                                <Form.Item name="trivia_category" label="Category" rules={[{ required: true, message: 'Please select a category' }]}>
                                    <Select placeholder="Select a topic" showSearch optionFilterProp="children">
                                        <Option value="any">Any Category</Option>
                                        {triviaCategories.map(cat => (
                                            <Option key={cat.id} value={cat.id}>{cat.name}</Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </div>
                        )
                    }
                ]}
            />

            {/* COMMON FIELDS */}
            <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                <Form.Item name="num_cards" label="Questions" initialValue={10} style={{ flex: 1 }}>
                    <Select><Option value={5}>5</Option><Option value={10}>10</Option><Option value={15}>15</Option></Select>
                </Form.Item>
                <Form.Item name="difficulty" label="Difficulty" initialValue="medium" style={{ flex: 1 }}>
                    <Select>
                        <Option value="easy">Easy</Option>
                        <Option value="medium">Medium</Option>
                        <Option value="hard">Hard</Option>
                    </Select>
                </Form.Item>
            </div>
            
            <Form.Item name="time_limit" label="Time per Question (sec)" initialValue={15}>
                <Slider min={5} max={30} marks={{ 5: '5s', 15: '15s', 30: '30s' }} />
            </Form.Item>

            <Form.Item>
                <Button type="primary" htmlType="submit" loading={creatingLoading} block size="large">
                    Create {gameMode === 'study' ? 'Study' : 'Trivia'} Lobby
                </Button>
            </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};