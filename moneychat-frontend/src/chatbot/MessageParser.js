import React from 'react';

const MessageParser = ({ children, actions }) => {
  const parse = (message) => {
    if (process.env.NODE_ENV === 'development') {
      console.log("MessageParser received message:", message);
    }

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
