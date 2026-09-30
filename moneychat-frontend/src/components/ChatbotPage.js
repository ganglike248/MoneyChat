import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Chatbot from 'react-chatbot-kit';
import 'react-chatbot-kit/build/main.css';
import { createConfig } from '../chatbot/config';
import MessageParser from '../chatbot/MessageParser';
import ActionProvider from '../chatbot/ActionProvider';
import { loadChatHistory, clearChatHistory } from '../chatbot/chatHistory';
import { getPeriodRange, getPeriodStart, summarizeExpenses, getBudgetStatus } from '../chatbot/expenseUtils';
import { fetchExpensesInRange, fetchBudget } from '../expenseRepository';
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import '../styles/chatbot.css';

const DEFAULT_PLACEHOLDER = '예) 점심 8000';
const BUSY_PLACEHOLDER = '답변을 기다리는 중이에요...';

// 이 거리(px) 안에 있으면 맨 아래를 보고 있는 것으로 판단
const BOTTOM_THRESHOLD = 80;

// 메뉴 항목 (actions: ActionProvider가 제공하는 기능)
const MENU_OPTIONS = [
    { text: "📊 오늘 지출 확인", run: (actions) => actions.handleTodayExpenses() },
    { text: "📅 이번 주 지출 확인", run: (actions) => actions.handleWeekExpenses() },
    { text: "📈 이번 달 지출 확인", run: (actions) => actions.handleMonthExpenses() },
    { text: "🗓 지난달 지출 확인", run: (actions) => actions.handleLastMonthExpenses() },
    { text: "📋 지출 상세 · 수정", run: (actions) => actions.handleMonthDetailExpenses() },
    { text: "🕒 최근 지출 알아보기", run: (actions) => actions.handleRecentExpense() },
    { text: "🔍 지출 패턴 분석", run: (actions) => actions.handleExpenseFeedback() },
    { text: "💰 예산 설정", run: (actions) => actions.handleBudgetSetting() },
];

// 입력창 위 빠른 버튼
const QUICK_ACTIONS = [
    { text: "📊 오늘", run: (actions) => actions.handleTodayExpenses() },
    { text: "📅 이번 주", run: (actions) => actions.handleWeekExpenses() },
    { text: "📈 이번 달", run: (actions) => actions.handleMonthExpenses() },
    { text: "📋 상세·수정", run: (actions) => actions.handleMonthDetailExpenses() },
    { text: "🕒 최근", run: (actions) => actions.handleRecentExpense() },
    { text: "💰 예산", run: (actions) => actions.handleBudgetSetting() },
];

// 이번 달 지출이 없을 때 보여주는 입력 예시 (누르면 그대로 전송)
const EXAMPLE_MESSAGES = ['점심 8000', '어제 택시 12000 커피 4500', '이번 주 얼마 썼어?'];

