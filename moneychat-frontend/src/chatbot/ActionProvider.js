import React, { useRef, useEffect } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { postToBackend } from '../api';
import {
  UserFacingError, LOGIN_REQUIRED_MESSAGE,
  addExpenses, deleteExpenses, fetchExpensesInRange, fetchRecentExpense, fetchBudget, saveBudget,
} from '../expenseRepository';
import {
  getPeriodRange, summarizeExpenses, isValidExpenseItem, toAmount, formatFeedback,
  toLocalDateString, expenseDateFromString, formatMonthDay, formatMonthLabel, buildChatHistory,
  getBudgetStatus, formatBudgetLine, toCategoryRows,
} from './expenseUtils';
import { saveChatHistory } from './chatHistory';
import { toChatMessageFields } from '../components/MessageContent';
import { withDateDividers } from './messageFormat';

const LOADING_ID = 'loading-msg';

// 백엔드와 동일한 메시지 길이 제한
const MAX_MESSAGE_LENGTH = 500;

// 새 메시지가 오면 사라지는 일회성 위젯
const TRANSIENT_WIDGETS = ['expenseUndo', 'retryMessage', 'budgetForm'];

const RATE_LIMIT_MESSAGE = "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";
const TIMEOUT_MESSAGE = "서버 응답이 너무 늦어요. 잠시 후 다시 시도해주세요.";
const NETWORK_MESSAGE = "네트워크 연결을 확인해주세요.";
const BUSY_MESSAGE = "이전 요청을 처리하고 있어요. 잠시만 기다려주세요!";

