import React, { useRef, useEffect } from 'react';
import { db, auth } from '../firebase/firebaseConfig';
import { collection, doc, addDoc, getDocs, query, where, Timestamp, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { BACKEND_BASE_URL } from '../App';

const ActionProvider = ({ createChatBotMessage, setState, children }) => {

  const loadingTimerRef = useRef(null);
  const loadingStartTimeRef = useRef(null); // 로딩이 시작된 정확한 시간을 기록할 Ref

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    };
  }, []);

  const clearPreviousWidgets = (messages) => {
    return messages.map((msg) => {
      if (msg.widget === 'expenseUndo') {
        const { widget, ...rest } = msg;
        return rest;
      }
      return msg;
    });
  };

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

  const showLoading = () => {
    loadingStartTimeRef.current = Date.now(); // 로딩 시작 시간 기록
    
    const loadingId = 'loading-msg';
    const initialMsg = createChatBotMessage("서버와 통신 중...", { id: loadingId });

    setState((prev) => ({
      ...prev,
      messages: [...clearPreviousWidgets(prev.messages), initialMsg],
    }));

    let step = 0;
    // 1초마다 메시지 변경
    loadingTimerRef.current = setInterval(() => {
      step++;
      setState((prev) => {
        const newMessages = [...prev.messages];
        const loadingMsgIndex = newMessages.findIndex(msg => msg.id === loadingId);

        if (loadingMsgIndex !== -1) {
           let newText = "서버와 통신 중이에요...";
           if (step === 1) newText = "잠시만요, 요청을 확인하고 있어요...";
           if (step === 2) newText = "열심히 생각하는 중이에요...!";
           if (step >= 3) newText = "거의 다 왔어요!\n답변을 정리하고 있어요...";

           newMessages[loadingMsgIndex] = { ...newMessages[loadingMsgIndex], message: newText };
        } else {
           if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
        }
        return { ...prev, messages: newMessages };
      });
    }, 1000); 
  };

  const removeLoading = (messages) => {
    if (loadingTimerRef.current) {
      clearInterval(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    loadingStartTimeRef.current = null; // 초기화
    return messages.filter((msg) => msg.id !== "loading-msg");
  };

  // 답변을 화면에 띄우기 전, 최소 로딩 시간을 채우는 로직
  const addBotMessage = async (message, options = {}) => { 
    // 로딩 중이었다면 시간이 얼마나 지났는지 체크
    if (loadingStartTimeRef.current) {
      const elapsedTime = Date.now() - loadingStartTimeRef.current;
      const MIN_LOADING_TIME = 3500; // 최소 2.5초 대기 보장 (1초:생각중, 2초:정리중을 모두 볼 수 있음)
      
      // 만약 API가 0.5초만에 응답했다면, 남은 2초 동안 강제로 기다림
      if (elapsedTime < MIN_LOADING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsedTime));
      }
    }

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

  const handleMessage = async (message) => {
    try {
      if (!message || !message.trim()) {
        addBotMessage("⚠️ 메시지를 입력해주세요!");
        return; 
      }

      showLoading(); // 로딩 시작

      const response = await fetch(`${BACKEND_BASE_URL}/api/analyze-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const analysis = await response.json();

      if (analysis.hasExpense && analysis.amount && analysis.category) {
        await saveExpense(analysis.subject, analysis.category, analysis.amount);
        addBotMessage(
          `${analysis.subject}(${analysis.category}) 항목에 ${analysis.amount.toLocaleString()}원을 지출하셨네요!\n${analysis.feedback}`,
          { widget: 'expenseUndo' }
        );
      } else {
        addBotMessage(analysis.feedback);
      }
    } catch (error) {
      console.error("Error in handleMessage:", error);
      addBotMessage("죄송합니다. 처리 중 문제가 발생했어요. 다시 시도해주세요.");
    }
  };

  const handleTodayExpenses = async () => {
    addUserMessage("📊 오늘 지출 확인");
    showLoading();

    const summary = await calculateExpenseSummary('today');
    if (summary.total === 0) {
      addBotMessage("📊 오늘은 아직 지출 내역이 없네요!");
      return;
    }

    const message = `📊 오늘의 총 지출: ${summary.total.toLocaleString()}원\n\n` +
      `📈 카테고리별 지출:\n${Object.entries(summary.byCategory).map(([category, amount]) => `• ${category}: ${amount.toLocaleString()}원`).join('\n')}\n\n` +
      `📝 상세 지출:\n${Object.entries(summary.bySubject).map(([subject, amount]) => `• ${subject}: ${amount.toLocaleString()}원`).join('\n')}`;

    addBotMessage(message);
  };

  const handleWeekExpenses = async () => {
    addUserMessage("📅 이번 주 지출 확인");
    showLoading();

    const summary = await calculateExpenseSummary('week');
    if (summary.total === 0) {
      addBotMessage("📅 이번 주는 아직 지출 내역이 없네요!");
      return;
    }

    const message = `📅 이번 주 총 지출: ${summary.total.toLocaleString()}원\n\n` +
      `📈 카테고리별 지출:\n${Object.entries(summary.byCategory).map(([category, amount]) => `• ${category}: ${amount.toLocaleString()}원`).join('\n')}`;

    addBotMessage(message);
  };

  const handleMonthExpenses = async () => {
    addUserMessage("📈 이번 달 지출 확인");
    showLoading();

    const summary = await calculateExpenseSummary('month');
    if (summary.total === 0) {
      addBotMessage("📈 이번 달은 아직 지출 내역이 없네요!");
      return;
    }

    const message = `📈 이번 달 총 지출: ${summary.total.toLocaleString()}원\n\n` +
      `📊 카테고리별 지출:\n${Object.entries(summary.byCategory).map(([category, amount]) => `• ${category}: ${amount.toLocaleString()}원`).join('\n')}`;

    addBotMessage(message);
  };

  const handleExpenseFeedback = async () => {
    addUserMessage("🔍 지출 패턴 분석");
    showLoading();

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

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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

  const handleMonthDetailExpenses = async () => {
    addUserMessage("📋 이번 달 지출 상세");
    showLoading();

    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDocRef = doc(db, 'expenses', user.uid);
      const userExpensesRef = collection(userDocRef, 'userExpenses');
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      
      const q = query(userExpensesRef, where('timestamp', '>=', Timestamp.fromDate(startOfMonth)), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        addBotMessage("이번 달에 입력된 지출 내역이 없습니다. 💸");
        return;
      }

      const expensesByDate = {};
      let totalAmount = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const dateKey = data.timestamp.toDate().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
        if (!expensesByDate[dateKey]) expensesByDate[dateKey] = [];
        expensesByDate[dateKey].push(data);
        totalAmount += data.amount;
      });

      let detailMessage = `📋 ${new Date().toLocaleDateString('ko-KR', { month: 'long' })}의 지출 상세 정보\n\n`;
      Object.keys(expensesByDate).forEach(date => {
        detailMessage += `📅 ${date}\n`;
        expensesByDate[date].forEach(exp => {
          detailMessage += `  • ${exp.category} / ${exp.subject} / ${exp.amount.toLocaleString()}원\n`;
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

  const handleRecentExpense = async () => {
    addUserMessage("🕒 최근 지출 알아보기");
    showLoading();

    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDocRef = doc(db, 'expenses', user.uid);
      const q = query(collection(userDocRef, 'userExpenses'), orderBy('timestamp', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        addBotMessage("아직 입력된 지출 내역이 없습니다. 💸\n\n지출 내용을 자유롭게 입력해주세요!");
        return;
      }

      const recentExpense = querySnapshot.docs[0].data();
      const expenseDate = recentExpense.timestamp.toDate();
      const formattedDate = expenseDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
      const formattedTime = expenseDate.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true });

      addBotMessage(`🕒 가장 최근 지출 정보\n\n📅 ${formattedDate} ${formattedTime}\n💰 ${recentExpense.subject}(${recentExpense.category}) ${recentExpense.amount.toLocaleString()}원`);
    } catch (error) {
      console.error("최근 지출 조회 실패:", error);
      addBotMessage("최근 지출 조회 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const handleUndoRecentExpense = async () => {
    showLoading();

    try {
      const user = auth.currentUser;
      if (!user) {
        addBotMessage("로그인이 필요한 서비스입니다.");
        return;
      }

      const q = query(collection(doc(db, 'expenses', user.uid), 'userExpenses'), orderBy('timestamp', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        addBotMessage("취소할 최근 지출 내역이 없습니다.");
        return;
      }

      await deleteDoc(querySnapshot.docs[0].ref);
      addBotMessage("지출 입력이 취소되었습니다.");
    } catch (error) {
      console.error("최근 지출 취소 실패:", error);
      addBotMessage("최근 지출 취소 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const saveExpense = async (subject, category, amount) => {
    const user = auth.currentUser;
    if (!user) return;
    await addDoc(collection(doc(collection(db, 'expenses'), user.uid), 'userExpenses'), {
      subject, category, amount, timestamp: Timestamp.now(),
    });
  };

  const calculateExpenseSummary = async (period) => {
    const user = auth.currentUser;
    if (!user) return { total: 0, byCategory: {}, bySubject: {} };

    let startDate = new Date();
    if (period === 'today') startDate.setHours(0, 0, 0, 0);
    else if (period === 'week') { startDate.setDate(startDate.getDate() - startDate.getDay()); startDate.setHours(0, 0, 0, 0); }
    else if (period === 'month') startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    const q = query(collection(doc(db, 'expenses', user.uid), 'userExpenses'), where('timestamp', '>=', Timestamp.fromDate(startDate)));
    const snapshot = await getDocs(q);

    let total = 0; const byCategory = {}; const bySubject = {};
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
            handleMessage, handleTodayExpenses, handleWeekExpenses, handleMonthExpenses,
            handleExpenseFeedback, handleMonthDetailExpenses, handleRecentExpense, handleUndoRecentExpense,
          },
        });
      })}
    </div>
  );
};

export default ActionProvider;