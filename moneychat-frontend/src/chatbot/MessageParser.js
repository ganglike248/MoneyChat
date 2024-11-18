class MessageParser {
  constructor(actionProvider, state) {
    this.actionProvider = actionProvider;
    this.state = state;
  }

  parse(message) {
    console.log("MessageParser received message:", message);
    if (message.trim() === '') return;
    
    this.actionProvider.handleMessage(message);
  }
}

export default MessageParser;