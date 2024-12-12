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
    this.addOptionsMessage = this.addOptionsMessage.bind(this);
  }

  // 새로운 메서드: 옵션 메시지 추가
  addOptionsMessage() {
    const optionsMessage = this.createChatBotMessage(
      "지금까지의 지출 현황을 확인해보시겠어요?",
      {
        widget: "options",
      }
    );
    this.updateChatbotState(optionsMessage);
  }

  async handleMessage(message) {
    console.log("ActionProvider handling message:", message);
    try {
      if (!message.trim()) {
        throw new Error('메시지가 비어있습니다.');
      }

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

      if (analysis.hasExpense && analysis.amount && analysis.category) {
        await this.saveExpense(analysis.subject, analysis.category, analysis.amount);

        const responseMessage = this.createChatBotMessage(
          `${analysis.subject}(${analysis.category}) 항목에 ${analysis.amount.toLocaleString()}원을 지출하셨네요!\n${analysis.feedback}`
        );
        this.updateChatbotState(responseMessage);
      } else {
        const defaultMessage = this.createChatBotMessage(analysis.feedback);
        this.updateChatbotState(defaultMessage);
      }
      
      // 모든 응답 후에 옵션 메시지 추가
      this.addOptionsMessage();
    } catch (error) {
      console.error("Error in handleMessage:", error);
      const errorMessage = this.createChatBotMessage(
        "죄송합니다. 처리 중 문제가 발생했어요. 다시 시도해주세요."
      );
      this.updateChatbotState(errorMessage);
      this.addOptionsMessage();
    }
  }

  async handleTodayExpenses() {
    const summary = await this.calculateExpenseSummary('today');
    const message = this.createChatBotMessage(
      `오늘의 총 지출: ${summary.total.toLocaleString()}원\n\n` +
      `카테고리별 지출:\n` +
      `${Object.entries(summary.byCategory)
        .map(([category, amount]) => `${category}: ${amount.toLocaleString()}원`)
        .join('\n')}\n\n` +
      `상세 지출:\n` +
      `${Object.entries(summary.bySubject)
        .map(([subject, amount]) => `${subject}: ${amount.toLocaleString()}원`)
        .join('\n')}`
    );
    this.updateChatbotState(message);
    this.addOptionsMessage();
  }

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
    this.addOptionsMessage();
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
    this.addOptionsMessage();
  }

  async handleExpenseFeedback() {
    try {
      const user = auth.currentUser;
      if (!user) {
        this.updateChatbotState(this.createChatBotMessage(
          "로그인이 필요한 서비스입니다."
        ));
        this.addOptionsMessage();
        return;
      }

      const monthSummary = await this.calculateExpenseSummary('month');
      console.log('Month summary:', monthSummary);

      if (monthSummary.total === 0) {
        this.updateChatbotState(this.createChatBotMessage(
          "아직 이번 달 지출 내역이 없습니다."
        ));
        this.addOptionsMessage();
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

      const data = await response.json();
      const formattedFeedback = data.feedback
        .split(/(?:\d+\.\s)/)
        .filter(text => text.trim())
        .map(text => text.trim())
        .join('\n\n');

      const feedbackMessage = this.createChatBotMessage(formattedFeedback);
      this.updateChatbotState(feedbackMessage);
      this.addOptionsMessage();

    } catch (error) {
      console.error("Error getting feedback:", error);
      const errorMessage = this.createChatBotMessage(
        "죄송합니다. 피드백을 생성하는 중 문제가 발생했어요. 다시 시도해주세요."
      );
      this.updateChatbotState(errorMessage);
      this.addOptionsMessage();
    }
  }

  async saveExpense(subject, category, amount) {
    const user = auth.currentUser;
    if (!user) return;

    const expenseData = {
      subject,
      category,
      amount,
      timestamp: Timestamp.now(),
    };

    const expensesRef = collection(db, 'expenses');
    const userDocRef = doc(expensesRef, user.uid);
    const userExpensesRef = collection(userDocRef, 'userExpenses');
    await addDoc(userExpensesRef, expenseData);
  }

  async calculateExpenseSummary(period) {
    const user = auth.currentUser;
    if (!user) return { total: 0, byCategory: {}, bySubject: {} };

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
    const bySubject = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      total += data.amount;
      byCategory[data.category] = (byCategory[data.category] || 0) + data.amount;
      bySubject[data.subject] = (bySubject[data.subject] || 0) + data.amount;
    });

    return { total, byCategory, bySubject };
  }

  updateChatbotState(message) {
    this.setState((prevState) => ({
      ...prevState,
      messages: [...prevState.messages, message],
    }));
  }
}

export default ActionProvider;