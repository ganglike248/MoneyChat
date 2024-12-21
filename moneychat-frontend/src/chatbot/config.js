import { createChatBotMessage } from 'react-chatbot-kit';
import Options from '../components/Options';
import LoadingSpinner from '../components/LoadingSpinner';

const config = {
  // 챗봇이 시작될 때 표시될 초기 메시지 설정
  initialMessages: [
    createChatBotMessage(
      "안녕하세요! 저는 당신의 지출 관리를 도와드릴 '머니챗'입니다. 오늘 지출하신 내용을 편하게 알려주세요! \n\n*첫 대화 요청 시 1~2분 정도 지연이 발생할 수 있습니다. 아무런 반응이 없어도 잠시만 기다려 주세요!*",
      {
        widget: "options", // 옵션 버튼 표시
      }
    ),
  ],

  // 챗봇에서 사용할 커스텀 위젯 컴포넌트 정의
  widgets: [
    {
      widgetName: "options", // 옵션 버튼을 표시하는 위젯
      widgetFunc: (props) => <Options {...props} />,
    },
    {
      widgetName: "loading", // 로딩 스피너를 표시하는 위젯
      widgetFunc: (props) => <LoadingSpinner {...props} />,
    },
  ],

  // 챗봇의 이름 설정
  botName: "MoneyChat",

  // 챗봇 UI의 커스텀 스타일 설정
  customStyles: {
    botMessageBox: {
      backgroundColor: "#c4e3ff", // 봇 메시지 박스의 배경색
    },
    chatButton: {
      backgroundColor: "#ffeb33", // 채팅 버튼의 배경색
    },
  },

  // 챗봇의 커스텀 컴포넌트 설정
  customComponents: {
    // 봇 아바타 이미지 커스텀 설정
    botAvatar: (props) => (
        <img
          src="/logo.png"
          alt="MoneyChat Avatar"
          style={{
            width: '20%',
            height: '20%',
            borderRadius: '50%', // 이미지를 원형으로 표시
            objectFit: 'cover' // 이미지 비율 유지하며 컨테이너에 맞춤
          }}
        />
    )
  },
};

export default config;