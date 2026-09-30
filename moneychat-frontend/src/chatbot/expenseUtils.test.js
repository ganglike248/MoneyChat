import {
  getPeriodStart, toAmount, summarizeExpenses, isValidExpenseItem, formatFeedback,
  toLocalDateString, expenseDateFromString, buildChatHistory, toPersistableMessages,
} from './expenseUtils';

describe('getPeriodStart', () => {
  // 2026년 9월 30일 수요일 15:30
  const now = new Date(2026, 8, 30, 15, 30);

  test('today는 오늘 0시', () => {
    expect(getPeriodStart('today', now)).toEqual(new Date(2026, 8, 30));
  });

  test('week는 이번 주 월요일 0시', () => {
    expect(getPeriodStart('week', now)).toEqual(new Date(2026, 8, 28));
  });

  test('일요일은 그 주의 마지막 날', () => {
    expect(getPeriodStart('week', new Date(2026, 9, 4, 20))).toEqual(new Date(2026, 8, 28));
  });

  test('월요일은 그날부터 새 주', () => {
    expect(getPeriodStart('week', new Date(2026, 9, 5, 9))).toEqual(new Date(2026, 9, 5));
  });

  test('month는 이번 달 1일 0시', () => {
    expect(getPeriodStart('month', now)).toEqual(new Date(2026, 8, 1));
  });
});

describe('toAmount', () => {
  test('숫자와 숫자 문자열을 처리', () => {
    expect(toAmount(8000)).toBe(8000);
    expect(toAmount('8,000')).toBe(8000);
  });

  test('0, 음수, 잘못된 값은 null', () => {
    expect(toAmount(0)).toBeNull();
    expect(toAmount(-500)).toBeNull();
    expect(toAmount('abc')).toBeNull();
    expect(toAmount(undefined)).toBeNull();
  });
});

describe('summarizeExpenses', () => {
  test('카테고리/항목별 합계를 계산하고 잘못된 금액은 건너뜀', () => {
    const summary = summarizeExpenses([
      { subject: '점심', category: '식사', amount: 8000 },
      { subject: '아메리카노', category: '카페', amount: '4,500' },
      { subject: '점심', category: '식사', amount: 9000 },
      { subject: '오류', category: '기타', amount: 'abc' },
    ]);

    expect(summary).toEqual({
      total: 21500,
      byCategory: { 식사: 17000, 카페: 4500 },
      bySubject: { 점심: 17000, 아메리카노: 4500 },
    });
  });
});

describe('isValidExpenseItem', () => {
  test('항목, 카테고리, 양수 금액이 모두 있어야 유효', () => {
    expect(isValidExpenseItem({ amount: 8000, subject: '점심', category: '식사' })).toBe(true);
    expect(isValidExpenseItem({ amount: -1, subject: '점심', category: '식사' })).toBe(false);
    expect(isValidExpenseItem({ amount: 8000, subject: '', category: '식사' })).toBe(false);
    expect(isValidExpenseItem({ amount: 8000, subject: '점심' })).toBe(false);
    expect(isValidExpenseItem(null)).toBe(false);
  });
});

describe('expenseDateFromString', () => {
  const now = new Date(2026, 8, 30, 15, 30);

  test('오늘이나 잘못된 값은 현재 시각', () => {
    expect(expenseDateFromString('2026-09-30', now)).toEqual(now);
    expect(expenseDateFromString(undefined, now)).toEqual(now);
    expect(expenseDateFromString('2026-02-30', now)).toEqual(now);
  });

  test('과거 날짜는 그날 정오', () => {
    expect(expenseDateFromString('2026-09-29', now)).toEqual(new Date(2026, 8, 29, 12));
  });

  test('미래 날짜는 현재 시각', () => {
    expect(expenseDateFromString('2026-10-01', now)).toEqual(now);
  });

  test('toLocalDateString과 짝이 맞음', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('buildChatHistory', () => {
  test('사용자/봇 메시지만 최근 8개까지 역할을 붙여 변환하고 제외 표시된 메시지는 뺌', () => {
    const messages = [
      ...Array.from({ length: 10 }, (_, i) => ({ type: i % 2 ? 'bot' : 'user', message: `메시지${i}` })),
      { type: 'bot', message: '서버와 통신 중이에요...', excludeFromHistory: true },
    ];
    const history = buildChatHistory(messages);

    expect(history).toHaveLength(8);
    expect(history[0]).toEqual({ role: 'user', content: '메시지2' });
    expect(history[7]).toEqual({ role: 'assistant', content: '메시지9' });
  });
});

describe('toPersistableMessages', () => {
  test('로딩 메시지와 위젯을 빼고 저장', () => {
    const saved = toPersistableMessages([
      { id: 1, type: 'bot', message: '기록했어요', widget: 'expenseUndo', payload: { expenseIds: ['a'] }, loading: true, delay: 100 },
      { id: 'loading-msg', type: 'bot', message: '서버와 통신 중...' },
    ], 'loading-msg');

    expect(saved).toEqual([{ id: 1, type: 'bot', message: '기록했어요', loading: false }]);
  });
});

describe('formatFeedback', () => {
  test('번호 목록을 문단으로 나눔', () => {
    expect(formatFeedback('1. 식비가 많아요. 2. 카페를 줄여보세요.')).toBe('식비가 많아요.\n\n카페를 줄여보세요.');
  });
});
