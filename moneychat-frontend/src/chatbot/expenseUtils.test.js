import { getPeriodStart, toAmount, summarizeExpenses, isValidExpense, formatFeedback } from './expenseUtils';

describe('getPeriodStart', () => {
  // 2026년 9월 30일 수요일 15:30
  const now = new Date(2026, 8, 30, 15, 30);

  test('today는 오늘 0시', () => {
    expect(getPeriodStart('today', now)).toEqual(new Date(2026, 8, 30));
  });

  test('week는 이번 주 일요일 0시', () => {
    expect(getPeriodStart('week', now)).toEqual(new Date(2026, 8, 27));
  });

  test('month는 이번 달 1일 0시', () => {
    expect(getPeriodStart('month', now)).toEqual(new Date(2026, 8, 1));
  });

  test('월 초의 주는 지난달로 넘어감', () => {
    expect(getPeriodStart('week', new Date(2026, 9, 2))).toEqual(new Date(2026, 8, 27));
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

describe('isValidExpense', () => {
  test('필수 값이 모두 있어야 유효', () => {
    expect(isValidExpense({ hasExpense: true, amount: 8000, subject: '점심', category: '식사' })).toBe(true);
    expect(isValidExpense({ hasExpense: false, amount: 8000, subject: '점심', category: '식사' })).toBe(false);
    expect(isValidExpense({ hasExpense: true, amount: -1, subject: '점심', category: '식사' })).toBe(false);
    expect(isValidExpense({ hasExpense: true, amount: 8000, subject: '', category: '식사' })).toBe(false);
    expect(isValidExpense(null)).toBe(false);
  });
});

describe('formatFeedback', () => {
  test('번호 목록을 문단으로 나눔', () => {
    expect(formatFeedback('1. 식비가 많아요. 2. 카페를 줄여보세요.')).toBe('식비가 많아요.\n\n카페를 줄여보세요.');
  });
});
