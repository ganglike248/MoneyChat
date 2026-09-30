// moneychat-frontend/src/components/MessageContent.js
// 말풍선 안에 표시되는 본문 + 전송 시간
import React from 'react';
import { parseFormattedText, formatMessageTime } from '../chatbot/messageFormat';
import SummaryCard from './SummaryCard';

const FormattedText = ({ text }) =>
    parseFormattedText(text).map((segments, lineIndex) => (
        <React.Fragment key={lineIndex}>
            {lineIndex > 0 && '\n'}
            {segments.map((segment, index) => (
                segment.bold
                    ? <strong key={index}>{segment.text}</strong>
                    : <React.Fragment key={index}>{segment.text}</React.Fragment>
            ))}
        </React.Fragment>
    ));

const MessageContent = ({ text, createdAt, formatted, card }) => (
    <>
        {card
            ? <SummaryCard card={card} />
            : <span className="chat-message-text">{formatted ? <FormattedText text={text} /> : text}</span>}
        {createdAt && (
            <time className="chat-message-time" dateTime={new Date(createdAt).toISOString()}>
                {formatMessageTime(createdAt)}
            </time>
        )}
    </>
);

// react-chatbot-kit 메시지 필드 생성
// message: 화면에 그릴 요소, text: 원본 텍스트(대화 맥락/저장용), createdAt: 전송 시각
// formatted: 봇 메시지만 **굵게** 등을 적용 (사용자 입력은 그대로 표시)
// card: 요약 카드 데이터가 있으면 텍스트 대신 카드로 표시 (저장 후 복원 가능한 일반 객체)
export const toChatMessageFields = (text, createdAt, { formatted, card = null }) => ({
    message: <MessageContent text={text} createdAt={createdAt} formatted={formatted} card={card} />,
    text,
    createdAt,
    ...(card ? { card } : {}),
});

export default MessageContent;
