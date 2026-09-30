// /src/chatbot/messageFormat.js
// 챗봇 메시지 표시용 포맷 (GPT 답변의 **굵게**, # 제목 처리, 전송 시간)

// 한 줄을 일반/굵은 글자 조각으로 나눔 ("**점심**은 8000원" → [점심(굵게), 은 8000원])
export const parseInline = (line) => {
  const segments = [];
  const boldPattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = boldPattern.exec(line)) !== null) {
    if (match.index > lastIndex) segments.push({ text: line.slice(lastIndex, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    lastIndex = boldPattern.lastIndex;
  }
  if (lastIndex < line.length) segments.push({ text: line.slice(lastIndex), bold: false });

  // 짝이 맞지 않아 남은 ** 는 그대로 보이지 않도록 제거
  return segments
    .map((segment) => (segment.bold ? segment : { ...segment, text: segment.text.replace(/\*\*/g, '') }))
    .filter((segment) => segment.text);
};

// 여러 줄 텍스트를 줄별 조각 목록으로 변환 ("### 제목" 줄은 굵게 표시)
export const parseFormattedText = (text) =>
  text.split('\n').map((line) => {
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) return parseInline(heading[1]).map((segment) => ({ ...segment, bold: true }));
    return parseInline(line);
  });

// 전송 시간 "오후 3:05" (날짜는 날짜 구분 바에 표시)
export const formatMessageTime = (createdAt) =>
  new Date(createdAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

// 메시지의 원본 텍스트 (예전에 저장된 메시지는 message에 텍스트가 들어 있음)
export const getMessageText = (msg) => {
  if (msg.type === DATE_DIVIDER_TYPE) return null;
  if (typeof msg.text === 'string') return msg.text;
  return typeof msg.message === 'string' ? msg.message : null;
};

// ===== 날짜 구분 바 (카카오톡처럼 날짜가 바뀌는 곳에 표시) =====

export const DATE_DIVIDER_TYPE = 'dateDivider';

// 기기 시간대 기준 YYYY-MM-DD
const toDateKey = (timestamp) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// "2026년 9월 30일 수요일"
export const formatDividerDate = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
};

// 날짜가 바뀌는 메시지 앞에 구분 바를 넣은 목록을 반환 (기존 구분 바는 다시 계산)
// 전송 시간이 없는 메시지(예전 기록, 로딩 메시지)는 날짜 판단에서 제외
export const withDateDividers = (messages) => {
  const result = [];
  let lastDateKey = null;

  messages.forEach((msg) => {
    if (msg.type === DATE_DIVIDER_TYPE) return;

    if (msg.createdAt) {
      const dateKey = toDateKey(msg.createdAt);
      if (dateKey !== lastDateKey) {
        result.push({ type: DATE_DIVIDER_TYPE, id: `date-divider-${dateKey}`, message: '', payload: { date: dateKey } });
        lastDateKey = dateKey;
      }
    }

    result.push(msg);
  });

  return result;
};
