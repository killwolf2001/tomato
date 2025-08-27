import { useState, useEffect } from 'react';
import { Card, Form, Button, ListGroup, ProgressBar } from 'react-bootstrap';
import { collection, addDoc, query, where, onSnapshot, getDocs, QuerySnapshot, DocumentData, doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface Goal {
  id: string;
  title: string;
  targetMinutes: number;
  currentMinutes: number;
  completed: boolean;
}

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState({ title: '', targetMinutes: 0 });
  const [taskStats, setTaskStats] = useState<{ [task: string]: number }>({});

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (auth.currentUser) {
      unsubscribe = loadGoals();
      loadTaskStats();
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
     
  }, []);

  // 取得所有歷史任務名稱
  const [allTaskNames, setAllTaskNames] = useState<string[]>([]);

  const loadAllTaskNames = async () => {
    if (!auth.currentUser) return;
    const tasksRef = collection(db, 'pomodoroTasks');
    const q = query(tasksRef, where('userId', '==', auth.currentUser.uid));
    const querySnapshot = await getDocs(q);
    const names = new Set<string>();
    querySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.type === 'focus' && data.task) {
        names.add(data.task);
      }
    });
    setAllTaskNames(Array.from(names));
  };

  useEffect(() => { loadAllTaskNames(); }, []);

  // 讀取歷史任務完成分鐘數
  const loadTaskStats = async () => {
    if (!auth.currentUser) return;
    const tasksRef = collection(db, 'pomodoroTasks');
    const q = query(tasksRef, where('userId', '==', auth.currentUser.uid));
    const querySnapshot = await getDocs(q);
    const stats: { [task: string]: number } = {};
    querySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.type === 'focus') {
        stats[data.task] = (stats[data.task] || 0) + (data.duration || 0);
      }
    });
    setTaskStats(stats);
  };

  const loadGoals = () => {
    if (!auth.currentUser) return;

    const goalsRef = collection(db, 'goals');
    const q = query(goalsRef, where('userId', '==', auth.currentUser.uid));
    
    return onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const loadedGoals: Goal[] = [];
      querySnapshot.forEach((doc) => {
        loadedGoals.push({ id: doc.id, ...doc.data() } as Goal);
      });
      setGoals(loadedGoals);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'goals'), {
        userId: auth.currentUser.uid,
        title: newGoal.title,
        targetMinutes: newGoal.targetMinutes,
        currentMinutes: 0,
        completed: false,
        createdAt: new Date()
      });

      setNewGoal({ title: '', targetMinutes: 0 });
    } catch (error) {
      console.error('Error adding goal:', error);
    }
  };


  // 刪除目標
  const handleDeleteGoal = async (goalId: string) => {
    if (!window.confirm('確定要刪除此目標？')) return;
    await deleteDoc(doc(db, 'goals', goalId));
  // manualProgress 已移除，無需處理
  };

  return (
    <Card>
      <Card.Header>歷史任務進度追蹤</Card.Header>
      <Card.Body>
        <Form onSubmit={handleSubmit} className="mb-3">
          <Form.Group className="mb-3">
            <Form.Label>追蹤任務名稱</Form.Label>
            <Form.Select
              value={newGoal.title}
              onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
              required
            >
              <option value="">選擇現有任務</option>
              {allTaskNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </Form.Select>
            <Form.Control
              className="mt-2"
              type="text"
              placeholder="或自行輸入新任務名稱"
              value={newGoal.title}
              onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>目標時間（分鐘）</Form.Label>
            <Form.Control
              type="number"
              value={newGoal.targetMinutes}
              onChange={(e) => setNewGoal({ ...newGoal, targetMinutes: parseInt(e.target.value) })}
              required
              min="1"
            />
          </Form.Group>
          <Button type="submit">新增追蹤任務</Button>
        </Form>

        <ListGroup>
          {goals.map((goal) => {
            const autoDone = taskStats[goal.title] || 0;
            const percent = Math.min(100, (autoDone / goal.targetMinutes) * 100);
            return (
              <ListGroup.Item key={goal.id}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6>{goal.title}</h6>
                  <div className="d-flex align-items-center gap-2">
                    <span>{autoDone} / {goal.targetMinutes} 分鐘</span>
                    <Button variant="outline-danger" size="sm" onClick={() => handleDeleteGoal(goal.id)}>刪除</Button>
                  </div>
                </div>
                <ProgressBar
                  now={percent}
                  variant={percent >= 100 ? 'success' : 'primary'}
                  label={`${Math.round(percent)}%`}
                />
                <div className="mt-1" style={{ fontSize: '0.9em', color: '#666' }}>
                  {/* 歷史自動統計完成百分比：{goal.targetMinutes > 0 ? Math.round((autoDone / goal.targetMinutes) * 100) : 0}% */}
                </div>
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      </Card.Body>
    </Card>
  );
}
