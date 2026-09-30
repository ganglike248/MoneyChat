// /src/api.js
import { auth } from './firebase/firebaseConfig';

export const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://moneychat-backend-17g5.onrender.com';

// 무료 서버가 잠들어 있으면 깨어나는 데 1~2분 걸리므로 넉넉하게 설정
const REQUEST_TIMEOUT = 90 * 1000;

// Render 무료 서버는 15분 동안 요청이 없으면 잠들기 때문에 미리 깨움
export const wakeUpServer = () => {
  fetch(`${BACKEND_BASE_URL}/health`).catch((error) => {
    console.warn('Wake-up ping failed:', error);
  });
};

// 로그인한 사용자의 Firebase ID 토큰을 붙여서 백엔드 API 호출
export const postToBackend = async (path, body) => {
  const user = auth.currentUser;
  if (!user) {
    const error = new Error('Not authenticated');
    error.status = 401;
    throw error;
  }

  const token = await user.getIdToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response;
  try {
    response = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (fetchError) {
    const error = new Error(fetchError.message);
    error.status = fetchError.name === 'AbortError' ? 'timeout' : 'network';
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const error = new Error(`HTTP error! status: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
};
