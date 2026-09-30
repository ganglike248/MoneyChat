// /src/chatbot/chatHistory.js
// 사용자별 대화 기록을 이 기기(localStorage)에 저장
// 개인 브라우저 설정이나 저장 공간 부족으로 실패할 수 있으므로 오류는 무시
import { toPersistableMessages } from './expenseUtils';

const storageKey = (uid) => `moneychat-history-${uid}`;

export const loadChatHistory = (uid) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(uid)));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

export const saveChatHistory = (uid, messages, loadingId) => {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(toPersistableMessages(messages, loadingId)));
  } catch (error) {
    // 저장에 실패해도 채팅은 계속 사용 가능
  }
};

export const clearChatHistory = (uid) => {
  try {
    localStorage.removeItem(storageKey(uid));
  } catch (error) {
    // 무시
  }
};
