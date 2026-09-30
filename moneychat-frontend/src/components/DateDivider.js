// moneychat-frontend/src/components/DateDivider.js
// 날짜가 바뀌는 곳에 표시되는 구분 바
import React from 'react';
import { formatDividerDate } from '../chatbot/messageFormat';

const DateDivider = ({ payload }) => {
    if (!payload?.date) return null;

    return (
        <div className="chat-date-divider" role="separator">
            <span>{formatDividerDate(payload.date)}</span>
        </div>
    );
};

export default DateDivider;
