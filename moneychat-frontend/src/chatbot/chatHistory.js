// /src/chatbot/chatHistory.js
// 사용자별 대화 기록을 이 기기(localStorage)에 저장
// 개인 브라우저 설정이나 저장 공간 부족으로 실패할 수 있으므로 오류는 무시
import { toPersistableMessages } from './expenseUtils';

const KEY_PREFIX = 'moneychat-history-';
const storageKey = (uid) => `${KEY_PREFIX}${uid}`;

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

// 로그인한 계정 외의 대화 기록 삭제
// 로그아웃해도 기록은 남고, 같은 계정으로 다시 로그인하면 이어서 보이며, 다른 계정으로 로그인하면 지워짐
export const clearOtherUsersChatHistory = (uid) => {
  try {
    const keep = storageKey(uid);
    const others = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX) && key !== keep) others.push(key);
    }
    others.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    // 무시
  }
};
