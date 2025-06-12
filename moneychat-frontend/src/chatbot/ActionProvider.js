import React from 'react';
import { db, auth } from '../firebase/firebaseConfig';
import { collection, doc, addDoc, getDocs, query, where, Timestamp, orderBy, limit } from 'firebase/firestore';

// 함수형 컴포넌트로 완전히 변경
const ActionProvider = ({ createChatBotMessage, setState, children }) => {

  // 사용자 메시지를 수동으로 생성하는 함수
  const addUserMessage = (message) => {
    const userMessage = {
      message: message,
      type: 'user',
      id: Date.now() + Math.random(),
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
    }));
  };

  // 봇 메시지 추가 헬퍼 함수
  const addBotMessage = (message) => {
    const botMessage = createChatBotMessage(message);
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, botMessage],
    }));
  };

  // 사용자 입력 메시지를 분석하고 처리하는 함수
  const handleMessage = async (message) => {
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const analysis = await response.json();

      if (analysis.hasExpense && analysis.amount && analysis.category) {
        await saveExpense(analysis.subject, analysis.category, analysis.amount);

        const responseMessage = createChatBotMessage(
          `${analysis.subject}(${analysis.category}) 항목에 ${analysis.amount.toLocaleString()}원을 지출하셨네요!\n${analysis.feedback}`
        );
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, responseMessage],
        }));
      } else {
        const defaultMessage = createChatBotMessage(analysis.feedback);
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, defaultMessage],
        }));
      }
    } catch (error) {
      console.error("Error in handleMessage:", error);
      const errorMessage = createChatBotMessage(
        "죄송합니다. 처리 중 문제가 발생했어요. 다시 시도해주세요."
      );
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
      }));
    }
  };

  // 오늘의 지출 내역 조회
  const handleTodayExpenses = async () => {
    addUserMessage("📊 오늘 지출 확인");

    const summary = await calculateExpenseSummary('today');

    if (summary.total === 0) {
      addBotMessage("📊 오늘은 아직 지출 내역이 없네요!");
      return;
    }

    const message = `📊 오늘의 총 지출: ${summary.total.toLocaleString()}원\n\n` +
      `📈 카테고리별 지출:\n` +
      `${Object.entries(summary.byCategory)
        .map(([category, amount]) => `• ${category}: ${amount.toLocaleString()}원`)
        .join('\n')}\n\n` +
      `📝 상세 지출:\n` +
      `${Object.entries(summary.bySubject)
        .map(([subject, amount]) => `• ${subject}: ${amount.toLocaleString()}원`)
        .join('\n')}`;

    addBotMessage(message);
  };

  // 이번 주 지출 내역 조회
  const handleWeekExpenses = async () => {
    addUserMessage("📅 이번 주 지출 확인");

    const summary = await calculateExpenseSummary('week');

    if (summary.total === 0) {
      addBotMessage("📅 이번 주는 아직 지출 내역이 없네요!");
      return;
    }

    const message = `📅 이번 주 총 지출: ${summary.total.toLocaleString()}원\n\n` +
      `📈 카테고리별 지출:\n` +
      `${Object.entries(summary.byCategory)
        .map(([category, amount]) => `• ${category}: ${amount.toLocaleString()}원`)
        .join('\n')}`;

    addBotMessage(message);
  };

  // 이번 달 지출 내역 조회
  const handleMonthExpenses = async () => {
    addUserMessage("📈 이번 달 지출 확인");

    const summary = await calculateExpenseSummary('month');

    if (summary.total === 0) {
      addBotMessage("📈 이번 달은 아직 지출 내역이 없네요!");
      return;
    }

    const message = `📈 이번 달 총 지출: ${summary.total.toLocaleString()}원\n\n` +
      `📊 카테고리별 지출:\n` +
      `${Object.entries(summary.byCategory)
        .map(([category, amount]) => `• ${category}: ${amount.toLocaleString()}원`)
        .join('\n')}`;

    addBotMessage(message);
  };

  // 지출 패턴 분석
  const handleExpenseFeedback = async () => {
    addUserMessage("🔍 지출 패턴 분석");

    try {
      const user = auth.currentUser;
      if (!user) {
        addBotMessage("로그인이 필요한 서비스입니다.");
        return;
      }

      const monthSummary = await calculateExpenseSummary('month');

      if (monthSummary.total === 0) {
        addBotMessage("아직 이번 달 지출 내역이 없습니다.");
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

      addBotMessage(formattedFeedback);
    } catch (error) {
      console.error("Error getting feedback:", error);
      addBotMessage("죄송합니다. 피드백을 생성하는 중 문제가 발생했어요. 다시 시도해주세요.");
    }
  };

  // 이번 달 지출 상세 조회
  const handleMonthDetailExpenses = async () => {
    addUserMessage("📋 이번 달 지출 상세");

    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDocRef = doc(db, 'expenses', user.uid);
      const userExpensesRef = collection(userDocRef, 'userExpenses');

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startTimestamp = Timestamp.fromDate(startOfMonth);

      const q = query(
        userExpensesRef,
        where('timestamp', '>=', startTimestamp),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        addBotMessage("이번 달에 입력된 지출 내역이 없습니다. 💸");
        return;
      }

      const expensesByDate = {};
      let totalAmount = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const expenseDate = data.timestamp.toDate();
        const dateKey = expenseDate.toLocaleDateString('ko-KR', {
          month: 'long',
          day: 'numeric'
        });

        if (!expensesByDate[dateKey]) {
          expensesByDate[dateKey] = [];
        }

        expensesByDate[dateKey].push(data);
        totalAmount += data.amount;
      });

      const monthName = now.toLocaleDateString('ko-KR', { month: 'long' });
      let detailMessage = `📋 ${monthName}의 지출 상세 정보\n\n`;

      Object.keys(expensesByDate).forEach(date => {
        detailMessage += `📅 ${date}\n`;
        expensesByDate[date].forEach(expense => {
          detailMessage += `  • ${expense.category} / ${expense.subject} / ${expense.amount.toLocaleString()}원\n`;
        });
        detailMessage += '\n';
      });

      detailMessage += `💰 총 ${totalAmount.toLocaleString()}원`;
      addBotMessage(detailMessage);

    } catch (error) {
      console.error("지출 상세 조회 실패:", error);
      addBotMessage("지출 상세 조회 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  // 최근 지출 조회
  const handleRecentExpense = async () => {
    addUserMessage("🕒 최근 지출 알아보기");

    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDocRef = doc(db, 'expenses', user.uid);
      const userExpensesRef = collection(userDocRef, 'userExpenses');

      const q = query(
        userExpensesRef,
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        addBotMessage("아직 입력된 지출 내역이 없습니다. 💸\n\n지출 내용을 자유롭게 입력해주세요!");
        return;
      }

      const recentExpense = querySnapshot.docs[0].data();
      const expenseDate = recentExpense.timestamp.toDate();

      const formattedDate = expenseDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const formattedTime = expenseDate.toLocaleTimeString('ko-KR', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      const recentMessage = `🕒 가장 최근 지출 정보\n\n📅 ${formattedDate} ${formattedTime}\n💰 ${recentExpense.subject}(${recentExpense.category}) ${recentExpense.amount.toLocaleString()}원`;

      addBotMessage(recentMessage);

    } catch (error) {
      console.error("최근 지출 조회 실패:", error);
      addBotMessage("최근 지출 조회 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  // 지출 저장 함수
  const saveExpense = async (subject, category, amount) => {
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
  };

  // 지출 요약 계산 함수
  const calculateExpenseSummary = async (period) => {
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
  };

  return (
    <div>
      {React.Children.map(children, (child) => {
        return React.cloneElement(child, {
          actions: {
            handleMessage,
            handleTodayExpenses,
            handleWeekExpenses,
            handleMonthExpenses,
            handleExpenseFeedback,
            handleMonthDetailExpenses,
            handleRecentExpense,
          },
        });
      })}
    </div>
  );
};

export default ActionProvider;
