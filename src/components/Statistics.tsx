import { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Form } from 'react-bootstrap';
import { collection, query, where, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface Task {
  id: string;
  task: string;
  duration: number;
  type: 'focus' | 'break';
  completed: boolean;
  timestamp: Date;
  userId: string;
}

interface Stats {
  totalTasks: number;
  totalFocusMinutes: number;
  totalBreakMinutes: number;
  completedTasks: number;
  averageMinutesPerDay: number;
}

export default function Statistics() {
  const [stats, setStats] = useState<Stats>({
    totalTasks: 0,
    totalFocusMinutes: 0,
    totalBreakMinutes: 0,
    completedTasks: 0,
    averageMinutesPerDay: 0,
  });
  const [selectedTask, setSelectedTask] = useState<string>('all');
  const [uniqueTasks, setUniqueTasks] = useState<string[]>([]);

  const loadStats = useCallback(() => {
    if (!auth.currentUser) return;
    
    const tasksRef = collection(db, 'pomodoroTasks');
    const q = query(
      tasksRef,
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const tasks = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          task: data.task as string,
          duration: data.duration as number,
          type: data.type as 'focus' | 'break',
          completed: data.completed as boolean,
          timestamp: data.timestamp.toDate(),
          userId: data.userId as string
        } satisfies Task;
      });

      // 計算唯一任務列表
      const uniqueTaskNames = Array.from(new Set(tasks.map(t => t.task))) as string[];
      setUniqueTasks(uniqueTaskNames);

      // 過濾選中的任務
      const filteredTasks = selectedTask === 'all' ? tasks : tasks.filter(t => t.task === selectedTask);

      let totalFocusMinutes = 0;
      let totalBreakMinutes = 0;
      let completedTasks = 0;

      // 用於追踪每個任務名稱是否已計算
      const countedTasks = new Set<string>();
      
      // 分別計算專注和休息時間
      filteredTasks.forEach(task => {
        if (task.type === 'focus') {
          totalFocusMinutes += task.duration;
        } else {
          totalBreakMinutes += task.duration;
        }
        
        // 只在遇到專注類型時計算完成的任務
        if (task.type === 'focus') {
          countedTasks.add(task.task);
          if (task.completed) {
            completedTasks++;
          }
        }
      });

      // 計算平均每日專注時間
      if (filteredTasks.length > 0) {
        const oldestTask = filteredTasks.reduce((oldest: Task, task: Task) => 
          task.timestamp < oldest.timestamp ? task : oldest
        );
        const daysSinceStart = Math.ceil(
          (new Date().getTime() - oldestTask.timestamp.getTime()) / (1000 * 60 * 60 * 24)
        );
        const averageMinutesPerDay = Math.round(totalFocusMinutes / daysSinceStart);

        setStats({
          totalTasks: countedTasks.size,
          totalFocusMinutes,
          totalBreakMinutes,
          completedTasks,
          averageMinutesPerDay
        });
      } else {
        setStats({
          totalTasks: 0,
          totalFocusMinutes: 0,
          totalBreakMinutes: 0,
          completedTasks: 0,
          averageMinutesPerDay: 0
        });
      }
    });

    return unsubscribe;
  }, [selectedTask]);

  useEffect(() => {
    const unsubscribe = loadStats();
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadStats]);

  return (
    <Card>
      <Card.Header>歷史任務統計資訊</Card.Header>
      <Card.Body>
        <Form.Group className="mb-3">
          <Form.Label>選擇任務</Form.Label>
          <Form.Select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
          >
            <option value="all">全部任務</option>
            {uniqueTasks.map(task => (
              <option key={task} value={task}>{task}</option>
            ))}
          </Form.Select>
        </Form.Group>

        <Row>
          <Col sm={6} md={3} className="text-center mb-3">
            <h6>總番茄數</h6>
            <h3>{stats.totalTasks}</h3>
          </Col>
          <Col sm={6} md={3} className="text-center mb-3">
            <h6>總專注時間</h6>
            <h3>{stats.totalFocusMinutes} 分鐘</h3>
          </Col>
          <Col sm={6} md={3} className="text-center mb-3">
            <h6>總休息時間</h6>
            <h3>{stats.totalBreakMinutes} 分鐘</h3>
          </Col>
          <Col sm={6} md={3} className="text-center mb-3">
            <h6>完成番茄數</h6>
            <h3>{stats.completedTasks}</h3>
          </Col>
          <Col sm={6} md={3} className="text-center mb-3">
            <h6>平均每日專注</h6>
            <h3>{stats.averageMinutesPerDay} 分鐘</h3>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}
