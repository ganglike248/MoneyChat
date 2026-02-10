// /src/App.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import ChatbotPage from './components/ChatbotPage';

export const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://moneychat-backend-17g5.onrender.com';

function App() {
  useEffect(() => {
    fetch(`${BACKEND_BASE_URL}/health`).catch((error) => {
      console.warn('Wake-up ping failed:', error);
    });
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
