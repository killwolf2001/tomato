'use client';

import { Container, Row, Col, Tabs, Tab } from 'react-bootstrap';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { logout } from '@/lib/logout';
import Auth from '@/components/Auth';
import PomodoroTimer from '@/components/PomodoroTimer';
import TaskHistory from '@/components/TaskHistory';
import Statistics from '@/components/Statistics';
import Goals from '@/components/Goals';

export default function Home() {
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  if (!user) {
    return <Auth />;
  }

  return (
    <Container fluid className="py-4">
      <Row className="mb-4 align-items-center">
        <Col lg={6} className="mx-auto">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="fw-bold">番茄鐘</span>
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={async () => {
                await logout();
                setUser(null);
              }}
            >
              登出
            </button>
          </div>
          <PomodoroTimer />
        </Col>
      </Row>
      <Row>
        <Col lg={8} className="mx-auto">
          <Tabs defaultActiveKey="history" className="mb-3">
            <Tab eventKey="history" title="歷史任務列表">
              <TaskHistory />
            </Tab>
            <Tab eventKey="statistics" title="任務統計資訊">
              <Statistics />
            </Tab>
            <Tab eventKey="goals" title="指定任務追蹤">
              <Goals />
            </Tab>
          </Tabs>
        </Col>
      </Row>
    </Container>
  );
}
