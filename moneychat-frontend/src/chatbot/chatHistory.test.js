import { loadChatHistory, saveChatHistory, clearOtherUsersChatHistory } from './chatHistory';

const message = (text) => ({ type: 'bot', id: text, text });

describe('clearOtherUsersChatHistory', () => {
  beforeEach(() => localStorage.clear());

  test('같은 계정으로 다시 로그인하면 기록 유지', () => {
    saveChatHistory('userA', [message('안녕하세요')], 'loading');
    clearOtherUsersChatHistory('userA');
    expect(loadChatHistory('userA')).toHaveLength(1);
  });

  test('다른 계정으로 로그인하면 이전 계정의 기록 삭제', () => {
    saveChatHistory('userA', [message('안녕하세요')], 'loading');
    saveChatHistory('userB', [message('반가워요')], 'loading');
    clearOtherUsersChatHistory('userB');
    expect(loadChatHistory('userA')).toEqual([]);
    expect(loadChatHistory('userB')).toHaveLength(1);
  });

  test('대화 기록이 아닌 다른 저장 값은 그대로', () => {
    localStorage.setItem('moneychat-theme', 'dark');
    saveChatHistory('userA', [message('안녕하세요')], 'loading');
    clearOtherUsersChatHistory('userB');
    expect(localStorage.getItem('moneychat-theme')).toBe('dark');
  });
});
