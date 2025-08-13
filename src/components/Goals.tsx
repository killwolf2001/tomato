import { useState, useEffect } from 'react';
import { Card, Form, Button, ListGroup, ProgressBar } from 'react-bootstrap';
import { collection, addDoc, query, where, updateDoc, doc, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
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

  useEffect(() => {
    const unsubscribe = loadGoals();
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

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

  const updateGoalProgress = async (goalId: string, currentMinutes: number) => {
    if (!auth.currentUser) return;

    const goalRef = doc(db, 'goals', goalId);
    const goal = goals.find(g => g.id === goalId);
    
    if (!goal) {
      console.error('Goal not found');
      return;
    }

    try {
      await updateDoc(goalRef, {
        currentMinutes,
        completed: currentMinutes >= goal.targetMinutes
      });
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

  return (
    <Card>
      <Card.Header>目標追蹤</Card.Header>
      <Card.Body>
        <Form onSubmit={handleSubmit} className="mb-3">
          <Form.Group className="mb-3">
            <Form.Label>目標名稱</Form.Label>
            <Form.Control
              type="text"
              value={newGoal.title}
              onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
              required
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
          <Button type="submit">新增目標</Button>
        </Form>

        <ListGroup>
          {goals.map((goal) => (
            <ListGroup.Item key={goal.id}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6>{goal.title}</h6>
                <div className="d-flex align-items-center gap-2">
                  <Form.Control
                    type="number"
                    size="sm"
                    style={{ width: '80px' }}
                    value={goal.currentMinutes}
                    onChange={(e) => {
                      const newMinutes = Math.max(0, parseInt(e.target.value) || 0);
                      updateGoalProgress(goal.id, newMinutes);
                    }}
                    min="0"
                    max={goal.targetMinutes}
                  />
                  <small>/ {goal.targetMinutes} 分鐘</small>
                </div>
              </div>
              <ProgressBar
                now={(goal.currentMinutes / goal.targetMinutes) * 100}
                variant={goal.completed ? 'success' : 'primary'}
              />
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card.Body>
    </Card>
  );
}
