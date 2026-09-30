// 사용자 메시지 분석 결과 검증 및 정리 (GPT 응답은 형식이 틀릴 수 있으므로 서버에서 한 번 더 확인)

// 맥락으로 함께 보내는 이전 대화 제한
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CONTENT_LENGTH = 500;

// 한 메시지에서 저장할 수 있는 최대 지출 수
const MAX_EXPENSES_PER_MESSAGE = 10;

// 기록 가능한 과거 날짜 범위(일)
const MAX_PAST_DAYS = 365;

// 지출 카테고리 (프론트엔드 expenseUtils.js의 CATEGORIES와 동일하게 유지)
const CATEGORIES = ['식사', '카페', '간식', '교통', '쇼핑', '패션', '문화', '의료', '교육', '생활', '주거', '통신', '경조사', '기타'];

// 챗봇이 이해하는 사용자 의도
const INTENTS = ['expense', 'summary', 'detail', 'recent', 'feedback', 'budget', 'chat'];
// 요약 조회 기간 / 상세 조회 기간
const PERIODS = ['today', 'week', 'month', 'lastMonth'];
const DETAIL_PERIODS = ['month', 'lastMonth'];

// YYYY-MM-DD 문자열을 UTC 기준 날짜로 변환 (날짜 차이 계산용)
const parseDateString = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// 지출 날짜 검증: 오늘 이후나 너무 오래된 날짜는 오늘로 처리
const normalizeExpenseDate = (value, today) => {
    const date = parseDateString(value);
    const todayDate = parseDateString(today);
    if (!date || !todayDate) return today;

    const diffDays = Math.round((todayDate - date) / DAY_MS);
    return diffDays < 0 || diffDays > MAX_PAST_DAYS ? today : value;
};

const toAmount = (value) => {
    const amount = typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : value;
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
};

// GPT 응답 검증 및 정리
// 금액이 양수가 아니거나 항목이 없는 지출은 버리고, 목록에 없는 카테고리는 '기타'로 처리
const normalizeAnalysis = (raw, today) => {
    const feedback = typeof raw?.feedback === 'string' && raw.feedback.trim()
        ? raw.feedback.trim()
        : '죄송해요, 다시 한 번 말씀해주시겠어요?';

    const expenses = (Array.isArray(raw?.expenses) ? raw.expenses : [])
        .map((expense) => ({
            subject: typeof expense?.subject === 'string' ? expense.subject.trim().slice(0, 50) : '',
            category: CATEGORIES.includes(expense?.category) ? expense.category : '기타',
            amount: toAmount(expense?.amount),
            date: normalizeExpenseDate(expense?.date, today)
        }))
        .filter((expense) => expense.subject && expense.amount !== null)
        .slice(0, MAX_EXPENSES_PER_MESSAGE);

    if (expenses.length > 0) {
        return { intent: 'expense', period: null, expenses, budget: null, feedback };
    }

    let intent = INTENTS.includes(raw?.intent) && raw.intent !== 'expense' ? raw.intent : 'chat';

    let period = null;
    if (intent === 'summary') period = PERIODS.includes(raw?.period) ? raw.period : 'today';
    if (intent === 'detail') period = DETAIL_PERIODS.includes(raw?.period) ? raw.period : 'month';

    // 예산: 양수면 설정, 0이면 해제, 그 외에는 금액을 알 수 없으므로 일반 대화로 처리
    let budget = null;
    if (intent === 'budget') {
        budget = raw?.budget === 0 || raw?.budget === '0' ? 0 : toAmount(raw?.budget);
        if (budget === null) intent = 'chat';
    }

    return { intent, period, expenses: [], budget, feedback };
};

// 이전 대화 검증: 역할과 길이를 제한해서 GPT에 전달
const normalizeHistory = (history) => {
    if (!Array.isArray(history)) return [];

    return history
        .filter((item) => (item?.role === 'user' || item?.role === 'assistant') && typeof item.content === 'string' && item.content.trim())
        .slice(-MAX_HISTORY_MESSAGES)
        .map((item) => ({ role: item.role, content: item.content.slice(0, MAX_HISTORY_CONTENT_LENGTH) }));
};

// 서버 기준 오늘 날짜 (클라이언트가 날짜를 보내지 않은 경우)
const getServerToday = () => new Date().toISOString().slice(0, 10);

module.exports = {
    CATEGORIES,
    INTENTS,
    PERIODS,
    DETAIL_PERIODS,
    parseDateString,
    normalizeExpenseDate,
    normalizeAnalysis,
    normalizeHistory,
    getServerToday
};
