'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Form, ProgressBar, ListGroup, Badge, Row, Col, Container, Tabs, Tab, Modal } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faStop } from '@fortawesome/free-solid-svg-icons';
import { collection, addDoc, query, orderBy, limit, onSnapshot, getDocs, where, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

interface TimerSettings {
  focusTime: number;  // 以分鐘為單位
  breakTime: number;  // 以分鐘為單位
}

interface TaskRecord {
  id: string;
  userId: string;
  task: string;
  duration: number;
  type: 'focus' | 'break';
  completed: boolean;
  timestamp: Date;
}

interface UserGoals {
  dailyMinutes: number;  // 每日目標分鐘數
  weeklyMinutes: number; // 每週目標分鐘數
}

export default function PomodoroTimer() {
  const [settings, setSettings] = useState<TimerSettings>({
    focusTime: 25,
    breakTime: 5
  });
  const [timeLeft, setTimeLeft] = useState(settings.focusTime * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isFocusTime, setIsFocusTime] = useState(true);
  const [task, setTask] = useState('');
  const [recentTasks, setRecentTasks] = useState<TaskRecord[]>([]);
  const [goals, setGoals] = useState<UserGoals>({
    dailyMinutes: 120,
    weeklyMinutes: 600
  });
  const [showGoalsModal, setShowGoalsModal] = useState(false);

  const resetTimer = () => {
    setTimeLeft(isFocusTime ? settings.focusTime * 60 : settings.breakTime * 60);
  };

  // 載入用戶目標設置
  const loadUserGoals = useCallback(async (userId: string) => {
    try {
      const goalsRef = collection(db, 'user_goals');
      const q = query(goalsRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        setGoals({
          dailyMinutes: data.dailyMinutes,
          weeklyMinutes: data.weeklyMinutes
        });
      }
    } catch (error) {
      console.error('載入目標設置失敗:', error);
    }
  }, []);

  // 儲存用戶目標設置
  const saveUserGoals = async (newGoals: UserGoals) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    
    try {
      const goalsRef = collection(db, 'user_goals');
      const q = query(goalsRef, where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // 創建新的目標設置
        await addDoc(goalsRef, {
          userId: currentUser.uid,
          dailyMinutes: newGoals.dailyMinutes,
          weeklyMinutes: newGoals.weeklyMinutes,
          createdAt: new Date()
        });
      } else {
        // 更新現有的目標設置
        const docRef = querySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          dailyMinutes: newGoals.dailyMinutes,
          weeklyMinutes: newGoals.weeklyMinutes,
          updatedAt: new Date()
        });
      }
      
      setGoals(newGoals);
      setShowGoalsModal(false);
    } catch (error) {
      console.error('儲存目標設置失敗:', error);
    }
  };

  const loadRecentTasks = useCallback((userId: string) => {
    const tasksRef = collection(db, 'pomodoroTasks');
    const q = query(
      tasksRef,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    
    // 返回取消訂閱函數
    return onSnapshot(q, (snapshot) => {
      try {
        const tasks = snapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              userId: data.userId as string,
              task: data.task as string,
              duration: data.duration as number,
              type: data.type as 'focus' | 'break',
              completed: data.completed as boolean,
              timestamp: data.timestamp.toDate()
            } satisfies TaskRecord;
          });
        
        setRecentTasks(tasks);
      } catch (error) {
        console.error('讀取任務記錄失敗:', error);
      }
    }, (error: { code?: string; message?: string }) => {
      if (error?.code === 'failed-precondition') {
        console.error('需要創建複合索引。請訪問 Firebase Console 創建索引：', error.message);
      } else if (error?.code === 'permission-denied') {
        console.error('沒有訪問權限:', error);
      } else {
        console.error('監聽任務記錄失敗:', error);
      }
    });
  }, []);

  const handleTimerComplete = useCallback(async () => {
    try {
      // 根據目前階段播放不同音樂
      const audio = isFocusTime
        ? new Audio('/25min.mp3')
        : new Audio('/5min.mp3');
      audio.play().catch(error => console.log('播放通知音效失敗:', error));
    } catch (error) {
      console.log('創建音效物件失敗:', error);
    }

    // 儲存已完成的任務到 Firestore
    if (auth.currentUser && task) {
      try {
        const tasksRef = collection(db, 'pomodoroTasks');
        await addDoc(tasksRef, {
          userId: auth.currentUser.uid,
          task: task,
          duration: isFocusTime ? settings.focusTime : settings.breakTime,
          type: isFocusTime ? 'focus' : 'break',
          completed: true,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('儲存任務記錄失敗:', error);
      }
    }

    // 如果當前是休息時間結束，代表完成一個完整循環
    if (!isFocusTime) {
      // 重置為專注時間並停止計時器
      setIsFocusTime(true);
      setTimeLeft(settings.focusTime * 60);
      setIsRunning(false);
      setTask(''); // 清空當前任務
    } else {
      // 從專注時間切換到休息時間
      setIsFocusTime(false);
      setTimeLeft(settings.breakTime * 60);
      // 保持計時器運行
    }
  }, [isFocusTime, settings.focusTime, settings.breakTime, task]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimerComplete();
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, handleTimerComplete]);

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);
  const handleStop = () => {
    setIsRunning(false);
    resetTimer();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const progress = 
    (timeLeft / (isFocusTime ? settings.focusTime * 60 : settings.breakTime * 60)) * 100;

  // 監聽 Firebase Auth 狀態變化並訂閱任務記錄
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      if (user) {
        loadRecentTasks(user.uid);
        loadUserGoals(user.uid);
      }
    });

    // 清理函數：組件卸載時取消所有訂閱
    return () => {
      unsubscribeAuth();
    };
  }, [loadRecentTasks, loadUserGoals]);

  return (
    <Container fluid>
      <Row className="g-4">
        {/* 左側：計時器部分 */}
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Card.Title>{isFocusTime ? '專注時間' : '休息時間'}</Card.Title>
              <div className="mb-3">
                <Form.Group className="mb-2">
                  <Form.Label>專注時間 (分鐘)</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    max="60"
                    value={settings.focusTime}
                    onChange={(e) => {
                      const value = Math.min(60, Math.max(1, parseInt(e.target.value) || 1));
                      setSettings(prev => ({ ...prev, focusTime: value }));
                      if (isFocusTime) {
                        setTimeLeft(value * 60);
                      }
                    }}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>休息時間 (分鐘)</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    max="30"
                    value={settings.breakTime}
                    onChange={(e) => {
                      const value = Math.min(30, Math.max(1, parseInt(e.target.value) || 1));
                      setSettings(prev => ({ ...prev, breakTime: value }));
                      if (!isFocusTime) {
                        setTimeLeft(value * 60);
                      }
                    }}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>當前任務</Form.Label>
                  <Form.Select
                    className="mb-2"
                    value={task}
                    onChange={e => setTask(e.target.value)}
                  >
                    <option value="">選擇已存在任務</option>
                    {[...new Set(recentTasks.map(t => t.task).filter(Boolean))].map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </Form.Select>
                  <Form.Control
                    type="text"
                    placeholder="或手動輸入新任務..."
                    value={task}
                    onChange={e => setTask(e.target.value)}
                  />
                </Form.Group>
              </div>
              <div className="text-center mb-3">
                <h1 className="display-1">{formatTime(timeLeft)}</h1>
              </div>
              <ProgressBar
                now={progress}
                variant={isFocusTime ? "primary" : "success"}
                className="mb-3"
              />
              <div className="d-flex justify-content-center gap-2">
                {!isRunning ? (
                  <Button variant="primary" onClick={handleStart}>
                    <FontAwesomeIcon icon={faPlay} /> 開始
                  </Button>
                ) : (
                  <Button variant="warning" onClick={handlePause}>
                    <FontAwesomeIcon icon={faPause} /> 暫停
                  </Button>
                )}
                <Button variant="danger" onClick={handleStop}>
                  <FontAwesomeIcon icon={faStop} /> 停止
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* 右側：頁籤式面板 */}
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <Card.Body>
              <Tabs defaultActiveKey="history" className="mb-3">
                {/* 任務歷史頁籤 */}
                <Tab eventKey="history" title="本日達成">
                  {recentTasks.length > 0 ? (
                    <Card>
                      <Card.Header>任務列表</Card.Header>
                      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <ListGroup variant="flush">
                          {recentTasks
                            .filter(task => task.timestamp.toDateString() === new Date().toDateString())
                            .reduce((acc, task) => {
                              if (task.type === 'focus') {
                                const cycleStart = task.timestamp.getTime();
                                const breakTask = recentTasks.find(
                                  t => t.type === 'break' &&
                                  t.task === task.task &&
                                  Math.abs(t.timestamp.getTime() - cycleStart) < 300000 // 5分鐘內的休息時間
                                );
                                const totalDuration = task.duration + (breakTask?.duration || 0);
                                acc.push({
                                  id: task.id,
                                  task: task.task,
                                  totalDuration,
                                  focusDuration: task.duration,
                                  breakDuration: breakTask?.duration || 0,
                                  completed: task.completed,
                                  timestamp: task.timestamp
                                });
                              }
                              return acc;
                            }, [] as Array<{
                              id: string;
                              task: string;
                              totalDuration: number;
                              focusDuration: number;
                              breakDuration: number;
                              completed: boolean;
                              timestamp: Date;
                            }>)
                            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                            .map(({ id, task, totalDuration, focusDuration, breakDuration, completed, timestamp }) => (
                              <ListGroup.Item key={id} className="d-flex justify-content-between align-items-start py-3">
                                <div>
                                  <div className="fw-bold">{task || '未命名任務'}</div>
                                  <small className="text-muted">
                                    {timestamp.toLocaleString()}
                                  </small>
                                </div>
                                <div className="d-flex flex-column align-items-end">
                                  <div className="d-flex gap-2 align-items-center mb-1">
                                    <Badge bg={completed ? "success" : "warning"}>
                                      總時間: {totalDuration} 分鐘
                                    </Badge>
                                  </div>
                                  <div className="d-flex gap-2 align-items-center">
                                    <small>
                                      <Badge bg="primary" pill>
                                        專注 {focusDuration} 分鐘
                                      </Badge>
                                      {breakDuration > 0 && (
                                        <Badge bg="success" pill className="ms-1">
                                          休息 {breakDuration} 分鐘
                                        </Badge>
                                      )}
                                    </small>
                                  </div>
                                </div>
                              </ListGroup.Item>
                            ))}
                        </ListGroup>
                      </div>
                    </Card>
                  ) : (
                    <p className="text-center text-muted my-4">還沒有完成的任務記錄</p>
                  )}
                </Tab>

                {/* 統計資訊頁籤 */}
                <Tab eventKey="stats" title="統計資訊">
                  <div className="p-3">
                    <h5>今日統計</h5>
                    <ListGroup variant="flush">
                      <ListGroup.Item className="d-flex justify-content-between align-items-center">
                        <span>專注時間</span>
                        <span>
                          {recentTasks
                            .filter(t => t.type === 'focus' && 
                              t.timestamp.toDateString() === new Date().toDateString())
                            .reduce((acc, t) => acc + t.duration, 0)} 分鐘
                        </span>
                      </ListGroup.Item>
                      <ListGroup.Item className="d-flex justify-content-between align-items-center">
                        <span>完成番茄數</span>
                        <span>
                          {new Set(
                            recentTasks
                              .filter(t => 
                                t.type === 'focus' && 
                                t.timestamp.toDateString() === new Date().toDateString()
                              )
                              .map(t => t.task)
                          ).size} 個
                        </span>
                      </ListGroup.Item>
                    </ListGroup>

                    <h5 className="mt-4">本週統計</h5>
                    <ListGroup variant="flush">
                      <ListGroup.Item className="d-flex justify-content-between align-items-center">
                        <span>總專注時間</span>
                        <span>
                          {recentTasks
                            .filter(t => 
                              t.type === 'focus' && 
                              t.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                            )
                            .reduce((acc, t) => acc + t.duration, 0)} 分鐘
                        </span>
                      </ListGroup.Item>
                      <ListGroup.Item className="d-flex justify-content-between align-items-center">
                        <span>完成番茄數</span>
                        <span>
                          {new Set(
                            recentTasks
                              .filter(t => 
                                t.type === 'focus' && 
                                t.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                              )
                              .map(t => t.task)
                          ).size} 個
                        </span>
                      </ListGroup.Item>
                      <ListGroup.Item className="d-flex justify-content-between align-items-center">
                        <span>平均每日專注</span>
                        <span>
                          {Math.round(
                            recentTasks
                              .filter(t => 
                                t.type === 'focus' && 
                                t.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                              )
                              .reduce((acc, t) => acc + t.duration, 0) / 7
                          )} 分鐘
                        </span>
                      </ListGroup.Item>
                    </ListGroup>
                  </div>
                </Tab>

                {/* 目標追蹤頁籤 */}
                <Tab eventKey="goals" title="達成情形">
                  <div className="p-3">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <h6>設置目標時間</h6>
                      <Button variant="outline-primary" size="sm" onClick={() => setShowGoalsModal(true)}>
                        調整時間
                      </Button>
                    </div>

                    <div className="mb-4">
                      <h6>每日目標</h6>
                      <ProgressBar className="mt-2">
                        <ProgressBar 
                          variant="primary"
                          now={Math.min(100, (recentTasks
                            .filter(t => t.type === 'focus' && 
                              t.timestamp.toDateString() === new Date().toDateString())
                            .reduce((acc, t) => acc + t.duration, 0) / goals.dailyMinutes) * 100)}
                          label={`${Math.round((recentTasks
                            .filter(t => t.type === 'focus' && 
                              t.timestamp.toDateString() === new Date().toDateString())
                            .reduce((acc, t) => acc + t.duration, 0) / goals.dailyMinutes) * 100)}%`}
                        />
                      </ProgressBar>
                      <small className="text-muted">目標：每日專注 {goals.dailyMinutes} 分鐘</small>
                    </div>

                    <div>
                      <h6>本週目標</h6>
                      <ProgressBar className="mt-2">
                        <ProgressBar 
                          variant="success"
                          now={Math.min(100, (recentTasks
                            .filter(t => t.type === 'focus' && 
                              t.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                            .reduce((acc, t) => acc + t.duration, 0) / goals.weeklyMinutes) * 100)}
                          label={`${Math.round((recentTasks
                            .filter(t => t.type === 'focus' && 
                              t.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                            .reduce((acc, t) => acc + t.duration, 0) / goals.weeklyMinutes) * 100)}%`}
                        />
                      </ProgressBar>
                      <small className="text-muted">目標：每週專注 {goals.weeklyMinutes} 分鐘</small>
                    </div>
                  </div>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* 目標設置 Modal */}
      <Modal show={showGoalsModal} onHide={() => setShowGoalsModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>設定目標</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const newGoals = {
              dailyMinutes: parseInt(formData.get('dailyMinutes') as string) || 120,
              weeklyMinutes: parseInt(formData.get('weeklyMinutes') as string) || 600
            };
            saveUserGoals(newGoals);
          }}>
            <Form.Group className="mb-3">
              <Form.Label>每日專注目標 (分鐘)</Form.Label>
              <Form.Control
                type="number"
                name="dailyMinutes"
                min="1"
                defaultValue={goals.dailyMinutes}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>每週專注目標 (分鐘)</Form.Label>
              <Form.Control
                type="number"
                name="weeklyMinutes"
                min="1"
                defaultValue={goals.weeklyMinutes}
                required
              />
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={() => setShowGoalsModal(false)}>
                取消
              </Button>
              <Button variant="primary" type="submit">
                儲存
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
}
