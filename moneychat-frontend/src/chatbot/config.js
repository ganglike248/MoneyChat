import { createChatBotMessage } from 'react-chatbot-kit';
import Options from '../components/Options';
import LoadingSpinner from '../components/LoadingSpinner';

const config = {
  initialMessages: [
    createChatBotMessage(
      "안녕하세요! 저는 당신의 지출 관리를 도와드릴 MoneyChat입니다. 편하게 오늘 지출하신 내용을 알려주세요!"
    ),
    createChatBotMessage(
      "지금까지의 지출 현황을 확인해보시겠어요?",
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
      <div style={{
        overflow: 'clip-margin',
        overflow: 'clip'
      }}>
        <img
          src="/logo.png"
          alt="MoneyChat Avatar"
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            objectFit: 'cover'
          }}
        />
      </div>
    )
  },
};

export default config;