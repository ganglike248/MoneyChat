import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Chatbot from 'react-chatbot-kit';
import 'react-chatbot-kit/build/main.css';
import { createConfig } from '../chatbot/config';
import MessageParser from '../chatbot/MessageParser';
import ActionProvider from '../chatbot/ActionProvider';
import { loadChatHistory, clearChatHistory } from '../chatbot/chatHistory';
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import '../styles/chatbot.css';

const ChatbotPage = () => {
    const navigate = useNavigate();
    const [uid, setUid] = useState(null); // 로그인 확인 전에는 null
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const actionProviderRef = useRef(null);

    // ActionProvider 래퍼 - 메뉴에서 액션을 호출할 수 있도록 ref 전달
    const ActionProviderWrapper = useCallback(
        (props) => <ActionProvider {...props} actionsRef={actionProviderRef} />,
        []
    );

    // 사용자별 config (이 기기에 저장된 대화가 있으면 이어서 보여줌)
    const chatbotConfig = useMemo(() => (uid ? createConfig(loadChatHistory(uid)) : null), [uid]);

    // 메뉴 옵션들
    const menuOptions = [
        {
            text: "📊 오늘 지출 확인",
            handler: () => actionProviderRef.current?.handleTodayExpenses(),
            id: 1
        },
        {
            text: "📅 이번 주 지출 확인",
            handler: () => actionProviderRef.current?.handleWeekExpenses(),
            id: 2
        },
        {
            text: "📈 이번 달 지출 확인",
            handler: () => actionProviderRef.current?.handleMonthExpenses(),
            id: 3
        },
        {
            text: "📋 이번 달 지출 상세 · 수정",
            handler: () => actionProviderRef.current?.handleMonthDetailExpenses(),
            id: 4
        },
        {
            text: "🕒 최근 지출 알아보기",
            handler: () => actionProviderRef.current?.handleRecentExpense(),
            id: 5
        },
        {
            text: "🔍 지출 패턴 분석",
            handler: () => actionProviderRef.current?.handleExpenseFeedback(),
            id: 6
        },
    ];

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

    // 챗봇이 표시된 후 입력창에 메뉴 버튼 추가
    useEffect(() => {
        if (!uid) return;

        const addMenuButton = () => {
            const inputContainer = document.querySelector('.react-chatbot-kit-chat-input-container');
            if (inputContainer && !document.querySelector('.custom-menu-button')) {
                const inputForm = inputContainer.querySelector('.react-chatbot-kit-chat-input-form');

                if (inputForm) {
                    const menuButton = document.createElement('button');
                    menuButton.className = 'custom-menu-button';
                    menuButton.textContent = '☰';
                    menuButton.title = '메뉴 열기';
                    menuButton.setAttribute('aria-label', '메뉴 열기');
                    menuButton.type = 'button';

                    const handleClick = (e) => {
                        e.preventDefault();
                        e.stopPropagation(); // 이벤트 전파 중지 추가
                        setIsMenuOpen(prev => !prev);
                    };

                    menuButton.addEventListener('click', handleClick);

                    inputContainer.insertBefore(menuButton, inputForm);

                    return () => {
                        menuButton.removeEventListener('click', handleClick);
                        menuButton.remove();
                    };
                }
            }
        };

        // 약간의 딜레이를 줘서 DOM이 완전히 렌더링된 후 실행
        let cleanup;
        const timer = setTimeout(() => {
            cleanup = addMenuButton();
        }, 100);

        return () => {
            clearTimeout(timer);
            if (cleanup) cleanup();
        };
    }, [uid]);

    // 메뉴가 열려 있을 때 바깥을 누르거나 Esc를 누르면 닫기
    useEffect(() => {
        if (!isMenuOpen) return;

        const handlePointerDown = (e) => {
            if (e.target.closest('.menu-dropdown') || e.target.closest('.custom-menu-button')) return;
            setIsMenuOpen(false);
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsMenuOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMenuOpen]);

    // 메뉴 옵션 클릭 핸들러
    const handleMenuOptionClick = useCallback((handler) => {
        if (handler) {
            handler();
        }
        setIsMenuOpen(false);
    }, []);

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

    return (
        <div className="chatbotPage_container">
            <div className='chatbotPage_headerDiv'>
                <div className="chatbotPage_titleGroup">
                    <img src="/logo.png" alt="" className="chatbotPage_logo" />
                    <h2 className="chatbotPage_header">하루의 지출을 머니챗과 함께!</h2>
                </div>
                <button className="chatbotPage_logoutBtn" onClick={handleLogout}>
                    로그아웃
                </button>
            </div>

            <div className="chatbotPage_chatWrapper">
                <Chatbot
                    key={uid}
                    config={chatbotConfig}
                    messageParser={MessageParser}
                    actionProvider={ActionProviderWrapper}
                    headerText='MoneyChat'
                    placeholderText='예) 점심 8000'
                />

                {/* 메뉴 드롭다운 */}
                {isMenuOpen && (
                    <div className="menu-dropdown">
                        <div className="menu-header">
                            <span>💰 머니챗 메뉴</span>
                            <button
                                className="menu-close-button"
                                onClick={() => setIsMenuOpen(false)}
                                aria-label="메뉴 닫기"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="menu-options">
                            {menuOptions.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => handleMenuOptionClick(option.handler)}
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
