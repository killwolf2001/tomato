
import React, { useEffect, useState } from 'react';
import { Card, ListGroup, Badge } from 'react-bootstrap';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
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
        orderBy('timestamp', 'desc')
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

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // 日曆狀態
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 取得所有有紀錄的日期（yyyy-mm-dd）
  const recordDates = Object.keys(groupedByDate).map(dateStr => {
    const d = new Date(dateStr);
    return d.toISOString().slice(0, 10);
  });

  // 年月切換狀態
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth()); // 0-based

  // 產生指定年月的日曆
  const firstDay = new Date(calendarYear, calendarMonth, 1);
  const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const calendar: Array<{ date: Date; hasRecord: boolean } | null> = [];
  for (let i = 0; i < firstDay.getDay(); i++) calendar.push(null); // 前面補空
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(calendarYear, calendarMonth, d);
    const dateStr = dateObj.toISOString().slice(0, 10);
    calendar.push({ date: dateObj, hasRecord: recordDates.includes(dateStr) });
  }

  // 分頁狀態：每個日期一頁
  const [pageByDate, setPageByDate] = useState<{ [date: string]: number }>({});
  const PAGE_SIZE = 10;

  // 初始化分頁狀態
  useEffect(() => {
    const newPageByDate: { [date: string]: number } = {};
    sortedDates.forEach(date => {
      if (!(date in pageByDate)) newPageByDate[date] = 1;
      else newPageByDate[date] = pageByDate[date];
    });
    setPageByDate(newPageByDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length]);

  return (
    <Card>
      <Card.Header>任務歷史</Card.Header>
      {/* 日曆層 */}
      <div className="mb-3">
        <div className="d-flex justify-content-center align-items-center mb-2 fw-bold" style={{ gap: 8 }}>
          <button className="btn btn-sm btn-outline-primary" onClick={() => setCalendarYear(y => y - 1)}>&lt;&lt;</button>
          <button className="btn btn-sm btn-outline-primary" onClick={() => {
            if (calendarMonth === 0) {
              setCalendarYear(y => y - 1);
              setCalendarMonth(11);
            } else {
              setCalendarMonth(m => m - 1);
            }
          }}>&lt;</button>
          <span style={{ minWidth: 90, textAlign: 'center' }}>{calendarYear} 年 {calendarMonth + 1} 月</span>
          <button className="btn btn-sm btn-outline-primary" onClick={() => {
            if (calendarMonth === 11) {
              setCalendarYear(y => y + 1);
              setCalendarMonth(0);
            } else {
              setCalendarMonth(m => m + 1);
            }
          }}>&gt;</button>
          <button className="btn btn-sm btn-outline-primary" onClick={() => setCalendarYear(y => y + 1)}>&gt;&gt;</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {["日", "一", "二", "三", "四", "五", "六"].map(w => (
            <div key={w} className="text-center text-muted" style={{ fontSize: '0.95em' }}>{w}</div>
          ))}
          {calendar.map((cell, idx) => cell ? (
            <button
              key={cell.date.toISOString()}
              className={`btn btn-sm ${cell.hasRecord ? 'btn-primary' : 'btn-outline-secondary'} ${selectedDate === cell.date.toLocaleDateString() ? 'fw-bold border border-dark' : ''}`}
              style={{ minHeight: 32, minWidth: 32, margin: 0, padding: 0 }}
              disabled={!cell.hasRecord}
              onClick={() => setSelectedDate(cell.date.toLocaleDateString())}
            >
              {cell.date.getDate()}
            </button>
          ) : <div key={idx} />)}
        </div>
      </div>
      {/* 當日列表層 */}
      <ListGroup variant="flush">
        {!selectedDate && (
          <ListGroup.Item className="text-center text-muted">請先點選有紀錄的日期</ListGroup.Item>
        )}
        {selectedDate && groupedByDate[selectedDate] && (() => {
          const tasksForDate = groupedByDate[selectedDate] || [];
          const totalPages = Math.ceil(tasksForDate.length / PAGE_SIZE);
          const currentPage = pageByDate[selectedDate] || 1;
          const startIdx = (currentPage - 1) * PAGE_SIZE;
          const endIdx = startIdx + PAGE_SIZE;
          return (
            <>
              <ListGroup.Item className="bg-light fw-bold d-flex justify-content-between align-items-center">
                <span>{selectedDate}</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedDate(null)}>返回日曆</button>
              </ListGroup.Item>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {tasksForDate.slice(startIdx, endIdx).map(task => (
                  <ListGroup.Item
                    key={task.id}
                    className="d-flex justify-content-between align-items-center"
                  >
                    <div>
                      {task.task || '未命名任務'}
                      <br />
                      <small className="text-muted">
                        {task.timestamp.toLocaleTimeString()} ~ {new Date(task.timestamp.getTime() + task.duration * 60 * 1000).toLocaleTimeString()}
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
                ))}
              </div>
              {totalPages > 1 && (
                <div className="d-flex justify-content-end align-items-center mt-2" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                  {/* 第一頁(<<) */}
                  <button
                    className="btn btn-sm btn-outline-primary"
                    disabled={currentPage === 1}
                    onClick={() => setPageByDate(prev => ({ ...prev, [selectedDate]: 1 }))}
                  >
                    {'<<'}
                  </button>
                  {/* 上一頁(<) */}
                  <button
                    className="btn btn-sm btn-outline-primary"
                    disabled={currentPage === 1}
                    onClick={() => setPageByDate(prev => ({ ...prev, [selectedDate]: Math.max(1, currentPage - 1) }))}
                  >
                    &#60;
                  </button>
                  {/* 中央數字分頁，最多顯示 3 頁，超過時顯示 ... */}
                  {(() => {
                    const pageButtons = [];
                    let start = Math.max(1, currentPage - 1);
                    let end = Math.min(totalPages, currentPage + 1);
                    if (end - start < 2) {
                      if (start === 1) end = Math.min(totalPages, start + 2);
                      if (end === totalPages) start = Math.max(1, end - 2);
                    }
                    if (start > 1) pageButtons.push(<span key="start-ellipsis">...</span>);
                    for (let page = start; page <= end; page++) {
                      pageButtons.push(
                        <button
                          key={page}
                          className={`btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-outline-primary'}`}
                          style={{ margin: '0 0.2rem', minWidth: 32 }}
                          onClick={() => setPageByDate(prev => ({ ...prev, [selectedDate]: page }))}
                        >
                          {page}
                        </button>
                      );
                    }
                    if (end < totalPages) pageButtons.push(<span key="end-ellipsis">...</span>);
                    return pageButtons;
                  })()}
                  {/* 下一頁(>) */}
                  <button
                    className="btn btn-sm btn-outline-primary"
                    disabled={currentPage === totalPages}
                    onClick={() => setPageByDate(prev => ({ ...prev, [selectedDate]: Math.min(totalPages, currentPage + 1) }))}
                  >
                    &#62;
                  </button>
                  {/* 最末頁(>>) */}
                  <button
                    className="btn btn-sm btn-outline-primary"
                    disabled={currentPage === totalPages}
                    onClick={() => setPageByDate(prev => ({ ...prev, [selectedDate]: totalPages }))}
                  >
                    {'>>'}
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </ListGroup>
    </Card>
  );
}
