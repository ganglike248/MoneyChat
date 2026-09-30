// moneychat-frontend/src/components/RetryMessageButton.js
// 전송에 실패한 메시지를 다시 입력하지 않고 재전송
import React, { useState } from 'react';

const RetryMessageButton = (props) => {
    const [isUsed, setIsUsed] = useState(false);
    const message = props.payload?.message;

    if (isUsed || !message) {
        return null;
    }

    const handleRetry = () => {
        setIsUsed(true);
        props.actions.handleMessage(message);
    };

    return (
        <button className="chat-widget-button" onClick={handleRetry} type="button">
            🔄 다시 보내기
        </button>
    );
};

export default RetryMessageButton;
