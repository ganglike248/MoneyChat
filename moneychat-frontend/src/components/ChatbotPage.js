import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Chatbot from 'react-chatbot-kit';
import 'react-chatbot-kit/build/main.css';
import { createConfig } from '../chatbot/config';
import MessageParser from '../chatbot/MessageParser';
import ActionProvider from '../chatbot/ActionProvider';
import { loadChatHistory, clearOtherUsersChatHistory } from '../chatbot/chatHistory';
import { getPeriodRange, getPeriodStart, summarizeExpenses, getBudgetStatus } from '../chatbot/expenseUtils';
import { fetchExpensesInRange, fetchBudget } from '../expenseRepository';
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import {
    Menu, X, WifiOff, ArrowDown, LogOut, Moon,
    CalendarDays, CalendarRange, Calendar, CalendarClock, History, ChartPie, Wallet, Lightbulb, Table2,
    MessageCircle, PanelsTopLeft, ChevronRight,
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { useTheme, toggleTheme } from '../theme';
import '../styles/appHeader.css';
import '../styles/chatbot.css';

const DEFAULT_PLACEHOLDER = '예) 커피 5000';
const BUSY_PLACEHOLDER = '답변을 기다리는 중이에요...';

// 이 거리(px) 안에 있으면 맨 아래를 보고 있는 것으로 판단
const BOTTOM_THRESHOLD = 80;

// 메뉴 항목 (actions: ActionProvider가 제공하는 기능)
// 결과를 챗봇이 채팅으로 알려주는 항목과, 별도 화면으로 이동하는 항목을 구역으로 나눠 표시
// (빠른 버튼은 자주 쓰는 채팅 기능의 바로가기)
const MENU_SECTIONS = [
    {
        id: 'chat',
        title: '채팅으로 답변',
        TitleIcon: MessageCircle,
        groups: [
            {
                label: '지출 조회',
                options: [
                    { text: "오늘 지출 확인", Icon: CalendarDays, run: (actions) => actions.handleTodayExpenses() },
                    { text: "이번 주 지출 확인", Icon: CalendarRange, run: (actions) => actions.handleWeekExpenses() },
                    { text: "이번 달 지출 확인", Icon: Calendar, run: (actions) => actions.handleMonthExpenses() },
                    { text: "지난달 지출 확인", Icon: CalendarClock, run: (actions) => actions.handleLastMonthExpenses() },
                    { text: "최근 지출 알아보기", Icon: History, run: (actions) => actions.handleRecentExpense() },
                ],
            },
            {
                label: '관리 · 분석',
                options: [
                    { text: "지출 패턴 분석", Icon: ChartPie, run: (actions) => actions.handleExpenseFeedback() },
                    { text: "예산 설정", Icon: Wallet, run: (actions) => actions.handleBudgetSetting() },
                ],
            },
            {
                label: '도움말',
                options: [
                    { text: "사용법 보기", Icon: Lightbulb, run: (actions) => actions.handleShowGuide() },
                ],
            },
        ],
    },
    {
        id: 'page',
        title: '페이지 이동',
        TitleIcon: PanelsTopLeft,
        groups: [
            {
                label: null,
                options: [
                    // page: 채팅이 아닌 별도 화면으로 이동하는 항목
                    { text: "지출 관리 표", Icon: Table2, page: '/expenses' },
                ],
            },
        ],
    },
];

// 입력창 위 빠른 버튼
// 오늘 / 이번 달 / 예산은 위쪽 요약 바를 누르면 되므로 여기에는 그 외의 자주 쓰는 기능만 둠
const QUICK_ACTIONS = [
    { text: "이번 주", run: (actions) => actions.handleWeekExpenses() },
    { text: "지난달", run: (actions) => actions.handleLastMonthExpenses() },
    { text: "최근", run: (actions) => actions.handleRecentExpense() },
    { text: "패턴 분석", run: (actions) => actions.handleExpenseFeedback() },
];

// 이번 달 지출이 없을 때 빠른 버튼 맨 앞에 보여주는 사용법 안내
// (예시 문장을 바로 보내면 실제 지출로 기록되므로, 기록 없이 사용법만 보여줌)
const GUIDE_ACTION = { text: "사용법", run: (actions) => actions.handleShowGuide() };

const ChatbotPage = () => {
    const navigate = useNavigate();
    const theme = useTheme();
    const [uid, setUid] = useState(null); // 로그인 확인 전에는 null
    const [email, setEmail] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [isOnline, setIsOnline] = useState(() => navigator.onLine);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const [logoutDialog, setLogoutDialog] = useState(null); // null: 닫힘, { busy, error }: 열림
    const [quickScroll, setQuickScroll] = useState({ left: false, right: false }); // 빠른 버튼이 양옆에 더 있는지
    const [stats, setStats] = useState(null); // 상단 요약 { today, month, budgetStatus }
    // 챗봇 라이브러리가 그리는 영역 (메뉴 버튼, 빠른 버튼, 스크롤 관리에 사용)
    const [chatAreas, setChatAreas] = useState({ inner: null, messages: null, input: null });

    const actionProviderRef = useRef(null);
    const chatWrapperRef = useRef(null);
    const menuButtonRef = useRef(null);
    const menuRef = useRef(null);
    const quickActionsRef = useRef(null);
    const isBusyRef = useRef(false);
    isBusyRef.current = isBusy;

    // 상단 요약(오늘/이번 달 지출, 예산) 갱신
    const refreshStats = useCallback(async () => {
        try {
            const [monthExpenses, budget] = await Promise.all([
                fetchExpensesInRange(getPeriodRange('month')),
                fetchBudget().catch(() => null),
            ]);
            const todayStart = getPeriodStart('today');
            const month = summarizeExpenses(monthExpenses).total;
            const today = summarizeExpenses(monthExpenses.filter((expense) => expense.date >= todayStart)).total;
            setStats({ today, month, budgetStatus: getBudgetStatus(budget, month) });
        } catch (error) {
            console.error('지출 현황 조회 실패:', error);
        }
    }, []);

    // ActionProvider 래퍼 - 메뉴에서 액션을 호출할 수 있도록 ref와 상태 알림 함수 전달
    const ActionProviderWrapper = useCallback(
        (props) => (
            <ActionProvider
                {...props}
                actionsRef={actionProviderRef}
                onBusyChange={setIsBusy}
                onDataChanged={refreshStats}
            />
        ),
        [refreshStats]
    );

    // 사용자별 config (이 기기에 저장된 대화가 있으면 이어서 보여줌)
    const chatbotConfig = useMemo(() => (uid ? createConfig(loadChatHistory(uid)) : null), [uid]);

    const runAction = useCallback((run) => {
        if (actionProviderRef.current) run(actionProviderRef.current);
    }, []);

    // 입력창 전송 전 검사: 비어 있거나 답변을 기다리는 중이면 전송하지 않음 (입력한 내용은 입력창에 그대로 남음)
    const validateInput = useCallback((input) => input.trim().length > 0 && !isBusyRef.current, []);

    // 이번 달 지출이 없으면 빠른 버튼 맨 앞에 사용법 버튼 표시
    const showGuide = stats?.month === 0;

    // 빠른 버튼이 화면 밖에 더 있으면 해당 쪽 가장자리를 흐리게 표시
    const updateQuickScroll = useCallback(() => {
        const el = quickActionsRef.current;
        if (!el) return;
        const next = {
            left: el.scrollLeft > 4,
            right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
        };
        setQuickScroll((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
    }, []);

    useEffect(() => {
        const el = quickActionsRef.current;
        if (!el) return;

        updateQuickScroll();
        const observer = new ResizeObserver(updateQuickScroll);
        observer.observe(el);
        return () => observer.disconnect();
    }, [chatAreas.inner, showGuide, updateQuickScroll]);

    // 로그인 확인 (새로고침 시 로그인 정보가 복원될 때까지 기다림)
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                // 이 기기에 남아 있는 다른 계정의 대화 기록은 불러오기 전에 삭제
                clearOtherUsersChatHistory(user.uid);
                setUid(user.uid);
                setEmail(user.email || '');
            } else {
                navigate('/', { replace: true });
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    // 로그인 후, 그리고 앱으로 다시 돌아왔을 때(날짜가 바뀌었을 수 있음) 상단 요약 갱신
    useEffect(() => {
        if (!uid) return;

        refreshStats();
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') refreshStats();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [uid, refreshStats]);

    // 온라인/오프라인 상태
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 챗봇 라이브러리가 그린 영역 찾기
    // 그리는 시점을 알 수 없으므로, 영역 안의 변화를 지켜보다가 생기거나 바뀌면 다시 찾음
    useEffect(() => {
        const wrapper = chatWrapperRef.current;
        if (!wrapper) return;

        const findChatAreas = () => {
            const next = {
                inner: wrapper.querySelector('.react-chatbot-kit-chat-inner-container'),
                messages: wrapper.querySelector('.react-chatbot-kit-chat-message-container'),
                input: wrapper.querySelector('.react-chatbot-kit-chat-input-container'),
            };
            setChatAreas((prev) => (
                prev.inner === next.inner && prev.messages === next.messages && prev.input === next.input ? prev : next
            ));
        };

        findChatAreas();
        const observer = new MutationObserver(findChatAreas);
        observer.observe(wrapper, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [uid]);

    // 스크롤 관리
    // - 처음 열면 최신 메시지로 이동
    // - 맨 아래를 보고 있으면 새 메시지를 따라 내려가고, 위쪽을 보고 있으면 '새 메시지' 버튼 표시
    // - 내가 보낸 메시지는 항상 맨 아래로 이동
    useEffect(() => {
        const container = chatAreas.messages;
        if (!container) return;

        // 새 메시지를 스크린 리더가 읽어주도록 설정
        container.setAttribute('role', 'log');
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-label', '대화 내용');

        let isAtBottom = true;
        const scrollToBottom = () => {
            container.scrollTop = container.scrollHeight;
            isAtBottom = true;
            setHasNewMessage(false);
        };

        scrollToBottom();
        const frame = requestAnimationFrame(scrollToBottom); // 레이아웃이 잡힌 뒤 한 번 더

        const handleScroll = () => {
            isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < BOTTOM_THRESHOLD;
            if (isAtBottom) setHasNewMessage(false);
        };
        container.addEventListener('scroll', handleScroll, { passive: true });

        const observer = new MutationObserver((records) => {
            const addedNodes = records
                .filter((record) => record.target === container)
                .flatMap((record) => [...record.addedNodes]);
            const sentByUser = addedNodes.some((node) => node.classList?.contains('react-chatbot-kit-user-chat-message-container'));

            if (isAtBottom || sentByUser) scrollToBottom();
            else if (addedNodes.length > 0) setHasNewMessage(true);
        });
        observer.observe(container, { childList: true, subtree: true, characterData: true });

        return () => {
            cancelAnimationFrame(frame);
            container.removeEventListener('scroll', handleScroll);
            observer.disconnect();
        };
    }, [chatAreas.messages]);

    // 처리 중일 때 입력창 안내 문구 변경
    useEffect(() => {
        const input = chatAreas.input?.querySelector('input');
        if (input) input.placeholder = isBusy ? BUSY_PLACEHOLDER : DEFAULT_PLACEHOLDER;
    }, [chatAreas.input, isBusy]);

    // 메뉴를 닫고 메뉴 버튼으로 포커스를 돌려줌
    const closeMenu = useCallback(() => {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
    }, []);

    // 메뉴가 열리면 첫 항목에 포커스, Esc로 닫기, Tab은 메뉴 안에서만 이동
    useEffect(() => {
        if (!isMenuOpen) return;

        const getFocusable = () => [...(menuRef.current?.querySelectorAll('button:not(:disabled)') || [])];
        (menuRef.current?.querySelector('.drawer-item:not(:disabled)') || getFocusable()[0])?.focus();

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeMenu();
                return;
            }
            if (e.key === 'Tab') {
                const focusable = getFocusable();
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isMenuOpen, closeMenu]);

    // 메뉴 항목 실행 (메뉴는 닫고 결과는 채팅에 표시)
    const handleMenuOptionClick = useCallback((run) => {
        closeMenu();
        runAction(run);
    }, [closeMenu, runAction]);

    // 별도 화면으로 이동 (답변을 기다리는 중에도 가능)
    const openPage = (path) => {
        setIsMenuOpen(false);
        navigate(path);
    };

    const scrollToLatest = () => {
        const container = chatAreas.messages;
        if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        setHasNewMessage(false);
    };

    // 로그아웃 확인 창 열기 (메뉴에서 호출)
    const openLogoutDialog = () => {
        setIsMenuOpen(false);
        setLogoutDialog({ busy: false, error: '' });
    };

    const closeLogoutDialog = useCallback(() => {
        setLogoutDialog(null);
        menuButtonRef.current?.focus();
    }, []);

    // 로그아웃 (대화 기록은 이 기기에 남기고, 다른 계정으로 로그인할 때 삭제)
    const handleLogout = useCallback(async () => {
        setLogoutDialog({ busy: true, error: '' });
        try {
            await signOut(auth);
            navigate('/', { replace: true });
        } catch (error) {
            console.error("로그아웃 실패: ", error);
            setLogoutDialog({ busy: false, error: '로그아웃하지 못했어요. 다시 시도해주세요.' });
        }
    }, [navigate]);

    if (!chatbotConfig) {
        return (
            <div className="chatbotPage_container">
                <p className="chatbotPage_loading">불러오는 중...</p>
            </div>
        );
    }

    const budgetStatus = stats?.budgetStatus;

    return (
        <div className="chatbotPage_container">
            <header className="appHeader appHeader--centered">
                <button
                    type="button"
                    ref={menuButtonRef}
                    className="appHeader_iconButton"
                    aria-label="메뉴 열기"
                    aria-haspopup="dialog"
                    aria-expanded={isMenuOpen}
                    aria-controls="app-drawer"
                    onClick={() => setIsMenuOpen(true)}
                >
                    <Menu size={24} aria-hidden="true" />
                </button>
                <h1 className="appHeader_title">
                    <img src="/avatar.png" alt="" className="appHeader_logo" />
                    MoneyChat
                </h1>
                {/* 제목이 정확히 가운데 오도록 메뉴 버튼과 같은 너비의 빈 칸 */}
                <span className="appHeader_spacer" aria-hidden="true" />
            </header>

            <main className="chatbotPage_body">
                {/* 오늘 / 이번 달 / 예산 요약 (각 칸을 누르면 해당 내용 보기) */}
                <div className="summaryBar" role="group" aria-label="지출 현황">
                    <button
                        type="button"
                        className="summaryBar_item"
                        onClick={() => runAction((actions) => actions.handleTodayExpenses())}
                        disabled={isBusy}
                    >
                        <span className="summaryBar_label">오늘</span>
                        {stats
                            ? <span className="summaryBar_value">{stats.today.toLocaleString()}원</span>
                            : <span className="summaryBar_skeleton" aria-label="불러오는 중" />}
                    </button>
                    <button
                        type="button"
                        className="summaryBar_item"
                        onClick={() => runAction((actions) => actions.handleMonthExpenses())}
                        disabled={isBusy}
                    >
                        <span className="summaryBar_label">이번 달</span>
                        {stats
                            ? <span className="summaryBar_value">{stats.month.toLocaleString()}원</span>
                            : <span className="summaryBar_skeleton" aria-label="불러오는 중" />}
                    </button>
                    <button
                        type="button"
                        className="summaryBar_item"
                        onClick={() => runAction((actions) => actions.handleBudgetSetting())}
                        disabled={isBusy}
                    >
                        <span className="summaryBar_label">{budgetStatus?.over ? '예산 초과' : '남은 예산'}</span>
                        {!stats && <span className="summaryBar_skeleton" aria-label="불러오는 중" />}
                        {stats && !budgetStatus && <span className="summaryBar_value summaryBar_value--action">설정하기</span>}
                        {budgetStatus && (
                            <>
                                <span className={`summaryBar_value${budgetStatus.over ? ' summaryBar_value--over' : ''}`}>
                                    {Math.abs(budgetStatus.remaining).toLocaleString()}원
                                </span>
                                <span
                                    className={`summaryBar_meter${budgetStatus.over ? ' summaryBar_meter--over' : budgetStatus.percent >= 80 ? ' summaryBar_meter--warn' : ''}`}
                                    role="progressbar"
                                    aria-label="예산 사용률"
                                    aria-valuenow={Math.min(budgetStatus.percent, 100)}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                >
                                    <span style={{ width: `${Math.min(budgetStatus.percent, 100)}%` }} />
                                </span>
                            </>
                        )}
                    </button>
                </div>

                {!isOnline && (
                    <div className="chatbotPage_offline" role="status">
                        <WifiOff size={16} aria-hidden="true" />
                        오프라인 상태예요. 인터넷에 연결되면 다시 시도해주세요.
                    </div>
                )}

                <div
                    className={`chatbotPage_chatWrapper${isBusy ? ' chatbotPage_chatWrapper--busy' : ''}`}
                    ref={chatWrapperRef}
                >
                    <Chatbot
                        key={uid}
                        config={chatbotConfig}
                        messageParser={MessageParser}
                        actionProvider={ActionProviderWrapper}
                        headerText='MoneyChat'
                        placeholderText={DEFAULT_PLACEHOLDER}
                        validator={validateInput}
                        disableScrollToBottom
                    />

                    {/* 입력창 위 빠른 버튼 (CSS order로 메시지 영역과 입력창 사이에 배치) */}
                    {chatAreas.inner && createPortal(
                        <div
                            ref={quickActionsRef}
                            className={`quick-actions${quickScroll.left ? ' quick-actions--fade-left' : ''}${quickScroll.right ? ' quick-actions--fade-right' : ''}`}
                            role="toolbar"
                            aria-label="빠른 기능"
                            onScroll={updateQuickScroll}
                        >
                            {showGuide && (
                                <button
                                    type="button"
                                    className="quick-action quick-action-example"
                                    onClick={() => runAction(GUIDE_ACTION.run)}
                                    disabled={isBusy}
                                >
                                    <Lightbulb size={14} aria-hidden="true" />
                                {GUIDE_ACTION.text}
                                </button>
                            )}
                            {QUICK_ACTIONS.map((action) => (
                                <button
                                    key={action.text}
                                    type="button"
                                    className="quick-action"
                                    onClick={() => runAction(action.run)}
                                    disabled={isBusy}
                                >
                                    {action.text}
                                </button>
                            ))}
                        </div>,
                        chatAreas.inner
                    )}

                    {/* 위쪽을 보고 있을 때 새 메시지가 오면 표시 */}
                    {hasNewMessage && (
                        <button type="button" className="new-message-button" onClick={scrollToLatest}>
                            <ArrowDown size={14} aria-hidden="true" />
                            새 메시지
                        </button>
                    )}

                </div>
            </main>

            {/* 왼쪽에서 열리는 슬라이드 메뉴 (닫혀 있을 때는 CSS로 숨겨 포커스되지 않음) */}
            <div className={`drawer-backdrop${isMenuOpen ? ' is-open' : ''}`} onClick={closeMenu} aria-hidden="true" />
            <aside
                id="app-drawer"
                ref={menuRef}
                className={`drawer${isMenuOpen ? ' is-open' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label="머니챗 메뉴"
            >
                <div className="drawer-header">
                    <img src="/avatar.png" alt="" />
                    <div className="drawer-profile">
                        <strong>MoneyChat</strong>
                        {email && <span>{email}</span>}
                    </div>
                    <button type="button" className="drawer-close" onClick={closeMenu} aria-label="메뉴 닫기">
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                <nav className="drawer-body" aria-label="기능">
                    {MENU_SECTIONS.map((section) => (
                        <section
                            key={section.id}
                            className={`drawer-section drawer-section--${section.id}`}
                            aria-labelledby={`drawer-section-${section.id}`}
                        >
                            <div className="drawer-section-header">
                                <h2 id={`drawer-section-${section.id}`} className="drawer-section-title">
                                    <section.TitleIcon size={14} aria-hidden="true" />
                                    {section.title}
                                </h2>
                            </div>

                            {section.groups.map((group) => (
                                <div key={group.label || section.id} className="drawer-group" role="group" aria-label={group.label || section.title}>
                                    {group.label && <h3 className="drawer-group-label">{group.label}</h3>}
                                    {group.options.map((option) => (
                                        <button
                                            key={option.text}
                                            type="button"
                                            className="drawer-item"
                                            onClick={() => (option.page ? openPage(option.page) : handleMenuOptionClick(option.run))}
                                            disabled={isBusy && !option.page}
                                        >
                                            <option.Icon size={20} aria-hidden="true" />
                                            {option.text}
                                            {option.page && <ChevronRight className="drawer-item-trailing" size={18} aria-hidden="true" />}
                                        </button>
                                    ))}
                                </div>
                            ))}

                            {/* 채팅 기능은 답변을 기다리는 동안 쓸 수 없음 (페이지 이동은 가능) */}
                            {section.id === 'chat' && isBusy && (
                                <p className="drawer-busy-note">답변을 기다리는 중에는 쓸 수 없어요.</p>
                            )}
                        </section>
                    ))}
                </nav>

                {/* 화면 설정과 로그아웃은 답변을 기다리는 중에도 가능 */}
                <div className="drawer-footer">
                    <button
                        type="button"
                        className="drawer-item"
                        role="switch"
                        aria-checked={theme === 'dark'}
                        onClick={toggleTheme}
                    >
                        <Moon size={20} aria-hidden="true" />
                        다크 모드
                        <span className="drawer-switch" aria-hidden="true" />
                    </button>
                    <button type="button" className="drawer-item drawer-item-logout" onClick={openLogoutDialog}>
                        <LogOut size={20} aria-hidden="true" />
                        로그아웃
                    </button>
                </div>
            </aside>

            {logoutDialog && (
                <ConfirmDialog
                    title="로그아웃 하시겠어요?"
                    message={"대화 기록은 기기당 한 계정만 저장됩니다.\n다른 계정으로 로그인 시, 이전 계정에 대한 기록은 지워집니다."}
                    confirmText={logoutDialog.busy ? '로그아웃 중...' : '로그아웃'}
                    danger
                    busy={logoutDialog.busy}
                    error={logoutDialog.error}
                    onConfirm={handleLogout}
                    onCancel={closeLogoutDialog}
                />
            )}
        </div>
    );
};

export default ChatbotPage;
