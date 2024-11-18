// config.js
import { createChatBotMessage } from 'react-chatbot-kit';
import Options from '../components/Options';

const config = {
  initialMessages: [
    createChatBotMessage(
      "안녕하세요! 저는 당신의 지출 관리를 도와드릴 MoneyChat입니다. 편하게 오늘 지출하신 내용을 알려주세요!"
    ),
  ],
  widgets: [
    {
      widgetName: "options",
      widgetFunc: (props) => <Options {...props} />,
    },
  ],
  botName: "MoneyChat",
  customStyles: {
    botMessageBox: {
      backgroundColor: "#c4e3ff",
    },
    chatButton: {
      backgroundColor: "#ffeb33",
    },
  },
};

export default config;