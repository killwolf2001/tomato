
import React, { useEffect, useState } from 'react';
import { Card, ListGroup, Badge } from 'react-bootstrap';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface Task {
  id: string;
  task: string;  // 修改為與 Firestore 中的欄位名稱一致
  timestamp: Date;
  duration: number;
  type: 'focus' | 'break';
  completed: boolean;
}

export default function TaskHistory() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const loadTasks = (userId: string) => {
      const tasksRef = collection(db, 'pomodoroTasks');
      const q = query(
        tasksRef,
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(10)
      );

      return onSnapshot(q, (snapshot) => {
        const loadedTasks: Task[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate(),
        } as Task));

        // 按任務名稱和時間戳對任務進行分組
        const groupedTasks = loadedTasks.reduce<Task[]>((acc, task) => {
          // 只添加專注時間的記錄
          if (task.type === 'focus') {
            // 查找對應的休息時間記錄
            const breakTask = loadedTasks.find(
              t => t.type === 'break' && 
                  t.task === task.task && 
                  Math.abs(t.timestamp.getTime() - task.timestamp.getTime()) < 300000 // 5分鐘內
            );
            // 如果找到對應的休息時間，把休息時間也加到持續時間中
            if (breakTask) {
              task.duration += breakTask.duration;
            }
            acc.push(task);
          }
          return acc;
        }, []);

        // 按時間戳排序
        groupedTasks.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  setTasks(groupedTasks);
      }, (error: { code?: string; message?: string }) => {
        if (error?.code === 'failed-precondition') {
          console.error('需要創建複合索引。請訪問 Firebase Console 創建索引：', error.message);
        } else if (error?.code === 'permission-denied') {
          console.error('沒有訪問權限:', error);
        } else {
          console.error('監聽任務記錄失敗:', error);
        }
      });
    };

    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      if (user) {
        unsubscribe = loadTasks(user.uid);
      } else {
        setTasks([]);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // 依日期分組
  const groupedByDate: { [date: string]: Task[] } = {};
  tasks.forEach(task => {
    const dateStr = task.timestamp.toLocaleDateString();
    if (!groupedByDate[dateStr]) groupedByDate[dateStr] = [];
    groupedByDate[dateStr].push(task);
  });

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
    // 轉成 Date 物件比較
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return (
    <Card>
      <Card.Header>任務歷史</Card.Header>
      <ListGroup variant="flush">
        {sortedDates.length === 0 && (
          <ListGroup.Item className="text-center text-muted">尚無任務記錄</ListGroup.Item>
        )}
        {sortedDates.flatMap(dateStr => [
          <ListGroup.Item key={"date-" + dateStr} className="bg-light fw-bold">
            {dateStr}
          </ListGroup.Item>,
          ...groupedByDate[dateStr].map(task => (
            <ListGroup.Item
              key={task.id}
              className="d-flex justify-content-between align-items-center"
            >
              <div>
                {task.task || '未命名任務'}
                <br />
                <small className="text-muted">
                  {task.timestamp.toLocaleTimeString()}
                </small>
              </div>
              <div className="d-flex gap-2 align-items-center">
                <Badge bg={task.completed ? 'success' : 'warning'}>
                  總時間: {task.duration} 分鐘
                </Badge>
                <Badge bg="info">
                  {task.type === 'focus' ? '專注' : '休息'}
                </Badge>
              </div>
            </ListGroup.Item>
          ))
        ])}
      </ListGroup>
    </Card>
  );
}
