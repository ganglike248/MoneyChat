import { createChatBotMessage } from 'react-chatbot-kit';
import Options from '../components/Options';
import LoadingSpinner from '../components/LoadingSpinner';

const config = {
  initialMessages: [
    createChatBotMessage(
      "안녕하세요! 저는 당신의 지출 관리를 도와드릴 '머니챗'입니다. 오늘 지출하신 내용을 편하게 알려주세요! \n\n*첫 대화 요청 시 1~2분 정도 지연이 발생할 수 있습니다.*",
      {
        widget: "options",
      }
    ),
  ],
  widgets: [
    {
      widgetName: "options",
      widgetFunc: (props) => <Options {...props} />,
    },
    {
      widgetName: "loading",
      widgetFunc: (props) => <LoadingSpinner {...props} />,
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
  customComponents: {
    botAvatar: (props) => (
        <img
          src="/logo.png"
          alt="MoneyChat Avatar"
          style={{
            width: '20%',
            height: '20%',
            borderRadius: '50%',
            objectFit: 'cover'
          }}
        />
    )
  },
};

export default config;