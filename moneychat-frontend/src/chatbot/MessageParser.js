// 사용자 메시지를 처리하고 분석하는 클래스
class MessageParser {
  constructor(actionProvider, state) {
    this.actionProvider = actionProvider; // 메시지 처리 후 응답을 생성하는 객체
    this.state = state; // 챗봇의 현재 상태를 담고 있는 객체
  }

  // 사용자의 입력 메시지를 파싱하고 처리하는 메서드
  parse(message) {
    console.log("MessageParser received message:", message);
    // 빈 메시지인 경우 처리하지 않음
    if (message.trim() === '') return;
    
    // actionProvider의 handleMessage 메서드를 호출하여 메시지 처리
    this.actionProvider.handleMessage(message);
  }
}

export default MessageParser;