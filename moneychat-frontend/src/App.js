// /src/App.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import ChatbotPage from './components/ChatbotPage';
import { wakeUpServer } from './api';

// Render 무료 서버가 잠들기(15분) 전에 다시 깨우는 간격
const WAKE_UP_INTERVAL = 10 * 60 * 1000;

function App() {
  // 앱을 보고 있는 동안에는 서버가 잠들지 않도록 주기적으로 깨움
  useEffect(() => {
    const wakeUpIfVisible = () => {
      if (document.visibilityState === 'visible') wakeUpServer();
    };

    wakeUpServer();
    const interval = setInterval(wakeUpIfVisible, WAKE_UP_INTERVAL);
    document.addEventListener('visibilitychange', wakeUpIfVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', wakeUpIfVisible);
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/chatbot" element={<ChatbotPage />} />
      </Routes>
    </Router>
  );
}

export default App;
