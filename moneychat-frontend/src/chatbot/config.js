import { createChatBotMessage } from 'react-chatbot-kit';
import UndoExpenseButton from '../components/UndoExpenseButton';
import RetryMessageButton from '../components/RetryMessageButton';
import ExpenseTableLink from '../components/ExpenseTableLink';
import BudgetForm from '../components/BudgetForm';
import DateDivider from '../components/DateDivider';
import { toChatMessageFields } from '../components/MessageContent';
import { getMessageText, withDateDividers, DATE_DIVIDER_TYPE } from './messageFormat';

const GREETING =
  "안녕하세요! 저는 당신의 지출 관리를 도와드릴 '머니챗'입니다.\n\n" +
  "오늘 지출하신 내용을 편하게 알려주세요!\n" +
  "예) \"커피 5000\", \"어제 택시 12000 커피 4500\"\n\n" +
  "\"이번 주 얼마 썼어?\"처럼 물어보셔도 되고, 왼쪽 위 메뉴 버튼에서 다양한 기능을 이용하실 수 있어요!";

const createGreeting = () => {
  const { message, ...fields } = toChatMessageFields(GREETING, Date.now(), { formatted: true });
  return createChatBotMessage(message, { withAvatar: true, ...fields });
};

// 저장된 메시지(텍스트)를 화면 표시용으로 복원
// - 봇 메시지에는 항상 프로필 표시 (기본값은 연속된 봇 메시지의 프로필을 숨김)
// - 전송 시간이 없는 예전 메시지는 시간 없이 표시
const restoreMessage = (msg) => ({
  ...msg,
  ...toChatMessageFields(getMessageText(msg), msg.createdAt ?? null, { formatted: msg.type === 'bot', card: msg.card }),
  ...(msg.type === 'bot' ? { withAvatar: true } : {}),
});

// 사용자마다 새 config를 만들어서 사용
// (react-chatbot-kit이 config.initialMessages를 직접 바꾸기 때문에 공유 객체를 쓰면 다른 사용자의 대화가 섞일 수 있음)
export const createConfig = (history = []) => {
  const restored = history.filter((msg) => getMessageText(msg) !== null).map(restoreMessage);

  return {
    initialMessages: withDateDividers(restored.length > 0 ? restored : [createGreeting()]),

    // 말풍선이 아닌 메시지 (날짜 구분 바)
    customMessages: {
      [DATE_DIVIDER_TYPE]: (props) => <DateDivider {...props} />,
    },

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
        widgetName: "expenseTableLink",
        widgetFunc: (props) => <ExpenseTableLink {...props} />,
      },
      {
        widgetName: "budgetForm",
        widgetFunc: (props) => <BudgetForm {...props} />,
      },
    ],

    botName: "MoneyChat",

    // 말풍선 색은 다크 모드 대응을 위해 chatbot.css에서 지정

    customComponents: {
      botAvatar: () => (
        <img src="/avatar.png" alt="MoneyChat" className="chatbot-avatar-img" />
      ),
      // 내 메시지에는 프로필을 표시하지 않음
      userAvatar: () => null,
    },
  };
};
