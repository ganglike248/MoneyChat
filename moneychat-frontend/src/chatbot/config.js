import { createChatBotMessage } from 'react-chatbot-kit';
import UndoExpenseButton from '../components/UndoExpenseButton';

const config = {
  initialMessages: [
    createChatBotMessage(
      "안녕하세요! 저는 당신의 지출 관리를 도와드릴 '머니챗'입니다. 💰\n\n오늘 지출하신 내용을 편하게 알려주세요!\n\n📌 입력창 왼쪽의 메뉴 버튼(☰)을 클릭하면 다양한 기능을 이용하실 수 있어요!"
    ),
  ],

  widgets: [
    {
      widgetName: "expenseUndo",
      widgetFunc: (props) => <UndoExpenseButton {...props} />,
    },
  ],

  botName: "MoneyChat",

  customStyles: {
    botMessageBox: {
      backgroundColor: "#c4e3ff",
    }
  },

  customComponents: {
    // 봇 아바타 표시 확인
    botAvatar: (props) => (
      <img
        src="/logo.png"
        alt="MoneyChat Avatar"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          objectFit: 'cover'
        }}
      />
    )
  },
};

export default config;
