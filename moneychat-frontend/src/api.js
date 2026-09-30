// /src/api.js
import { auth } from './firebase/firebaseConfig';

export const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://moneychat-backend-17g5.onrender.com';

// 로그인한 사용자의 Firebase ID 토큰을 붙여서 백엔드 API 호출
export const postToBackend = async (path, body) => {
  const user = auth.currentUser;
  if (!user) {
    const error = new Error('Not authenticated');
    error.status = 401;
    throw error;
  }

  const token = await user.getIdToken();
  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = new Error(`HTTP error! status: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
};
