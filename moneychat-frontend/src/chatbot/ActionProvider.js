import { db, auth } from '../firebase/firebaseConfig';
import { collection, doc, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';

class ActionProvider {
  // 챗봇의 상태 관리와 메시지 생성을 위한 생성자 함수
  constructor(createChatBotMessage, setStateFunc, createClientMessage) {
    this.createChatBotMessage = createChatBotMessage;
    this.setState = setStateFunc;
    this.createClientMessage = createClientMessage;

    // 메서드 바인딩
    this.handleMessage = this.handleMessage.bind(this);
    this.handleTodayExpenses = this.handleTodayExpenses.bind(this);
    this.handleWeekExpenses = this.handleWeekExpenses.bind(this);
    this.handleMonthExpenses = this.handleMonthExpenses.bind(this);
    this.handleExpenseFeedback = this.handleExpenseFeedback.bind(this);
    this.saveExpense = this.saveExpense.bind(this);
    this.calculateExpenseSummary = this.calculateExpenseSummary.bind(this);
    this.updateChatbotState = this.updateChatbotState.bind(this);
  }

  // 사용자 입력 메시지를 분석하고 처리하는 함수
  async handleMessage(message) {
    console.log("ActionProvider handling message:", message);
    try {
      // 빈 메시지 체크
      if (!message.trim()) {
        throw new Error('메시지가 비어있습니다.');
      }

      // API를 통해 메시지 분석 요청
      const response = await fetch('https://moneychat-backend-17g5.onrender.com/api/analyze-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Error response:', errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const analysis = await response.json();
      console.log("Message analysis:", analysis);

      // 지출 정보가 포함된 경우와 아닌 경우를 구분하여 처리
      if (analysis.hasExpense && analysis.amount && analysis.category) {
        // 지출 정보를 DB에 저장
        await this.saveExpense(analysis.subject, analysis.category, analysis.amount);

        // 지출 정보와 간단한 피드백을 포함한 응답 메시지 생성
        const responseMessage = this.createChatBotMessage(
          `${analysis.subject}(${analysis.category}) 항목에 ${analysis.amount.toLocaleString()}원을 지출하셨네요!\n${analysis.feedback}`,
          {
            widget: "options",
          }
        );
        this.updateChatbotState(responseMessage);
      } else {
        // 일반(일상) 대화에 대한 응답 메시지 생성
        const defaultMessage = this.createChatBotMessage(analysis.feedback,
          {
            widget: "options",
          });
        this.updateChatbotState(defaultMessage);
      }
    } catch (error) {
      console.error("Error in handleMessage:", error);
      // 에러 발생 시 사용자에게 알림
      const errorMessage = this.createChatBotMessage(
        "죄송합니다. 처리 중 문제가 발생했어요. 다시 시도해주세요.",
        {
          widget: "options",
        }
      );
      this.updateChatbotState(errorMessage);
    }
  }

  // 오늘의 지출 내역을 조회하고 표시하는 함수
  async handleTodayExpenses() {
    // 오늘의 지출 내역 계산
    const summary = await this.calculateExpenseSummary('today');
    
    // 지출 내역이 없는 경우 처리
    if (summary.total === 0) {
      const message = this.createChatBotMessage(
        "오늘은 아직 지출 내역이 없네요!",
        {
          widget: "options",
        }
      );
      this.updateChatbotState(message);
      return;
    }
  
    // 카테고리별, 항목별 지출 내역을 포맷팅하여 메시지 생성
    const message = this.createChatBotMessage(
      `오늘의 총 지출: ${summary.total.toLocaleString()}원\n\n` +
      `카테고리별 지출:\n` +
      `${Object.entries(summary.byCategory)
        .map(([category, amount]) => `${category}: ${amount.toLocaleString()}원`)
        .join('\n')}\n\n` +
      `상세 지출:\n` +
      `${Object.entries(summary.bySubject)
        .map(([subject, amount]) => `${subject}: ${amount.toLocaleString()}원`)
        .join('\n')}`,
      {
        widget: "options",
      }
    );
    this.updateChatbotState(message);
  }
  
  // 이번 주의 지출 내역을 조회하고 표시하는 함수
  async handleWeekExpenses() {
    // 이번 주 지출 내역 계산
    const summary = await this.calculateExpenseSummary('week');
    
    // 지출 내역이 없는 경우 처리
    if (summary.total === 0) {
      const message = this.createChatBotMessage(
        "이번 주는 아직 지출 내역이 없네요!",
        {
          widget: "options",
        }
      );
      this.updateChatbotState(message);
      return;
    }
  
    // 카테고리별 지출 내역을 포맷팅하여 메시지 생성
    const message = this.createChatBotMessage(
      `이번 주 총 지출: ${summary.total.toLocaleString()}원\n` +
      `카테고리별 지출:\n` +
      `${Object.entries(summary.byCategory)
        .map(([category, amount]) => `${category}: ${amount.toLocaleString()}원`)
        .join('\n')}`,
      {
        widget: "options",
      }
    );
    this.updateChatbotState(message);
  }
  
  // 이번 달의 지출 내역을 조회하고 표시하는 함수
  async handleMonthExpenses() {
    // 이번 달 지출 내역 계산
    const summary = await this.calculateExpenseSummary('month');
    
    // 지출 내역이 없는 경우 처리
    if (summary.total === 0) {
      const message = this.createChatBotMessage(
        "이번 달은 아직 지출 내역이 없네요!",
        {
          widget: "options",
        }
      );
      this.updateChatbotState(message);
      return;
    }
  
    // 카테고리별 지출 내역을 포맷팅하여 메시지 생성
    const message = this.createChatBotMessage(
      `이번 달 총 지출: ${summary.total.toLocaleString()}원\n` +
      `카테고리별 지출:\n` +
      `${Object.entries(summary.byCategory)
        .map(([category, amount]) => `${category}: ${amount.toLocaleString()}원`)
        .join('\n')}`,
      {
        widget: "options",
      }
    );
    this.updateChatbotState(message);
  }

  // 이번 달 지출에 대한 분석 피드백을 생성하는 함수
  async handleExpenseFeedback() {
    try {
      // 사용자 로그인 상태 확인
      // 오류 대비 혹시 몰라 설정함
      const user = auth.currentUser;
      if (!user) {
        this.updateChatbotState(this.createChatBotMessage(
          "로그인이 필요한 서비스입니다.",
          {
            widget: "options",
          }
        ));
        return;
      }

      // 이번 달 지출 내역 조회
      const monthSummary = await this.calculateExpenseSummary('month');
      console.log('Month summary:', monthSummary);

      // 지출 내역이 없는 경우 처리
      if (monthSummary.total === 0) {
        this.updateChatbotState(this.createChatBotMessage(
          "아직 이번 달 지출 내역이 없습니다.",
          {
            widget: "options",
          }
        ));
        return;
      }

      // 일평균 지출 계산
      const today = new Date();
      const daysInMonth = today.getDate();
      const dailyAverage = monthSummary.total / daysInMonth;

      // API 요청 데이터 준비
      const requestData = {
        total: monthSummary.total,
        dailyAverage,
        byCategory: monthSummary.byCategory,
        daysInMonth
      };

      // API를 통해 지출 분석 요청
      const response = await fetch('https://moneychat-backend-17g5.onrender.com/api/analyze-spending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 분석 결과를 포맷팅하여 표시
      const data = await response.json();
      const formattedFeedback = data.feedback
        .split(/(?:\d+\.\s)/)
        .filter(text => text.trim())
        .map(text => text.trim())
        .join('\n\n');

      const feedbackMessage = this.createChatBotMessage(formattedFeedback,
        {
          widget: "options",
        });
      this.updateChatbotState(feedbackMessage);

    } catch (error) {
      console.error("Error getting feedback:", error);
      const errorMessage = this.createChatBotMessage(
        "죄송합니다. 피드백을 생성하는 중 문제가 발생했어요. 다시 시도해주세요.",
        {
          widget: "options",
        }
      );
      this.updateChatbotState(errorMessage);
    }
  }

  // 새로운 지출 내역을 데이터베이스에 저장하는 함수
  async saveExpense(subject, category, amount) {
    // 사용자 인증 확인
    const user = auth.currentUser;
    if (!user) return;

    // 저장할 지출 데이터 준비
    const expenseData = {
      subject, // 상세 지출 내용
      category, // 지출 카테고리
      amount, // 금액
      timestamp: Timestamp.now(), // 시간
    };

    // Firestore에 지출 데이터 저장
    const expensesRef = collection(db, 'expenses');
    const userDocRef = doc(expensesRef, user.uid);
    const userExpensesRef = collection(userDocRef, 'userExpenses');
    await addDoc(userExpensesRef, expenseData);
  }

  // 특정 기간의 지출 내역을 계산하고 요약하는 함수
  async calculateExpenseSummary(period) {
    // 사용자 인증 확인
    const user = auth.currentUser;
    if (!user) return { total: 0, byCategory: {}, bySubject: {} };

    // Firestore 참조 설정
    const userDocRef = doc(db, 'expenses', user.uid);
    const userExpensesRef = collection(userDocRef, 'userExpenses');

    // 조회 기간 설정
    let startDate = new Date();
    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      const dayOfWeek = startDate.getDay();
      startDate.setDate(startDate.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    }

    // 해당 기간의 지출 데이터 조회
    const startTimestamp = Timestamp.fromDate(startDate);
    const q = query(userExpensesRef, where('timestamp', '>=', startTimestamp));
    const snapshot = await getDocs(q);

    // 지출 내역 집계
    let total = 0;
    const byCategory = {};
    const bySubject = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      total += data.amount;
      byCategory[data.category] = (byCategory[data.category] || 0) + data.amount;
      bySubject[data.subject] = (bySubject[data.subject] || 0) + data.amount;
    });

    return { total, byCategory, bySubject };
  }

  // 챗봇의 상태를 업데이트하고 새 메시지를 추가하는 함수
  updateChatbotState(message) {
    // 이전 상태를 유지하면서 새 메시지 추가
    this.setState((prevState) => ({
      ...prevState,
      messages: [...prevState.messages, message],
    }));
  }
}

export default ActionProvider;