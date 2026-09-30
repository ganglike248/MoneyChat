import React, { useRef, useEffect } from 'react';
import { db, auth } from '../firebase/firebaseConfig';
import { collection, doc, addDoc, getDocs, query, where, Timestamp, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { postToBackend } from '../api';
import { getPeriodStart, summarizeExpenses, isValidExpense, toAmount, formatFeedback } from './expenseUtils';

const LOADING_ID = 'loading-msg';

// 최소 로딩 시간 (GPT 응답은 로딩 문구를 모두 볼 수 있도록 길게, DB 조회는 짧게)
const AI_MIN_LOADING_TIME = 3500;
const DB_MIN_LOADING_TIME = 1000;

const LOGIN_REQUIRED_MESSAGE = "로그인이 필요한 서비스입니다.";
const RATE_LIMIT_MESSAGE = "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";

// 사용자에게 그대로 보여줄 메시지를 담은 에러
class UserFacingError extends Error {
  constructor(userMessage) {
    super(userMessage);
    this.userMessage = userMessage;
  }
}

// 로그인한 사용자의 지출 컬렉션 참조
const getUserExpensesRef = () => {
  const user = auth.currentUser;
  if (!user) throw new UserFacingError(LOGIN_REQUIRED_MESSAGE);
  return collection(doc(db, 'expenses', user.uid), 'userExpenses');
};

const SUMMARY_LABELS = {
  today: { request: "📊 오늘 지출 확인", empty: "📊 오늘은 아직 지출 내역이 없네요!", title: "📊 오늘의 총 지출", categoryIcon: "📈" },
  week: { request: "📅 이번 주 지출 확인", empty: "📅 이번 주는 아직 지출 내역이 없네요!", title: "📅 이번 주 총 지출", categoryIcon: "📈" },
  month: { request: "📈 이번 달 지출 확인", empty: "📈 이번 달은 아직 지출 내역이 없네요!", title: "📈 이번 달 총 지출", categoryIcon: "📊" },
};

const ActionProvider = ({ createChatBotMessage, setState, children, actionsRef }) => {

  const loadingTimerRef = useRef(null);
  const loadingStartTimeRef = useRef(null); // 로딩이 시작된 정확한 시간을 기록할 Ref
  const minLoadingTimeRef = useRef(0);

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

  const stopLoadingTimer = () => {
    if (loadingTimerRef.current) {
      clearInterval(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
  };

  const showLoading = (minLoadingTime) => {
    stopLoadingTimer(); // 이전 로딩이 남아 있으면 정리
    loadingStartTimeRef.current = Date.now(); // 로딩 시작 시간 기록
    minLoadingTimeRef.current = minLoadingTime;

    const initialMsg = createChatBotMessage("서버와 통신 중...", { id: LOADING_ID });

    setState((prev) => ({
      ...prev,
      messages: [...clearPreviousWidgets(prev.messages).filter((msg) => msg.id !== LOADING_ID), initialMsg],
    }));

    let step = 0;
    // 1초마다 메시지 변경
    loadingTimerRef.current = setInterval(() => {
      step++;
      setState((prev) => {
        const newMessages = [...prev.messages];
        const loadingMsgIndex = newMessages.findIndex(msg => msg.id === LOADING_ID);

        if (loadingMsgIndex !== -1) {
           let newText = "서버와 통신 중이에요...";
           if (step === 1) newText = "잠시만요, 요청을 확인하고 있어요...";
           if (step === 2) newText = "열심히 생각하는 중이에요...!";
           if (step >= 3) newText = "거의 다 왔어요!\n답변을 정리하고 있어요...";

           newMessages[loadingMsgIndex] = { ...newMessages[loadingMsgIndex], message: newText };
        } else {
           stopLoadingTimer();
        }
        return { ...prev, messages: newMessages };
      });
    }, 1000);
  };

  const removeLoading = (messages) => {
    stopLoadingTimer();
    loadingStartTimeRef.current = null; // 초기화
    return messages.filter((msg) => msg.id !== LOADING_ID);
  };

  // 답변을 화면에 띄우기 전, 최소 로딩 시간을 채우는 로직
  const addBotMessage = async (message, options = {}) => {
    // 로딩 중이었다면 시간이 얼마나 지났는지 체크
    if (loadingStartTimeRef.current) {
      const elapsedTime = Date.now() - loadingStartTimeRef.current;

      // 응답이 최소 로딩 시간보다 빨리 왔다면, 남은 시간 동안 기다림
      if (elapsedTime < minLoadingTimeRef.current) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTimeRef.current - elapsedTime));
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

  // 로딩 표시 후 작업 실행, 실패 시 반드시 로딩을 치우고 에러 메시지 표시
  const runWithLoading = async (task, errorMessage, minLoadingTime = DB_MIN_LOADING_TIME) => {
    showLoading(minLoadingTime);

    try {
      await task();
    } catch (error) {
      console.error(errorMessage, error);
      if (error.userMessage) addBotMessage(error.userMessage);
      else if (error.status === 401) addBotMessage(LOGIN_REQUIRED_MESSAGE);
      else if (error.status === 429) addBotMessage(RATE_LIMIT_MESSAGE);
      else addBotMessage(errorMessage);
    }
  };

  const saveExpense = async (subject, category, amount) => {
    const docRef = await addDoc(getUserExpensesRef(), {
      subject, category, amount, timestamp: Timestamp.now(),
    });
    return docRef.id;
  };

  const fetchExpensesSince = async (startDate) => {
    const q = query(getUserExpensesRef(), where('timestamp', '>=', Timestamp.fromDate(startDate)));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((expenseDoc) => expenseDoc.data());
  };

  const calculateExpenseSummary = async (period) => {
    return summarizeExpenses(await fetchExpensesSince(getPeriodStart(period)));
  };

  const handleMessage = async (message) => {
    if (!message || !message.trim()) {
      addBotMessage("⚠️ 메시지를 입력해주세요!");
      return;
    }

    await runWithLoading(async () => {
      const analysis = await postToBackend('/api/analyze-message', { message });

      if (isValidExpense(analysis)) {
        const amount = toAmount(analysis.amount);
        const expenseId = await saveExpense(analysis.subject, analysis.category, amount);
        addBotMessage(
          `${analysis.subject}(${analysis.category}) 항목에 ${amount.toLocaleString()}원을 지출하셨네요!\n${analysis.feedback}`,
          { widget: 'expenseUndo', payload: { expenseId } }
        );
      } else {
        addBotMessage(analysis.feedback);
      }
    }, "죄송합니다. 처리 중 문제가 발생했어요. 다시 시도해주세요.", AI_MIN_LOADING_TIME);
  };

  const showExpenseSummary = async (period) => {
    const labels = SUMMARY_LABELS[period];
    addUserMessage(labels.request);

    await runWithLoading(async () => {
      const summary = await calculateExpenseSummary(period);
      if (summary.total === 0) {
        addBotMessage(labels.empty);
        return;
      }

      let message = `${labels.title}: ${summary.total.toLocaleString()}원\n\n` +
        `${labels.categoryIcon} 카테고리별 지출:\n${Object.entries(summary.byCategory).map(([category, amount]) => `• ${category}: ${amount.toLocaleString()}원`).join('\n')}`;

      if (period === 'today') {
        message += `\n\n📝 상세 지출:\n${Object.entries(summary.bySubject).map(([subject, amount]) => `• ${subject}: ${amount.toLocaleString()}원`).join('\n')}`;
      }

      addBotMessage(message);
    }, "지출 조회 중 오류가 발생했습니다. 다시 시도해주세요.");
  };

  const handleTodayExpenses = () => showExpenseSummary('today');
  const handleWeekExpenses = () => showExpenseSummary('week');
  const handleMonthExpenses = () => showExpenseSummary('month');

  const handleExpenseFeedback = async () => {
    addUserMessage("🔍 지출 패턴 분석");

    await runWithLoading(async () => {
      const monthSummary = await calculateExpenseSummary('month');
      if (monthSummary.total === 0) {
        addBotMessage("아직 이번 달 지출 내역이 없습니다.");
        return;
      }

      const daysInMonth = new Date().getDate();
      const data = await postToBackend('/api/analyze-spending', {
        total: monthSummary.total,
        dailyAverage: monthSummary.total / daysInMonth,
        byCategory: monthSummary.byCategory,
        daysInMonth
      });

      addBotMessage(formatFeedback(data.feedback));
    }, "죄송합니다. 피드백을 생성하는 중 문제가 발생했어요. 다시 시도해주세요.", AI_MIN_LOADING_TIME);
  };

  const handleMonthDetailExpenses = async () => {
    addUserMessage("📋 이번 달 지출 상세");

    await runWithLoading(async () => {
      const q = query(getUserExpensesRef(), where('timestamp', '>=', Timestamp.fromDate(getPeriodStart('month'))), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        addBotMessage("이번 달에 입력된 지출 내역이 없습니다. 💸");
        return;
      }

      const expensesByDate = {};
      let totalAmount = 0;

      querySnapshot.forEach((expenseDoc) => {
        const data = expenseDoc.data();
        const amount = toAmount(data.amount);
        if (amount === null) return;

        const dateKey = data.timestamp.toDate().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
        if (!expensesByDate[dateKey]) expensesByDate[dateKey] = [];
        expensesByDate[dateKey].push({ ...data, amount });
        totalAmount += amount;
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
    }, "지출 상세 조회 중 오류가 발생했습니다. 다시 시도해주세요.");
  };

  const handleRecentExpense = async () => {
    addUserMessage("🕒 최근 지출 알아보기");

    await runWithLoading(async () => {
      const q = query(getUserExpensesRef(), orderBy('timestamp', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        addBotMessage("아직 입력된 지출 내역이 없습니다. 💸\n\n지출 내용을 자유롭게 입력해주세요!");
        return;
      }

      const recentExpense = querySnapshot.docs[0].data();
      const expenseDate = recentExpense.timestamp.toDate();
      const formattedDate = expenseDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
      const formattedTime = expenseDate.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true });
      const amount = toAmount(recentExpense.amount) ?? 0;

      addBotMessage(`🕒 가장 최근 지출 정보\n\n📅 ${formattedDate} ${formattedTime}\n💰 ${recentExpense.subject}(${recentExpense.category}) ${amount.toLocaleString()}원`);
    }, "최근 지출 조회 중 오류가 발생했습니다. 다시 시도해주세요.");
  };

  // 방금 입력한 지출(문서 ID)만 삭제
  const handleUndoExpense = async (expenseId) => {
    await runWithLoading(async () => {
      if (!expenseId) throw new UserFacingError("취소할 지출 내역을 찾을 수 없습니다.");

      await deleteDoc(doc(getUserExpensesRef(), expenseId));
      addBotMessage("지출 입력이 취소되었습니다.");
    }, "지출 취소 중 오류가 발생했습니다. 다시 시도해주세요.");
  };

  const actions = {
    handleMessage, handleTodayExpenses, handleWeekExpenses, handleMonthExpenses,
    handleExpenseFeedback, handleMonthDetailExpenses, handleRecentExpense, handleUndoExpense,
  };

  // 메뉴 버튼 등 챗봇 외부에서 액션을 호출할 수 있도록 공유
  if (actionsRef) actionsRef.current = actions;

  return (
    <div>
      {React.Children.map(children, (child) => {
        return React.cloneElement(child, { actions });
      })}
    </div>
  );
};

export default ActionProvider;
