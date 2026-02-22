import React, { useRef, useEffect } from 'react';
import { db, auth } from '../firebase/firebaseConfig';
import { collection, doc, addDoc, getDocs, query, where, Timestamp, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { BACKEND_BASE_URL } from '../App';

// 함수형 컴포넌트로 완전히 변경
const ActionProvider = ({ createChatBotMessage, setState, children }) => {

  // 로딩 타이머를 관리하기 위한 Ref 추가
  const loadingTimerRef = useRef(null);

  // 컴포넌트 언마운트 시 메모리 누수를 막기 위해 타이머 정리
  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    };
  }, []);

  // 취소 버튼 중복 방지
  const clearPreviousWidgets = (messages) => {
    return messages.map((msg) => {
      if (msg.widget === 'expenseUndo') {
        const { widget, ...rest } = msg;
        return rest;
      }
      return msg;
    });
  };

  // 사용자 메시지를 수동으로 생성하는 함수
  const addUserMessage = (message) => {
    const userMessage = {
      message: message,
      type: 'user',
      id: Date.now() + Math.random(),
    };

    setState((prev) => ({
      ...prev,
      messages: [...clearPreviousWidgets(prev.messages), userMessage],
    }));
  };

  // 💡 [핵심 기능] 단계별 로딩 메시지 표시 함수
  const showLoading = () => {
    const loadingId = 'loading-msg';
    const initialMsg = createChatBotMessage("⏳ 서버와 통신 중...", { id: loadingId });

    setState((prev) => ({
      ...prev,
      messages: [...clearPreviousWidgets(prev.messages), initialMsg],
    }));

    let step = 0;
    // 1.2초마다 메시지 텍스트를 동적으로 변경합니다.
    loadingTimerRef.current = setInterval(() => {
      step++;
      setState((prev) => {
        const newMessages = [...prev.messages];
        const loadingMsgIndex = newMessages.findIndex(msg => msg.id === loadingId);

        if (loadingMsgIndex !== -1) {
           let newText = "⏳ 서버와 통신 중...";
           if (step === 1) newText = "🧠 AI가 생각하는 중...";
           if (step >= 2) newText = "💡 생각을 정리하는 중...";

           // 기존 메시지 객체의 텍스트만 교체
           newMessages[loadingMsgIndex] = { ...newMessages[loadingMsgIndex], message: newText };
        } else {
           // 로딩 메시지가 지워졌다면 타이머 중지
           if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
        }
        return { ...prev, messages: newMessages };
      });
    }, 1200); 
  };

  // 로딩 메시지 강제 제거 함수
  const removeLoading = (messages) => {
    if (loadingTimerRef.current) {
      clearInterval(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    return messages.filter((msg) => msg.id !== "loading-msg");
  };

  // 봇 메시지 추가 헬퍼 함수 (로딩 메시지 자동 제거 기능 통합)
  const addBotMessage = (message, options = {}) => { 
    const botMessage = createChatBotMessage(message, options);
    setState((prev) => {
      const cleanedMessages = clearPreviousWidgets(prev.messages);
      const withoutLoading = removeLoading(cleanedMessages);
      return {
        ...prev,
        messages: [...withoutLoading, botMessage],
      }
    });
  };

  // 사용자 입력 메시지를 분석하고 처리하는 함수
  const handleMessage = async (message) => {
    try {
      if (!message || !message.trim()) {
        addBotMessage("⚠️ 메시지를 입력해주세요!");
        return; 
      }

      // 🚀 사용자가 메시지를 입력한 직후 바로 로딩 시작!
      showLoading();

      const response = await fetch(`${BACKEND_BASE_URL}/api/analyze-message`, {
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

      // 분석 결과가 지출 내역을 포함하고 있다면
      if (analysis.hasExpense && analysis.amount && analysis.category) {
        await saveExpense(analysis.subject, analysis.category, analysis.amount);

        addBotMessage(
          `${analysis.subject}(${analysis.category}) 항목에 ${analysis.amount.toLocaleString()}원을 지출하셨네요!\n${analysis.feedback}`,
          {
            widget: 'expenseUndo',
          }
        );
      } else {
        addBotMessage(analysis.feedback);
      }
    } catch (error) {
      console.error("Error in handleMessage:", error);
      addBotMessage("죄송합니다. 처리 중 문제가 발생했어요. 다시 시도해주세요.");
    }
  };

  // 오늘의 지출 내역 조회
  const handleTodayExpenses = async () => {
    addUserMessage("📊 오늘 지출 확인");
    showLoading(); // 🚀 로딩 시작

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
    showLoading(); // 🚀 로딩 시작

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
    showLoading(); // 🚀 로딩 시작

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
    showLoading(); // 🚀 로딩 시작

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
    showLoading(); // 🚀 로딩 시작

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
    showLoading(); // 🚀 로딩 시작

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

  // 가장 최근 지출 1건 취소
  const handleUndoRecentExpense = async () => {
    showLoading(); // 🚀 로딩 시작

    try {
      const user = auth.currentUser;
      if (!user) {
        addBotMessage("로그인이 필요한 서비스입니다.");
        return;
      }

      const userDocRef = doc(db, 'expenses', user.uid);
      const userExpensesRef = collection(userDocRef, 'userExpenses');

      const q = query(
        userExpensesRef,
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        addBotMessage("취소할 최근 지출 내역이 없습니다.");
        return;
      }

      const recentExpenseDoc = querySnapshot.docs[0];
      await deleteDoc(recentExpenseDoc.ref);

      addBotMessage("지출 입력이 취소되었습니다.");
    } catch (error) {
      console.error("최근 지출 취소 실패:", error);
      addBotMessage("최근 지출 취소 중 오류가 발생했습니다. 다시 시도해주세요.");
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
            handleUndoRecentExpense,
          },
        });
      })}
    </div>
  );
};

export default ActionProvider;