// 기간별 요약 문구 (지난달은 달 이름이 들어가므로 함수로 생성)
const getSummaryLabels = (period, range) => {
  const monthLabel = formatMonthLabel(range.start);
  return {
    today: { request: "📊 오늘 지출 확인", empty: "📊 오늘은 아직 지출 내역이 없네요!", title: "📊 오늘 지출" },
    week: { request: "📅 이번 주 지출 확인", empty: "📅 이번 주는 아직 지출 내역이 없네요!", title: "📅 이번 주 지출" },
    month: { request: "📈 이번 달 지출 확인", empty: "📈 이번 달은 아직 지출 내역이 없네요!", title: `📈 이번 달(${monthLabel}) 지출` },
    lastMonth: { request: "🗓 지난달 지출 확인", empty: `🗓 ${monthLabel}에는 지출 내역이 없어요.`, title: `🗓 지난달(${monthLabel}) 지출` },
  }[period];
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

// 예산 조회 실패(권한 등)가 다른 기능을 막지 않도록 실패하면 예산 없음으로 처리
const fetchBudgetSafely = async () => {
  try {
    return await fetchBudget();
  } catch (error) {
    console.warn('예산 조회 실패:', error);
    return null;
  }
};

// 이번 달 예산 사용 현황 (예산이 없으면 null)
const fetchMonthBudgetStatus = async () => {
  const budget = await fetchBudgetSafely();
  if (!budget) return null;
  const monthTotal = summarizeExpenses(await fetchExpensesInRange(getPeriodRange('month'))).total;
  return getBudgetStatus(budget, monthTotal);
};

// onBusyChange: 요청 처리 중 여부가 바뀔 때 호출 (입력창 표시용)
// onDataChanged: 지출/예산이 바뀌었을 때 호출 (상단 금액 갱신용)
const ActionProvider = ({ createChatBotMessage, setState, state, children, actionsRef, onBusyChange, onDataChanged }) => {

  const loadingTimerRef = useRef(null);
  const busyRef = useRef(false); // 요청 처리 중 중복 요청 방지

  const uid = auth.currentUser?.uid;
  const messages = state?.messages;

  // 봇 메시지 생성
  // - 연속된 봇 메시지에도 항상 프로필 표시
  // - 전송 시간 표시 (options.createdAt에 null을 넘기면 시간 없이 표시)
  // - options.card가 있으면 요약 카드로 표시
  const createBotMessage = (text, options = {}) => {
    const createdAt = 'createdAt' in options ? options.createdAt : Date.now();
    const { message, ...fields } = toChatMessageFields(text, createdAt, { formatted: true, card: options.card });
    return createChatBotMessage(message, { withAvatar: true, ...options, ...fields });
  };

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    };
  }, []);

  // 입력창으로 보낸 사용자 메시지는 라이브러리가 텍스트로만 추가하므로, 전송 시간을 붙여서 표시용으로 변환
  useEffect(() => {
    if (!messages?.some((msg) => msg.type === 'user' && typeof msg.message === 'string')) return;

    const sentAt = Date.now();
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((msg) => (
        msg.type === 'user' && typeof msg.message === 'string'
          ? { ...msg, ...toChatMessageFields(msg.message, sentAt, { formatted: false }) }
          : msg
      )),
    }));
  }, [messages, setState]);

  // 날짜가 바뀌는 곳에 구분 바 추가 (구분 바 위치가 달라졌을 때만 갱신)
  useEffect(() => {
    if (!messages) return;

    const idsOf = (list) => list.map((msg) => msg.id).join('|');
    if (idsOf(withDateDividers(messages)) === idsOf(messages)) return;

    setState((prev) => ({ ...prev, messages: withDateDividers(prev.messages) }));
  }, [messages, setState]);

  // 새로고침해도 대화가 남도록 이 기기에 저장
  useEffect(() => {
    if (uid && messages) saveChatHistory(uid, messages, LOADING_ID);
  }, [uid, messages]);

  const notifyDataChanged = () => {
    if (onDataChanged) onDataChanged();
  };

  const setBusy = (busy) => {
    busyRef.current = busy;
    if (onBusyChange) onBusyChange(busy);
  };

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
      ...toChatMessageFields(message, Date.now(), { formatted: false }),
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

  const showLoading = () => {
    stopLoadingTimer(); // 이전 로딩이 남아 있으면 정리

    const initialMsg = createBotMessage(getLoadingText(0), { id: LOADING_ID, excludeFromHistory: true, createdAt: null });

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
           newMessages[loadingMsgIndex] = {
             ...newMessages[loadingMsgIndex],
             ...toChatMessageFields(getLoadingText(step), null, { formatted: true }),
           };
        } else {
           stopLoadingTimer();
        }
        return { ...prev, messages: newMessages };
      });
    }, 1000);
  };

  const removeLoading = (messageList) => {
    stopLoadingTimer();
    return messageList.filter((msg) => msg.id !== LOADING_ID);
  };

  // 답변이 도착하면 로딩 메시지를 지우고 바로 표시
  // (라이브러리 기본 동작인 0.75초 '...' 입력 중 애니메이션도 건너뜀)
  // keepLoading: 로딩 중에 안내만 끼워 넣을 때 사용 (로딩 메시지 유지)
  const addBotMessage = async (message, options = {}, { keepLoading = false } = {}) => {
    const botMessage = { ...createBotMessage(message, options), loading: false };
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
  const runWithLoading = async (task, { errorMessage, retryMessage } = {}) => {
    setBusy(true);
    showLoading();

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
      setBusy(false);
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
    notifyDataChanged();

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

    // 예산을 정해 두었다면 남은 금액도 함께 안내 (실패해도 기록 결과는 보여줌)
    try {
      const budgetStatus = await fetchMonthBudgetStatus();
      if (budgetStatus) message += `\n\n${formatBudgetLine(budgetStatus)}`;
    } catch (error) {
      console.warn('예산 현황 조회 실패:', error);
    }

    await addBotMessage(message, { widget: 'expenseUndo', payload: { expenseIds } });
  };

  const showSummary = async (period) => {
    const range = getPeriodRange(period);
    const labels = getSummaryLabels(period, range);
    const summary = summarizeExpenses(await fetchExpensesInRange(range));

    if (summary.total === 0) {
      await addBotMessage(labels.empty);
      return;
    }

    const budgetStatus = period === 'month' ? getBudgetStatus(await fetchBudgetSafely(), summary.total) : null;

    // 화면에는 카드로 표시하고, 텍스트는 대화 맥락(GPT)과 기록용으로 사용
    let text = `${labels.title}: ${summary.total.toLocaleString()}원\n\n` +
      `카테고리별 지출:\n${Object.entries(summary.byCategory).map(([category, amount]) => `• ${category}: ${amount.toLocaleString()}원`).join('\n')}`;
    if (budgetStatus) text += `\n\n${formatBudgetLine(budgetStatus)}`;

    const details = period === 'today'
      ? Object.entries(summary.bySubject).sort((a, b) => b[1] - a[1]).map(([label, amount]) => ({ label, amount }))
      : [];
    if (details.length) text += `\n\n상세 지출:\n${details.map((detail) => `• ${detail.label}: ${detail.amount.toLocaleString()}원`).join('\n')}`;

    await addBotMessage(text, {
      card: {
        title: labels.title,
        total: summary.total,
        rows: toCategoryRows(summary.byCategory, summary.total),
        details,
        budget: budgetStatus,
      },
    });
  };

  const showDetail = async (period = 'month') => {
    const range = getPeriodRange(period);
    const monthLabel = formatMonthLabel(range.start);
    const expenses = (await fetchExpensesInRange(range))
      .map((expense) => ({ ...expense, amount: toAmount(expense.amount) }))
      .filter((expense) => expense.amount !== null);

    const managerPayload = { year: range.start.getFullYear(), month: range.start.getMonth() };

    if (expenses.length === 0) {
      await addBotMessage(`${monthLabel}에 입력된 지출 내역이 없습니다. 💸`, { widget: 'expenseManager', payload: managerPayload });
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

    let detailMessage = `📋 ${monthLabel}의 지출 상세 정보\n\n`;
    Object.keys(expensesByDate).forEach(date => {
      detailMessage += `📅 ${date}\n`;
      expensesByDate[date].forEach(exp => {
        detailMessage += `  • ${exp.category} / ${exp.subject} / ${exp.amount.toLocaleString()}원\n`;
      });
      detailMessage += '\n';
    });

    detailMessage += `💰 총 ${totalAmount.toLocaleString()}원`;
    await addBotMessage(detailMessage, { widget: 'expenseManager', payload: managerPayload });
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
    const monthSummary = summarizeExpenses(await fetchExpensesInRange(getPeriodRange('month')));
    if (monthSummary.total === 0) {
      await addBotMessage("아직 이번 달 지출 내역이 없습니다.");
      return;
    }

    const daysInMonth = new Date().getDate();
    const data = await postToBackend('/api/analyze-spending', {
      total: monthSummary.total,
      dailyAverage: monthSummary.total / daysInMonth,
      byCategory: monthSummary.byCategory,
      daysInMonth,
      budget: await fetchBudgetSafely(),
    });

    await addBotMessage(formatFeedback(data.feedback));
  };

  // 예산 저장 (0이면 해제)
  const applyBudget = async (budget) => {
    await saveBudget(budget > 0 ? budget : null);
    notifyDataChanged();

    if (!(budget > 0)) {
      await addBotMessage("예산을 해제했어요. 필요할 때 언제든 다시 정할 수 있어요!");
      return;
    }

    const monthTotal = summarizeExpenses(await fetchExpensesInRange(getPeriodRange('month'))).total;
    await addBotMessage(
      `💰 한 달 예산을 ${budget.toLocaleString()}원으로 정했어요!\n지출을 기록할 때마다 남은 금액을 알려드릴게요.\n\n` +
      formatBudgetLine(getBudgetStatus(budget, monthTotal))
    );
  };

  const showBudgetForm = async () => {
    const budget = await fetchBudget();
    await addBotMessage(
      budget
        ? `현재 한 달 예산은 ${budget.toLocaleString()}원이에요.\n바꿀 금액을 입력해주세요.`
        : "한 달 예산을 정하면 지출을 기록할 때마다 남은 금액을 알려드려요.\n금액을 입력해주세요.",
      { widget: 'budgetForm', payload: { budget } }
    );
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
        case 'detail': return showDetail(analysis.period || 'month');
        case 'recent': return showRecent();
        case 'feedback': return showFeedback();
        case 'budget': return applyBudget(analysis.budget);
        default: return addBotMessage(analysis.feedback);
      }
    }, {
      errorMessage: "죄송합니다. 처리 중 문제가 발생했어요. 다시 시도해주세요.",
      retryMessage: text,
    });
  };

  // 빠른 입력 버튼: 사용자 메시지로 표시한 뒤 채팅처럼 처리
  const sendUserMessage = async (text) => {
    if (busyRef.current) {
      notifyBusy();
      return;
    }

    addUserMessage(text);
    await handleMessage(text);
  };

  // 메뉴 버튼: 사용자 메시지로 표시한 뒤 작업 실행
  const runMenuAction = async (label, task, errorMessage) => {
    if (busyRef.current) {
      notifyBusy();
      return;
    }

    addUserMessage(label);
    await runWithLoading(task, { errorMessage });
  };

  const summaryAction = (period) => () =>
    runMenuAction(getSummaryLabels(period, getPeriodRange(period)).request, () => showSummary(period), "지출 조회 중 오류가 발생했습니다. 다시 시도해주세요.");

  const handleTodayExpenses = summaryAction('today');
  const handleWeekExpenses = summaryAction('week');
  const handleMonthExpenses = summaryAction('month');
  const handleLastMonthExpenses = summaryAction('lastMonth');

  const handleExpenseFeedback = () =>
    runMenuAction("🔍 지출 패턴 분석", showFeedback, "죄송합니다. 피드백을 생성하는 중 문제가 발생했어요. 다시 시도해주세요.");

  const handleMonthDetailExpenses = () =>
    runMenuAction("📋 이번 달 지출 상세", () => showDetail('month'), "지출 상세 조회 중 오류가 발생했습니다. 다시 시도해주세요.");

  const handleRecentExpense = () =>
    runMenuAction("🕒 최근 지출 알아보기", showRecent, "최근 지출 조회 중 오류가 발생했습니다. 다시 시도해주세요.");

  const handleBudgetSetting = () =>
    runMenuAction("💰 예산 설정", showBudgetForm, "예산 정보를 불러오지 못했어요. 다시 시도해주세요.");

  // 예산 설정 위젯에서 저장/해제
  const handleSetBudget = async (budget) => {
    if (busyRef.current) {
      notifyBusy();
      return;
    }

    await runWithLoading(() => applyBudget(budget), { errorMessage: "예산을 저장하지 못했어요. 다시 시도해주세요." });
  };

  // 방금 입력한 지출(문서 ID)만 삭제
  const handleUndoExpense = async (expenseIds) => {
    if (busyRef.current) {
      notifyBusy();
      return;
    }

    await runWithLoading(async () => {
      if (!expenseIds?.length) throw new UserFacingError("취소할 지출 내역을 찾을 수 없습니다.");

      await deleteExpenses(expenseIds);
      notifyDataChanged();
      await addBotMessage(
        expenseIds.length > 1 ? `${expenseIds.length}건의 지출 입력이 취소되었습니다.` : "지출 입력이 취소되었습니다."
      );
    }, { errorMessage: "지출 취소 중 오류가 발생했습니다. 다시 시도해주세요." });
  };

  const actions = {
    handleMessage, sendUserMessage,
    handleTodayExpenses, handleWeekExpenses, handleMonthExpenses, handleLastMonthExpenses,
    handleExpenseFeedback, handleMonthDetailExpenses, handleRecentExpense,
    handleBudgetSetting, handleSetBudget, handleUndoExpense, notifyDataChanged,
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
