import { useEffect, useState } from 'react';
import { Card, ListGroup, Badge } from 'react-bootstrap';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface Task {
  id: string;
  title: string;
  timestamp: Date;
  duration: number;
  completed: boolean;
}

export default function TaskHistory() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const loadTasks = async () => {
      if (!auth.currentUser) return;

      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef,
        where('userId', '==', auth.currentUser.uid)
      );

      const querySnapshot = await getDocs(q);
      const loadedTasks: Task[] = [];
      querySnapshot.forEach((doc) => {
        loadedTasks.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate(),
        } as Task);
      });

      setTasks(loadedTasks.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    };

    loadTasks();
  }, []);

  return (
    <Card>
      <Card.Header>任務歷史</Card.Header>
      <ListGroup variant="flush">
        {tasks.map((task) => (
          <ListGroup.Item
            key={task.id}
            className="d-flex justify-content-between align-items-center"
          >
            <div>
              {task.title}
              <br />
              <small className="text-muted">
                {task.timestamp.toLocaleDateString()} {task.timestamp.toLocaleTimeString()}
              </small>
            </div>
            <div>
              <Badge bg={task.completed ? 'success' : 'warning'}>
                {task.duration} 分鐘
              </Badge>
            </div>
          </ListGroup.Item>
        ))}
        {tasks.length === 0 && (
          <ListGroup.Item className="text-center text-muted">
            尚無任務記錄
          </ListGroup.Item>
        )}
      </ListGroup>
    </Card>
  );
}
