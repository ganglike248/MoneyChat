import React from 'react';

const MessageParser = ({ children, actions }) => {
  const parse = (message) => {
    console.log("MessageParser received message:", message);

    // 빈 메시지인 경우 처리하지 않음
    if (message.trim() === '') return;

    // actions의 handleMessage 메서드를 호출하여 메시지 처리
    if (actions && actions.handleMessage) {
      actions.handleMessage(message);
    }
  };

  return (
    <div>
      {React.Children.map(children, (child) => {
        return React.cloneElement(child, {
          parse: parse,
          actions,
        });
      })}
    </div>
  );
};

export default MessageParser;
