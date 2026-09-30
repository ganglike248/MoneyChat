import React, { useRef, useEffect } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { postToBackend } from '../api';
import {
  UserFacingError, LOGIN_REQUIRED_MESSAGE,
  addExpenses, deleteExpenses, fetchExpensesSince, fetchRecentExpense,
} from '../expenseRepository';
import {
  getPeriodStart, summarizeExpenses, isValidExpenseItem, toAmount, formatFeedback,
  toLocalDateString, expenseDateFromString, formatMonthDay, buildChatHistory,
} from './expenseUtils';
import { saveChatHistory } from './chatHistory';

const LOADING_ID = 'loading-msg';

// 최소 로딩 시간 (GPT 응답은 로딩 문구를 모두 볼 수 있도록 길게, DB 조회는 짧게)
const AI_MIN_LOADING_TIME = 3500;
const DB_MIN_LOADING_TIME = 1000;

// 백엔드와 동일한 메시지 길이 제한
const MAX_MESSAGE_LENGTH = 500;

// 새 메시지가 오면 사라지는 일회성 위젯
const TRANSIENT_WIDGETS = ['expenseUndo', 'retryMessage'];

const RATE_LIMIT_MESSAGE = "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";
const TIMEOUT_MESSAGE = "서버 응답이 너무 늦어요. 잠시 후 다시 시도해주세요.";
const NETWORK_MESSAGE = "네트워크 연결을 확인해주세요.";
const BUSY_MESSAGE = "이전 요청을 처리하고 있어요. 잠시만 기다려주세요!";

const SUMMARY_LABELS = {
  today: { request: "📊 오늘 지출 확인", empty: "📊 오늘은 아직 지출 내역이 없네요!", title: "📊 오늘의 총 지출", categoryIcon: "📈" },
  week: { request: "📅 이번 주 지출 확인", empty: "📅 이번 주는 아직 지출 내역이 없네요!", title: "📅 이번 주 총 지출", categoryIcon: "📈" },
  month: { request: "📈 이번 달 지출 확인", empty: "📈 이번 달은 아직 지출 내역이 없네요!", title: "📈 이번 달 총 지출", categoryIcon: "📊" },
};

// 로딩 경과 시간(초)에 따른 안내 문구
const getLoadingText = (step) => {
  if (step >= 8) return "서버를 깨우는 중이에요 ☕\n오랜만의 요청은 1~2분 정도 걸릴 수 있어요.";
  if (step >= 3) return "거의 다 왔어요!\n답변을 정리하고 있어요...";
  if (step === 2) return "열심히 생각하는 중이에요...!";
  if (step === 1) return "잠시만요, 요청을 확인하고 있어요...";
  return "서버와 통신 중이에요...";
};

const getErrorMessage = (error, fallback) => {
  if (error.userMessage) return error.userMessage;
  if (error.status === 401) return LOGIN_REQUIRED_MESSAGE;
  if (error.status === 429) return RATE_LIMIT_MESSAGE;
  if (error.status === 'timeout') return TIMEOUT_MESSAGE;
  if (error.status === 'network' || error.code === 'unavailable') return NETWORK_MESSAGE;
  return fallback;
};

