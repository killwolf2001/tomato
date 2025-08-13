'use client';

import { Container, Row, Col, Tabs, Tab } from 'react-bootstrap';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
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
      <Row className="mb-4">
        <Col lg={6} className="mx-auto">
          <PomodoroTimer />
        </Col>
      </Row>
      <Row>
        <Col lg={8} className="mx-auto">
          <Tabs defaultActiveKey="history" className="mb-3">
            <Tab eventKey="history" title="任務歷史">
              <TaskHistory />
            </Tab>
            <Tab eventKey="statistics" title="統計資訊">
              <Statistics />
            </Tab>
            <Tab eventKey="goals" title="目標追蹤">
              <Goals />
            </Tab>
          </Tabs>
        </Col>
      </Row>
    </Container>
  );
}
