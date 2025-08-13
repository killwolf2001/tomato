import { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Form } from 'react-bootstrap';
import { collection, query, where, getDocs } from 'firebase/firestore';
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

  const loadStats = useCallback(async () => {
    if (!auth.currentUser) return;
    setStats({
        totalTasks: 0,
        totalFocusMinutes: 0,
        totalBreakMinutes: 0,
        completedTasks: 0,
        averageMinutesPerDay: 0
      });

      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef,
        where('userId', '==', auth.currentUser.uid)
      );

      const querySnapshot = await getDocs(q);
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
      const uniqueTaskNames = Array.from(new Set(tasks.map(t => t.task)));
      setUniqueTasks(uniqueTaskNames);

      // 過濾選中的任務
      const filteredTasks = selectedTask === 'all' ? tasks : tasks.filter(t => t.task === selectedTask);

      let totalFocusMinutes = 0;
      let totalBreakMinutes = 0;
      let totalTasks = 0;
      let completedTasks = 0;

      filteredTasks.forEach(task => {
        totalTasks++;
        if (task.type === 'focus') {
          totalFocusMinutes += task.duration;
        } else {
          totalBreakMinutes += task.duration;
        }
        if (task.completed) completedTasks++;
      });

      // 計算平均每日專注時間
      if (filteredTasks.length > 0) {
        const oldestTask = filteredTasks.reduce((oldest, task) => 
          task.timestamp < oldest.timestamp ? task : oldest
        );
        const daysSinceStart = Math.ceil(
          (new Date().getTime() - oldestTask.timestamp.getTime()) / (1000 * 60 * 60 * 24)
        );
        const averageMinutesPerDay = Math.round((totalFocusMinutes + totalBreakMinutes) / daysSinceStart);

        setStats({
          totalTasks,
          totalFocusMinutes,
          totalBreakMinutes,
          completedTasks,
          averageMinutesPerDay
        });
      }
  }, [selectedTask]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <Card>
      <Card.Header>統計資訊</Card.Header>
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
            <h6>總任務數</h6>
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
            <h6>完成任務數</h6>
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
