import { createChatBotMessage } from 'react-chatbot-kit';
import UndoExpenseButton from '../components/UndoExpenseButton';
import RetryMessageButton from '../components/RetryMessageButton';
import ExpenseManager from '../components/ExpenseManager';

const GREETING =
  "안녕하세요! 저는 당신의 지출 관리를 도와드릴 '머니챗'입니다. 💰\n\n" +
  "오늘 지출하신 내용을 편하게 알려주세요!\n" +
  "예) \"점심 8000\", \"어제 택시 12000 커피 4500\"\n\n" +
  "\"이번 주 얼마 썼어?\"처럼 물어보셔도 되고, 입력창 왼쪽의 메뉴 버튼(☰)으로 다양한 기능을 이용하실 수 있어요!";

// 사용자마다 새 config를 만들어서 사용
// (react-chatbot-kit이 config.initialMessages를 직접 바꾸기 때문에 공유 객체를 쓰면 다른 사용자의 대화가 섞일 수 있음)
export const createConfig = (history = []) => ({
  initialMessages: history.length > 0 ? history : [createChatBotMessage(GREETING)],

  widgets: [
    {
      widgetName: "expenseUndo",
      widgetFunc: (props) => <UndoExpenseButton {...props} />,
    },
    {
      widgetName: "retryMessage",
      widgetFunc: (props) => <RetryMessageButton {...props} />,
    },
    {
      widgetName: "expenseManager",
      widgetFunc: (props) => <ExpenseManager {...props} />,
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
});
