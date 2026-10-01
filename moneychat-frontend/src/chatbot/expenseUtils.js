// /src/chatbot/expenseUtils.js
// Firebase와 무관한 지출 계산 로직 (테스트 가능하도록 분리)
import { getMessageText } from './messageFormat';

// 지출 카테고리 (백엔드 analysis.js의 CATEGORIES와 동일하게 유지)
export const CATEGORIES = ['식사', '카페', '간식', '교통', '쇼핑', '패션', '문화', '의료', '교육', '생활', '주거', '통신', '경조사', '기타'];

// 기간별 시작 시각 계산 (주는 월요일 시작)
export const getPeriodStart = (period, now = new Date()) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  else if (period === 'month') start.setDate(1);

  return start;
};

// 특정 달의 조회 범위 [start, end) (month는 0부터 시작, 음수면 이전 해로 넘어감)
export const getMonthRange = (year, month) => ({
  start: new Date(year, month, 1),
  end: new Date(year, month + 1, 1),
});

// 조회 기간 [start, end) (end가 null이면 현재까지)
export const getPeriodRange = (period, now = new Date()) => {
  if (period === 'lastMonth') return getMonthRange(now.getFullYear(), now.getMonth() - 1);
  return { start: getPeriodStart(period, now), end: null };
};

// "9월" (올해가 아니면 "2025년 12월")
export const formatMonthLabel = (date, now = new Date()) =>
  date.getFullYear() === now.getFullYear()
    ? `${date.getMonth() + 1}월`
    : `${date.getFullYear()}년 ${date.getMonth() + 1}월`;

// 이번 달 예산 사용 현황 (예산이 없으면 null)
export const getBudgetStatus = (budget, spent) => {
  if (!budget) return null;
  const remaining = budget - spent;
  return { budget, spent, remaining, percent: Math.round((spent / budget) * 100), over: remaining < 0 };
};

export const formatBudgetLine = (status) =>
  status.over
    ? `이번 달 예산을 ${(-status.remaining).toLocaleString()}원 초과했어요. (예산 ${status.budget.toLocaleString()}원)`
    : `이번 달 예산 ${status.budget.toLocaleString()}원 중 ${status.percent}% 사용 · 남은 금액 ${status.remaining.toLocaleString()}원`;

// 카테고리별 금액을 큰 순서로 정렬한 막대그래프용 데이터
export const toCategoryRows = (byCategory, total) =>
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({ label, amount, percent: total > 0 ? Math.round((amount / total) * 100) : 0 }));

// 금액을 숫자로 변환 (예전에 문자열로 저장된 데이터도 처리)
export const toAmount = (value) => {
  const amount = typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : value;
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
};

// 큰 금액을 읽기 쉽게 표시 (1500000 → "150만원", 1234567 → "123만 4,567원")
export const formatKoreanAmount = (amount) => {
  const eok = Math.floor(amount / 100000000);
  const man = Math.floor((amount % 100000000) / 10000);
  const won = amount % 10000;
  const parts = [];
  if (eok) parts.push(`${eok.toLocaleString()}억`);
  if (man) parts.push(`${man.toLocaleString()}만`);
  if (won || parts.length === 0) parts.push(won.toLocaleString());
  return `${parts.join(' ')}원`;
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

// 백엔드가 돌려준 지출 한 건이 저장 가능한지 확인
export const isValidExpenseItem = (expense) =>
  Boolean(
    expense &&
    toAmount(expense.amount) !== null &&
    typeof expense.subject === 'string' && expense.subject.trim() &&
    typeof expense.category === 'string' && expense.category.trim()
  );

// 기기 시간대 기준 YYYY-MM-DD
export const toLocalDateString = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

// 지출 날짜(YYYY-MM-DD)를 저장할 시각으로 변환
// 오늘이거나 형식이 틀리면 현재 시각, 과거 날짜면 그날 정오
export const expenseDateFromString = (value, now = new Date()) => {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || value === toLocalDateString(now)) return new Date(now);

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  return toLocalDateString(date) === value && date <= now ? date : new Date(now);
};

// "9월 29일" 형식
export const formatMonthDay = (date) => date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

// "1. ... 2. ..." 형식의 피드백을 문단으로 나눔
export const formatFeedback = (text) =>
  text
    .split(/(?:\d+\.\s)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');

const HISTORY_LIMIT = 8;
const HISTORY_CONTENT_LIMIT = 500;

// 챗봇 메시지 목록을 GPT에 보낼 이전 대화 형식으로 변환
// 로딩, 오류 안내처럼 대화 맥락과 무관한 메시지는 제외
export const buildChatHistory = (messages) =>
  messages
    .filter((msg) => (msg.type === 'user' || msg.type === 'bot') && !msg.excludeFromHistory && getMessageText(msg) !== null)
    .slice(-HISTORY_LIMIT)
    .map((msg) => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: getMessageText(msg).slice(0, HISTORY_CONTENT_LIMIT),
    }));

const PERSIST_LIMIT = 50;

// 새로고침 후에도 대화를 복원할 수 있도록 저장 가능한 형태로 정리
// - 화면 표시용 요소(message)는 저장할 수 없으므로 원본 텍스트(text)만 저장
// - 위젯(취소하기, 다시 보내기 등)은 당시에만 의미가 있으므로 제거
export const toPersistableMessages = (messages, loadingId) =>
  messages
    .filter((msg) => msg.id !== loadingId && getMessageText(msg) !== null)
    .slice(-PERSIST_LIMIT)
    .map(({ widget, payload, delay, message, ...rest }) => ({
      ...rest,
      text: getMessageText({ ...rest, message }),
      loading: false,
    }));
