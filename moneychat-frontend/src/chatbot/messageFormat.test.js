import {
  parseInline, parseFormattedText, formatMessageTime, getMessageText,
  withDateDividers, formatDividerDate, DATE_DIVIDER_TYPE, stripEmoji,
} from './messageFormat';

describe('parseInline', () => {
  test('**굵게** 부분을 나눔', () => {
    expect(parseInline('**점심**은 8000원이에요')).toEqual([
      { text: '점심', bold: true },
      { text: '은 8000원이에요', bold: false },
    ]);
  });

  test('한 줄에 여러 개', () => {
    expect(parseInline('**식비**와 **카페**')).toEqual([
      { text: '식비', bold: true },
      { text: '와 ', bold: false },
      { text: '카페', bold: true },
    ]);
  });

  test('짝이 맞지 않는 **는 제거', () => {
    expect(parseInline('**현재 지출 패턴')).toEqual([{ text: '현재 지출 패턴', bold: false }]);
  });

  test('일반 텍스트는 그대로', () => {
    expect(parseInline('점심 8000')).toEqual([{ text: '점심 8000', bold: false }]);
  });
});

describe('parseFormattedText', () => {
  test('줄바꿈을 유지하고 # 제목 줄은 굵게', () => {
    expect(parseFormattedText('### 분석 결과\n식비가 **많아요**')).toEqual([
      [{ text: '분석 결과', bold: true }],
      [{ text: '식비가 ', bold: false }, { text: '많아요', bold: true }],
    ]);
  });

  test('빈 줄은 빈 목록', () => {
    expect(parseFormattedText('a\n\nb')).toEqual([[{ text: 'a', bold: false }], [], [{ text: 'b', bold: false }]]);
  });
});

describe('formatMessageTime', () => {
  test('시간만 표시', () => {
    expect(formatMessageTime(new Date(2026, 8, 30, 15, 5).getTime())).toBe('오후 3:05');
    expect(formatMessageTime(new Date(2026, 8, 29, 9, 30).getTime())).toBe('오전 9:30');
  });
});

describe('withDateDividers', () => {
  const at = (day, hour) => new Date(2026, 8, day, hour).getTime();
  const ids = (list) => list.map((msg) => msg.id);

  test('맨 앞과 날짜가 바뀌는 곳에 구분 바 추가', () => {
    const result = withDateDividers([
      { id: 1, type: 'user', createdAt: at(29, 10) },
      { id: 2, type: 'bot', createdAt: at(29, 10) },
      { id: 3, type: 'user', createdAt: at(30, 9) },
    ]);

    expect(ids(result)).toEqual(['date-divider-2026-09-29', 1, 2, 'date-divider-2026-09-30', 3]);
    expect(result[0]).toMatchObject({ type: DATE_DIVIDER_TYPE, payload: { date: '2026-09-29' } });
  });

  test('시간 정보가 없는 메시지는 날짜 판단에서 제외', () => {
    const result = withDateDividers([
      { id: 'old', type: 'bot' },
      { id: 1, type: 'user', createdAt: at(30, 9) },
      { id: 'loading-msg', type: 'bot', createdAt: null },
      { id: 2, type: 'bot', createdAt: at(30, 9) },
    ]);

    expect(ids(result)).toEqual(['old', 'date-divider-2026-09-30', 1, 'loading-msg', 2]);
  });

  test('기존 구분 바는 다시 계산 (같은 목록이면 결과도 같음)', () => {
    const once = withDateDividers([{ id: 1, type: 'user', createdAt: at(30, 9) }]);
    expect(ids(withDateDividers(once))).toEqual(ids(once));
  });

  test('구분 바는 대화 텍스트로 취급하지 않음', () => {
    expect(getMessageText({ type: DATE_DIVIDER_TYPE, message: '' })).toBeNull();
  });
});

describe('formatDividerDate', () => {
  test('연월일과 요일', () => {
    expect(formatDividerDate('2026-09-30')).toBe('2026년 9월 30일 수요일');
  });
});

describe('getMessageText', () => {
  test('text가 있으면 text, 없으면 문자열 message', () => {
    expect(getMessageText({ text: '새 형식', message: { fake: 'element' } })).toBe('새 형식');
    expect(getMessageText({ message: '예전 형식' })).toBe('예전 형식');
    expect(getMessageText({ message: { fake: 'element' } })).toBeNull();
  });
});

describe('stripEmoji', () => {
  test('이모지와 바로 뒤 공백을 지움', () => {
    expect(stripEmoji('📅 9월 지출')).toBe('9월 지출');
    expect(stripEmoji('⚠️ 예산 초과')).toBe('예산 초과');
    expect(stripEmoji('없습니다. 💸')).toBe('없습니다. ');
  });

  test('합쳐진 이모지와 숫자 키캡도 처리', () => {
    expect(stripEmoji('👨‍👩‍👧 가족 1️⃣ 첫째')).toBe('가족 1 첫째');
  });

  test('일반 기호와 한글은 그대로', () => {
    expect(stripEmoji('• 식사: 8,000원 · 50%')).toBe('• 식사: 8,000원 · 50%');
  });

  test('봇 메시지 표시에 적용', () => {
    expect(parseFormattedText('💰 **총 5,000원**')).toEqual([[{ text: '총 5,000원', bold: true }]]);
  });
});
