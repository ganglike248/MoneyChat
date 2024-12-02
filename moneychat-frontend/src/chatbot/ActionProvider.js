import { db, auth } from '../firebase/firebaseConfig';
import { collection, doc, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';

class ActionProvider {
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

  async handleMessage(message) {
    console.log("ActionProvider handling message:", message);
    try {
      // GPT API를 통해 메시지 분석
      const response = await fetch('http://localhost:3001/api/analyze-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const analysis = await response.json();
      console.log("Message analysis:", analysis);

      if (analysis.hasExpense && analysis.amount && analysis.category) {
        // 지출 정보 저장
        await this.saveExpense(analysis.category, analysis.amount);
        
        // 지출 입력에 대한 응답
        const responseMessage = this.createChatBotMessage(
          `${analysis.category}에 ${analysis.amount.toLocaleString()}원을 지출하셨네요!\n${analysis.feedback}`
        );
        this.updateChatbotState(responseMessage);

        // 지출 분석 제안
        const analysisMessage = this.createChatBotMessage(
          "지금까지의 지출 현황을 확인해보시겠어요?",
          {
            widget: "options",
          }
        );
        this.updateChatbotState(analysisMessage);
      } else {
        // GPT가 생성한 응답 메시지 표시
        const defaultMessage = this.createChatBotMessage(analysis.feedback);
        this.updateChatbotState(defaultMessage);
      }
    } catch (error) {
      console.error("Error in handleMessage:", error);
      const errorMessage = this.createChatBotMessage(
        "죄송합니다. 처리 중 문제가 발생했어요. 다시 시도해주세요."
      );
      this.updateChatbotState(errorMessage);
    }
  }

  async saveExpense(category, amount) {
    const user = auth.currentUser;
    if (!user) return;

    const expenseData = {
      category,
      amount,
      timestamp: Timestamp.now(),
    };

    const expensesRef = collection(db, 'expenses');
    const userDocRef = doc(expensesRef, user.uid);
    const userExpensesRef = collection(userDocRef, 'userExpenses');
    await addDoc(userExpensesRef, expenseData);
  }

  // ActionProvider.js의 handleTodayExpenses 메서드 수정
async handleTodayExpenses() {
  const summary = await this.calculateExpenseSummary('today');
  const message = this.createChatBotMessage(
    `오늘의 총 지출: ${summary.total.toLocaleString()}원\n` +
    `카테고리별 지출:\n` +
    `${Object.entries(summary.byCategory)
      .map(([category, amount]) => `${category}: ${amount.toLocaleString()}원`)
      .join('\n')}`
  );
  this.updateChatbotState(message);
}

// handleWeekExpenses와 handleMonthExpenses도 같은 방식으로 수정
async handleWeekExpenses() {
  const summary = await this.calculateExpenseSummary('week');
  const message = this.createChatBotMessage(
    `이번 주 총 지출: ${summary.total.toLocaleString()}원\n` +
    `카테고리별 지출:\n` +
    `${Object.entries(summary.byCategory)
      .map(([category, amount]) => `${category}: ${amount.toLocaleString()}원`)
      .join('\n')}`
  );
  this.updateChatbotState(message);
}

async handleMonthExpenses() {
  const summary = await this.calculateExpenseSummary('month');
  const message = this.createChatBotMessage(
    `이번 달 총 지출: ${summary.total.toLocaleString()}원\n` +
    `카테고리별 지출:\n` +
    `${Object.entries(summary.byCategory)
      .map(([category, amount]) => `${category}: ${amount.toLocaleString()}원`)
      .join('\n')}`
  );
  this.updateChatbotState(message);
}

  // handleExpenseFeedback 메서드 수정
async handleExpenseFeedback() {
  try {
    const user = auth.currentUser;
    if (!user) {
      this.updateChatbotState(this.createChatBotMessage(
        "로그인이 필요한 서비스입니다."
      ));
      return;
    }

    const monthSummary = await this.calculateExpenseSummary('month');
    console.log('Month summary:', monthSummary);

    if (monthSummary.total === 0) {
      this.updateChatbotState(this.createChatBotMessage(
        "아직 이번 달 지출 내역이 없습니다."
      ));
      return;
    }

    const today = new Date();
    const daysInMonth = today.getDate();
    const dailyAverage = monthSummary.total / daysInMonth;

    const requestData = {
      total: monthSummary.total,
      dailyAverage,
      byCategory: monthSummary.byCategory,
      daysInMonth
    };

    const response = await fetch('http://localhost:3001/api/analyze-spending', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // 줄바꿈 처리를 위한 텍스트 포매팅
    const formattedFeedback = data.feedback
      .split(/(?:\d+\.\s)/) // 숫자. 으로 시작하는 부분을 기준으로 분리
      .filter(text => text.trim()) // 빈 문자열 제거
      .map(text => text.trim()) // 각 부분 앞뒤 공백 제거
      .join('\n\n'); // 줄바꿈으로 다시 연결

    const feedbackMessage = this.createChatBotMessage(formattedFeedback);
    this.updateChatbotState(feedbackMessage);

  } catch (error) {
    console.error("Error getting feedback:", error);
    const errorMessage = this.createChatBotMessage(
      "죄송합니다. 피드백을 생성하는 중 문제가 발생했어요. 다시 시도해주세요."
    );
    this.updateChatbotState(errorMessage);
  }
}

  async calculateExpenseSummary(period) {
    const user = auth.currentUser;
    if (!user) return { total: 0, byCategory: {} };

    const userDocRef = doc(db, 'expenses', user.uid);
    const userExpensesRef = collection(userDocRef, 'userExpenses');
    
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

    const startTimestamp = Timestamp.fromDate(startDate);
    const q = query(userExpensesRef, where('timestamp', '>=', startTimestamp));
    const snapshot = await getDocs(q);

    let total = 0;
    const byCategory = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      total += data.amount;
      byCategory[data.category] = (byCategory[data.category] || 0) + data.amount;
    });

    return { total, byCategory };
  }

  updateChatbotState(message) {
    this.setState((prevState) => ({
      ...prevState,
      messages: [...prevState.messages, message],
    }));
  }
}

export default ActionProvider;