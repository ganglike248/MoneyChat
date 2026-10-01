// moneychat-frontend/src/components/MessageContent.js
// 말풍선 안에 표시되는 본문 + 전송 시간
import React from 'react';
import { parseFormattedText, formatMessageTime, stripEmoji } from '../chatbot/messageFormat';
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

// 답변을 기다리는 동안 표시하는 점 3개 애니메이션
const TypingIndicator = () => (
    <span className="chat-typing" role="img" aria-label="답변을 준비하고 있어요">
        <span /><span /><span />
    </span>
);

const MessageContent = ({ text, createdAt, formatted, card, typing }) => (
    <>
        {typing
            ? <TypingIndicator />
            : card
                ? <SummaryCard card={card} />
                : <span className="chat-message-text">{formatted ? <FormattedText text={text} /> : stripEmoji(text)}</span>}
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
// typing: 텍스트 대신 입력 중 애니메이션 표시 (로딩 메시지용)
export const toChatMessageFields = (text, createdAt, { formatted, card = null, typing = false }) => ({
    message: <MessageContent text={text} createdAt={createdAt} formatted={formatted} card={card} typing={typing} />,
    text,
    createdAt,
    ...(card ? { card } : {}),
});

export default MessageContent;