const ChatbotPage = () => {
    const navigate = useNavigate();
    const [uid, setUid] = useState(null); // 로그인 확인 전에는 null
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [isOnline, setIsOnline] = useState(() => navigator.onLine);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const [stats, setStats] = useState(null); // 상단 요약 { today, month, budgetStatus }
    // 챗봇 라이브러리가 그리는 영역 (메뉴 버튼, 빠른 버튼, 스크롤 관리에 사용)
    const [chatAreas, setChatAreas] = useState({ inner: null, messages: null, input: null });

    const actionProviderRef = useRef(null);
    const chatWrapperRef = useRef(null);
    const menuButtonRef = useRef(null);
    const menuRef = useRef(null);

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

    // 로그인 확인 (새로고침 시 로그인 정보가 복원될 때까지 기다림)
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                setUid(user.uid);
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

    // 메뉴가 열리면 첫 항목에 포커스, 바깥을 누르거나 Esc를 누르면 닫기, 방향키로 항목 이동
    useEffect(() => {
        if (!isMenuOpen) return;

        const getOptions = () => [...(menuRef.current?.querySelectorAll('.menu-option-button') || [])];
        getOptions()[0]?.focus();

        const closeMenu = () => {
            setIsMenuOpen(false);
            menuButtonRef.current?.focus();
        };

        const handlePointerDown = (e) => {
            if (e.target.closest('.menu-dropdown') || e.target.closest('.custom-menu-button')) return;
            setIsMenuOpen(false);
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeMenu();
                return;
            }

            const options = getOptions();
            const index = options.indexOf(document.activeElement);
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const step = e.key === 'ArrowDown' ? 1 : -1;
                options[(index + step + options.length) % options.length]?.focus();
            } else if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                options[e.key === 'Home' ? 0 : options.length - 1]?.focus();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMenuOpen]);

    // 메뉴 옵션 클릭 핸들러
    const handleMenuOptionClick = useCallback((run) => {
        runAction(run);
        setIsMenuOpen(false);
    }, [runAction]);

    const scrollToLatest = () => {
        const container = chatAreas.messages;
        if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        setHasNewMessage(false);
    };

    // 로그아웃 (공용 기기를 고려해 이 기기의 대화 기록도 삭제)
    const handleLogout = useCallback(async () => {
        if (!window.confirm("로그아웃하면 이 기기에 저장된 대화 기록이 지워져요.\n로그아웃 하시겠어요?")) return;

        try {
            if (uid) clearChatHistory(uid);
            await signOut(auth);
            navigate('/', { replace: true });
        } catch (error) {
            console.error("로그아웃 실패: ", error);
            alert("로그아웃하지 못했어요. 다시 시도해주세요.");
        }
    }, [navigate, uid]);

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
            <div className='chatbotPage_headerDiv'>
                <div className="chatbotPage_titleGroup">
                    <img src="/logo.png" alt="" className="chatbotPage_logo" />
                    {/* 오늘/이번 달 지출 요약 (누르면 이번 달 요약 보기) */}
                    <button
                        type="button"
                        className="chatbotPage_stats"
                        onClick={() => runAction((actions) => actions.handleMonthExpenses())}
                        aria-label="이번 달 지출 요약 보기"
                    >
                        {stats ? (
                            <>
                                <span className="chatbotPage_statsMain">오늘 <strong>{stats.today.toLocaleString()}원</strong></span>
                                <span className={`chatbotPage_statsSub${budgetStatus?.over ? ' chatbotPage_statsOver' : ''}`}>
                                    이번 달 {stats.month.toLocaleString()}원
                                    {budgetStatus && (budgetStatus.over
                                        ? ` · 예산 ${(-budgetStatus.remaining).toLocaleString()}원 초과`
                                        : ` · 예산 ${budgetStatus.percent}% 사용`)}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="chatbotPage_statsMain"><strong>머니챗</strong></span>
                                <span className="chatbotPage_statsSub">지출 현황을 불러오는 중...</span>
                            </>
                        )}
                    </button>
                </div>
                <button className="chatbotPage_logoutBtn" onClick={handleLogout}>
                    로그아웃
                </button>
            </div>

            {!isOnline && (
                <div className="chatbotPage_offline" role="status">
                    📡 오프라인 상태예요. 인터넷에 연결되면 다시 시도해주세요.
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
                    disableScrollToBottom
                />

                {/* 입력창 왼쪽의 메뉴 버튼 (CSS order로 입력창 앞에 배치) */}
                {chatAreas.input && createPortal(
                    <button
                        type="button"
                        ref={menuButtonRef}
                        className="custom-menu-button"
                        title="메뉴 열기"
                        aria-label="메뉴 열기"
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        onClick={() => setIsMenuOpen((prev) => !prev)}
                    >
                        ☰
                    </button>,
                    chatAreas.input
                )}

                {/* 입력창 위 빠른 버튼 (CSS order로 메시지 영역과 입력창 사이에 배치) */}
                {chatAreas.inner && createPortal(
                    <div className="quick-actions" role="toolbar" aria-label="빠른 기능">
                        {stats?.month === 0 && EXAMPLE_MESSAGES.map((text) => (
                            <button
                                key={text}
                                type="button"
                                className="quick-action quick-action-example"
                                onClick={() => runAction((actions) => actions.sendUserMessage(text))}
                            >
                                💬 {text}
                            </button>
                        ))}
                        {QUICK_ACTIONS.map((action) => (
                            <button
                                key={action.text}
                                type="button"
                                className="quick-action"
                                onClick={() => runAction(action.run)}
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
                        ↓ 새 메시지
                    </button>
                )}

                {/* 메뉴 드롭다운 */}
                {isMenuOpen && (
                    <div className="menu-dropdown" ref={menuRef}>
                        <div className="menu-header">
                            <span>💰 머니챗 메뉴</span>
                            <button
                                className="menu-close-button"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    menuButtonRef.current?.focus();
                                }}
                                aria-label="메뉴 닫기"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="menu-options" role="menu">
                            {MENU_OPTIONS.map((option) => (
                                <button
                                    key={option.text}
                                    role="menuitem"
                                    onClick={() => handleMenuOptionClick(option.run)}
                                    className="menu-option-button"
                                >
                                    {option.text}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatbotPage;