const ActionProvider = ({ createChatBotMessage, setState, state, children, actionsRef }) => {

  const loadingTimerRef = useRef(null);
  const loadingStartTimeRef = useRef(null); // 로딩이 시작된 정확한 시간을 기록할 Ref
  const minLoadingTimeRef = useRef(0);
  const busyRef = useRef(false); // 요청 처리 중 중복 요청 방지

  const uid = auth.currentUser?.uid;
  const messages = state?.messages;

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    };
  }, []);

  // 새로고침해도 대화가 남도록 이 기기에 저장
  useEffect(() => {
    if (uid && messages) saveChatHistory(uid, messages, LOADING_ID);
  }, [uid, messages]);

  const clearTransientWidgets = (messageList) => {
    return messageList.map((msg) => {
      if (TRANSIENT_WIDGETS.includes(msg.widget)) {
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
      messages: [...clearTransientWidgets(prev.messages), userMessage],
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

    const initialMsg = createChatBotMessage(getLoadingText(0), { id: LOADING_ID, excludeFromHistory: true });

    setState((prev) => ({
      ...prev,
      messages: [...clearTransientWidgets(prev.messages).filter((msg) => msg.id !== LOADING_ID), initialMsg],
    }));

    let step = 0;
    // 1초마다 메시지 변경
    loadingTimerRef.current = setInterval(() => {
      step++;
      setState((prev) => {
        const newMessages = [...prev.messages];
        const loadingMsgIndex = newMessages.findIndex(msg => msg.id === LOADING_ID);

        if (loadingMsgIndex !== -1) {
           newMessages[loadingMsgIndex] = { ...newMessages[loadingMsgIndex], message: getLoadingText(step) };
        } else {
           stopLoadingTimer();
        }
        return { ...prev, messages: newMessages };
      });
    }, 1000);
  };

  const removeLoading = (messageList) => {
    stopLoadingTimer();
    loadingStartTimeRef.current = null; // 초기화
    return messageList.filter((msg) => msg.id !== LOADING_ID);
  };

  // 답변을 화면에 띄우기 전, 최소 로딩 시간을 채우는 로직
  // keepLoading: 로딩 중에 안내만 끼워 넣을 때 사용 (로딩 메시지 유지)
  const addBotMessage = async (message, options = {}, { keepLoading = false } = {}) => {
    // 로딩 중이었다면 시간이 얼마나 지났는지 체크
    if (!keepLoading && loadingStartTimeRef.current) {
      const elapsedTime = Date.now() - loadingStartTimeRef.current;

      // 응답이 최소 로딩 시간보다 빨리 왔다면, 남은 시간 동안 기다림
      if (elapsedTime < minLoadingTimeRef.current) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTimeRef.current - elapsedTime));
      }
    }

    const botMessage = createChatBotMessage(message, options);
    setState((prev) => {
      const cleanedMessages = clearTransientWidgets(prev.messages);

      return {
        ...prev,
        messages: [...(keepLoading ? cleanedMessages : removeLoading(cleanedMessages)), botMessage],
      }
    });
  };

  const notifyBusy = () => addBotMessage(BUSY_MESSAGE, { excludeFromHistory: true }, { keepLoading: true });

  // 로딩 표시 후 작업 실행, 실패 시 반드시 로딩을 치우고 에러 메시지 표시
  // retryMessage를 넘기면 실패 시 '다시 보내기' 버튼 표시
  const runWithLoading = async (task, { errorMessage, minLoadingTime = DB_MIN_LOADING_TIME, retryMessage } = {}) => {
    busyRef.current = true;
    showLoading(minLoadingTime);

    try {
      await task();
    } catch (error) {
      console.error(errorMessage, error);
      const options = { excludeFromHistory: true };
      if (retryMessage && !error.userMessage && error.status !== 401) {
        options.widget = 'retryMessage';
        options.payload = { message: retryMessage };
      }
      await addBotMessage(getErrorMessage(error, errorMessage), options);
    } finally {
      busyRef.current = false;
    }
  };

  // ===== 화면에 결과를 보여주는 작업들 (메뉴와 채팅에서 함께 사용) =====

  const recordExpenses = async (analysis) => {
    const now = new Date();
    const expenses = (analysis.expenses || []).filter(isValidExpenseItem).map((expense) => ({
      subject: expense.subject.trim(),
      category: expense.category.trim(),
      amount: toAmount(expense.amount),
      date: expenseDateFromString(expense.date, now),
    }));

    if (expenses.length === 0) {
      await addBotMessage(analysis.feedback);
      return;
    }

    const expenseIds = await addExpenses(expenses);
    const today = toLocalDateString(now);
    const datePrefix = (expense) => (toLocalDateString(expense.date) === today ? '' : `${formatMonthDay(expense.date)} `);

    let message;
    if (expenses.length === 1) {
      const [expense] = expenses;
      message = `${datePrefix(expense)}${expense.subject}(${expense.category}) 항목에 ${expense.amount.toLocaleString()}원을 지출하셨네요!\n${analysis.feedback}`;
    } else {
      const lines = expenses.map((expense) => `• ${datePrefix(expense)}${expense.subject}(${expense.category}) ${expense.amount.toLocaleString()}원`);
      const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      message = `${expenses.length}건의 지출을 기록했어요! (총 ${total.toLocaleString()}원)\n${lines.join('\n')}\n\n${analysis.feedback}`;
    }

    await addBotMessage(message, { widget: 'expenseUndo', payload: { expenseIds } });
  };

  const showSummary = async (period) => {
    const labels = SUMMARY_LABELS[period];
    const summary = summarizeExpenses(await fetchExpensesSince(getPeriodStart(period)));

    if (summary.total === 0) {
      await addBotMessage(labels.empty);
      return;
    }

    let message = `${labels.title}: ${summary.total.toLocaleString()}원\n\n` +
      `${labels.categoryIcon} 카테고리별 지출:\n${Object.entries(summary.byCategory).map(([category, amount]) => `• ${category}: ${amount.toLocaleString()}원`).join('\n')}`;

    if (period === 'today') {
      message += `\n\n📝 상세 지출:\n${Object.entries(summary.bySubject).map(([subject, amount]) => `• ${subject}: ${amount.toLocaleString()}원`).join('\n')}`;
    }

    await addBotMessage(message);
  };

  const showMonthDetail = async () => {
    const expenses = (await fetchExpensesSince(getPeriodStart('month')))
      .map((expense) => ({ ...expense, amount: toAmount(expense.amount) }))
      .filter((expense) => expense.amount !== null);

    if (expenses.length === 0) {
      await addBotMessage("이번 달에 입력된 지출 내역이 없습니다. 💸");
      return;
    }

    const expensesByDate = {};
    let totalAmount = 0;

    expenses.forEach((expense) => {
      const dateKey = formatMonthDay(expense.date);
      if (!expensesByDate[dateKey]) expensesByDate[dateKey] = [];
      expensesByDate[dateKey].push(expense);
      totalAmount += expense.amount;
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
    await addBotMessage(detailMessage, { widget: 'expenseManager' });
  };

  const showRecent = async () => {
    const recentExpense = await fetchRecentExpense();

    if (!recentExpense) {
      await addBotMessage("아직 입력된 지출 내역이 없습니다. 💸\n\n지출 내용을 자유롭게 입력해주세요!");
      return;
    }

    const formattedDate = recentExpense.date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    const formattedTime = recentExpense.date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true });
    const amount = toAmount(recentExpense.amount) ?? 0;

    await addBotMessage(`🕒 가장 최근 지출 정보\n\n📅 ${formattedDate} ${formattedTime}\n💰 ${recentExpense.subject}(${recentExpense.category}) ${amount.toLocaleString()}원`);
  };

  const showFeedback = async () => {
    const monthSummary = summarizeExpenses(await fetchExpensesSince(getPeriodStart('month')));
    if (monthSummary.total === 0) {
      await addBotMessage("아직 이번 달 지출 내역이 없습니다.");
      return;
    }

    const daysInMonth = new Date().getDate();
    const data = await postToBackend('/api/analyze-spending', {
      total: monthSummary.total,
      dailyAverage: monthSummary.total / daysInMonth,
      byCategory: monthSummary.byCategory,
      daysInMonth
    });

    await addBotMessage(formatFeedback(data.feedback));
  };

  // ===== 사용자 입력 처리 =====

  // 채팅 메시지: GPT가 의도를 파악해서 지출 기록 또는 조회 기능으로 연결
  const handleMessage = async (message) => {
    const text = message?.trim();

    if (!text) {
      addBotMessage("⚠️ 메시지를 입력해주세요!", { excludeFromHistory: true });
      return;
    }

    if (text.length > MAX_MESSAGE_LENGTH) {
      addBotMessage(`메시지가 너무 길어요. ${MAX_MESSAGE_LENGTH}자 이내로 입력해주세요.`, { excludeFromHistory: true });
      return;
    }

    if (busyRef.current) {
      notifyBusy();
      return;
    }

    // 이번 메시지 이전의 대화 (다시 보내기일 때는 화면에 이미 있는 같은 메시지 제외)
    const history = buildChatHistory(messages || []);
    if (history.length && history[history.length - 1].role === 'user' && history[history.length - 1].content === text) {
      history.pop();
    }

    await runWithLoading(async () => {
      const analysis = await postToBackend('/api/analyze-message', {
        message: text,
        history,
        today: toLocalDateString(new Date()),
      });

      switch (analysis.intent) {
        case 'expense': return recordExpenses(analysis);
        case 'summary': return showSummary(analysis.period || 'today');
        case 'detail': return showMonthDetail();
        case 'recent': return showRecent();
        case 'feedback': return showFeedback();
        default: return addBotMessage(analysis.feedback);
      }
    }, {
      errorMessage: "죄송합니다. 처리 중 문제가 발생했어요. 다시 시도해주세요.",
      minLoadingTime: AI_MIN_LOADING_TIME,
      retryMessage: text,
    });
  };

  // 메뉴 버튼: 사용자 메시지로 표시한 뒤 작업 실행
  const runMenuAction = async (label, task, errorMessage, minLoadingTime) => {
    if (busyRef.current) {
      notifyBusy();
      return;
    }

    addUserMessage(label);
    await runWithLoading(task, { errorMessage, minLoadingTime });
  };

  const summaryAction = (period) => () =>
    runMenuAction(SUMMARY_LABELS[period].request, () => showSummary(period), "지출 조회 중 오류가 발생했습니다. 다시 시도해주세요.");

  const handleTodayExpenses = summaryAction('today');
  const handleWeekExpenses = summaryAction('week');
  const handleMonthExpenses = summaryAction('month');

  const handleExpenseFeedback = () =>
    runMenuAction("🔍 지출 패턴 분석", showFeedback, "죄송합니다. 피드백을 생성하는 중 문제가 발생했어요. 다시 시도해주세요.", AI_MIN_LOADING_TIME);

  const handleMonthDetailExpenses = () =>
    runMenuAction("📋 이번 달 지출 상세", showMonthDetail, "지출 상세 조회 중 오류가 발생했습니다. 다시 시도해주세요.");

  const handleRecentExpense = () =>
    runMenuAction("🕒 최근 지출 알아보기", showRecent, "최근 지출 조회 중 오류가 발생했습니다. 다시 시도해주세요.");

  // 방금 입력한 지출(문서 ID)만 삭제
  const handleUndoExpense = async (expenseIds) => {
    if (busyRef.current) {
      notifyBusy();
      return;
    }

    await runWithLoading(async () => {
      if (!expenseIds?.length) throw new UserFacingError("취소할 지출 내역을 찾을 수 없습니다.");

      await deleteExpenses(expenseIds);
      await addBotMessage(
        expenseIds.length > 1 ? `${expenseIds.length}건의 지출 입력이 취소되었습니다.` : "지출 입력이 취소되었습니다."
      );
    }, { errorMessage: "지출 취소 중 오류가 발생했습니다. 다시 시도해주세요." });
  };

  const actions = {
    handleMessage, handleTodayExpenses, handleWeekExpenses, handleMonthExpenses,
    handleExpenseFeedback, handleMonthDetailExpenses, handleRecentExpense, handleUndoExpense,
  };

  // 메뉴 버튼 등 챗봇 외부에서 액션을 호출할 수 있도록 공유
  if (actionsRef) actionsRef.current = actions;

  return (
    <>
      {React.Children.map(children, (child) => {
        return React.cloneElement(child, { actions });
      })}
    </>
  );
};

export default ActionProvider;
