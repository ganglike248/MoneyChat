const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAnalysis, normalizeHistory, normalizeExpenseDate } = require('./analysis');

const TODAY = '2026-09-30';

test('여러 지출을 모두 정리하고 목록에 없는 카테고리는 기타로 처리', () => {
    const result = normalizeAnalysis({
        intent: 'expense',
        expenses: [
            { subject: '점심', category: '식사', amount: 8000, date: TODAY },
            { subject: '아메리카노', category: '커피', amount: '4,500', date: '2026-09-29' }
        ],
        feedback: '기록했어요!'
    }, TODAY);

    assert.deepEqual(result, {
        intent: 'expense',
        period: null,
        budget: null,
        expenses: [
            { subject: '점심', category: '식사', amount: 8000, date: TODAY },
            { subject: '아메리카노', category: '기타', amount: 4500, date: '2026-09-29' }
        ],
        feedback: '기록했어요!'
    });
});

test('금액이 잘못된 지출은 버리고, 남은 지출이 없으면 대화로 처리', () => {
    const result = normalizeAnalysis({
        intent: 'expense',
        expenses: [{ subject: '점심', category: '식사', amount: -1 }, { subject: '', amount: 5000 }],
        feedback: '얼마 쓰셨어요?'
    }, TODAY);

    assert.equal(result.intent, 'chat');
    assert.deepEqual(result.expenses, []);
});

test('조회 의도와 기간을 검증', () => {
    assert.equal(normalizeAnalysis({ intent: 'summary', period: 'week', feedback: 'x' }, TODAY).period, 'week');
    assert.equal(normalizeAnalysis({ intent: 'summary', period: 'lastMonth', feedback: 'x' }, TODAY).period, 'lastMonth');
    assert.equal(normalizeAnalysis({ intent: 'summary', period: 'year', feedback: 'x' }, TODAY).period, 'today');
    assert.equal(normalizeAnalysis({ intent: 'hack', feedback: 'x' }, TODAY).intent, 'chat');
    assert.equal(normalizeAnalysis({ intent: 'detail', period: 'lastMonth', feedback: 'x' }, TODAY).period, 'lastMonth');
    assert.equal(normalizeAnalysis({ intent: 'detail', period: 'week', feedback: 'x' }, TODAY).period, 'month');
    assert.equal(normalizeAnalysis({ intent: 'recent', period: 'week', feedback: 'x' }, TODAY).period, null);
});

test('예산 설정 의도 검증', () => {
    assert.equal(normalizeAnalysis({ intent: 'budget', budget: 500000, feedback: 'x' }, TODAY).budget, 500000);
    assert.equal(normalizeAnalysis({ intent: 'budget', budget: '500,000', feedback: 'x' }, TODAY).budget, 500000);
    assert.equal(normalizeAnalysis({ intent: 'budget', budget: 0, feedback: 'x' }, TODAY).budget, 0);

    const noAmount = normalizeAnalysis({ intent: 'budget', budget: null, feedback: '얼마로 정할까요?' }, TODAY);
    assert.equal(noAmount.intent, 'chat');
    assert.equal(noAmount.budget, null);
});

test('feedback이 없으면 기본 문구 사용', () => {
    assert.ok(normalizeAnalysis({}, TODAY).feedback.length > 0);
    assert.ok(normalizeAnalysis(null, TODAY).feedback.length > 0);
});

test('미래, 1년 넘은 과거, 잘못된 형식의 날짜는 오늘로 처리', () => {
    assert.equal(normalizeExpenseDate('2026-09-01', TODAY), '2026-09-01');
    assert.equal(normalizeExpenseDate('2026-10-01', TODAY), TODAY);
    assert.equal(normalizeExpenseDate('2024-01-01', TODAY), TODAY);
    assert.equal(normalizeExpenseDate('2026-02-30', TODAY), TODAY);
    assert.equal(normalizeExpenseDate('어제', TODAY), TODAY);
});

test('이전 대화는 허용된 역할만 최근 8개까지, 500자로 잘라서 사용', () => {
    const history = [
        { role: 'system', content: '무시해' },
        ...Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `메시지${i}` })),
        { role: 'user', content: 'a'.repeat(600) }
    ];
    const result = normalizeHistory(history);

    assert.equal(result.length, 8);
    assert.ok(result.every((item) => item.role !== 'system'));
    assert.equal(result.at(-1).content.length, 500);
    assert.deepEqual(normalizeHistory('bad'), []);
});

test('답변은 reply 필드를 우선 사용하고, 예전 형식인 feedback도 허용', () => {
    assert.equal(normalizeAnalysis({ intent: 'chat', reply: '안녕하세요!' }, TODAY).feedback, '안녕하세요!');
    assert.equal(normalizeAnalysis({ intent: 'chat', feedback: '반가워요!' }, TODAY).feedback, '반가워요!');
    assert.equal(normalizeAnalysis({ intent: 'chat', reply: '  ', feedback: '반가워요!' }, TODAY).feedback, '반가워요!');
});

test('답변이 비어 있으면 기본 문구', () => {
    assert.equal(normalizeAnalysis({ intent: 'chat', reply: '' }, TODAY).feedback, '죄송해요, 다시 한 번 말씀해주시겠어요?');
});
