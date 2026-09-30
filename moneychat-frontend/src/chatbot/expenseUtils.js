// /src/chatbot/expenseUtils.js
// Firebase와 무관한 지출 계산 로직 (테스트 가능하도록 분리)

// 기간별 시작 시각 계산 (주는 일요일 시작)
export const getPeriodStart = (period, now = new Date()) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === 'week') start.setDate(start.getDate() - start.getDay());
  else if (period === 'month') start.setDate(1);

  return start;
};

// 금액을 숫자로 변환 (예전에 문자열로 저장된 데이터도 처리)
export const toAmount = (value) => {
  const amount = typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : value;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

// 지출 목록을 총합, 카테고리별, 항목별 합계로 집계
export const summarizeExpenses = (expenses) => {
  let total = 0;
  const byCategory = {};
  const bySubject = {};

  expenses.forEach((expense) => {
    const amount = toAmount(expense.amount);
    if (amount === null) return;

    total += amount;
    byCategory[expense.category] = (byCategory[expense.category] || 0) + amount;
    bySubject[expense.subject] = (bySubject[expense.subject] || 0) + amount;
  });

  return { total, byCategory, bySubject };
};

// 백엔드 분석 결과가 저장 가능한 지출인지 확인
export const isValidExpense = (analysis) =>
  Boolean(
    analysis &&
    analysis.hasExpense &&
    toAmount(analysis.amount) !== null &&
    typeof analysis.subject === 'string' && analysis.subject.trim() &&
    typeof analysis.category === 'string' && analysis.category.trim()
  );

// "1. ... 2. ..." 형식의 피드백을 문단으로 나눔
export const formatFeedback = (text) =>
  text
    .split(/(?:\d+\.\s)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
