import React, { useEffect, useState, useCallback, useRef } from 'react';
import Chatbot from 'react-chatbot-kit';
import 'react-chatbot-kit/build/main.css';
import config from '../chatbot/config';
import MessageParser from '../chatbot/MessageParser';
import ActionProvider from '../chatbot/ActionProvider';
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import '../styles/chatbot.css';

const ChatbotPage = () => {
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const actionProviderRef = useRef(null);

    // ActionProvider 래퍼 - 메뉴에서 액션을 호출할 수 있도록 ref 전달
    const ActionProviderWrapper = useCallback(
        (props) => <ActionProvider {...props} actionsRef={actionProviderRef} />,
        []
    );

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
            text: "📋 이번 달 지출 상세",
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

    // 로그인 확인
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (!user) {
                navigate('/');
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    // 컴포넌트 마운트 후 입력창에 메뉴 버튼 추가
    useEffect(() => {
        const addMenuButton = () => {
            const inputContainer = document.querySelector('.react-chatbot-kit-chat-input-container');
            if (inputContainer && !document.querySelector('.custom-menu-button')) {
                const inputForm = inputContainer.querySelector('.react-chatbot-kit-chat-input-form');

                if (inputForm) {
                    const menuButton = document.createElement('button');
                    menuButton.className = 'custom-menu-button';
                    menuButton.textContent = '☰';
                    menuButton.title = '메뉴 열기';
                    menuButton.type = 'button';

                    const handleClick = (e) => {
                        e.preventDefault();
                        e.stopPropagation(); // 이벤트 전파 중지 추가
                        setIsMenuOpen(prev => !prev);
                    };

                    menuButton.addEventListener('click', handleClick);

                    inputContainer.insertBefore(menuButton, inputForm);
                    inputContainer.style.display = 'flex';
                    inputContainer.style.alignItems = 'center';
                    inputContainer.style.gap = '0.5rem';

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
    }, []);

    // 메뉴 옵션 클릭 핸들러
    const handleMenuOptionClick = useCallback((handler) => {
        if (handler) {
            handler();
        }
        setIsMenuOpen(false);
    }, []);

    // 로그아웃
    const handleLogout = useCallback(async () => {
        try {
            await signOut(auth);
            alert("로그아웃 되었습니다!");
            navigate('/');
        } catch (error) {
            console.error("로그아웃 실패: ", error);
        }
    }, [navigate]);

    return (
        <div className="chatbotPage_container">
            <div className='chatbotPage_headerDiv'>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'start', width: '70%' }}>
                    <img
                        src="/logo.png"
                        alt="MoneyChat Avatar"
                        style={{
                            width: '15%',
                            height: '15%',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            marginRight: '10px'
                        }}
                    />
                    <h2 className="chatbotPage_header">하루의 지출을 머니챗과 함께!</h2>
                </div>
                <button className="chatbotPage_logoutBtn" onClick={handleLogout}>
                    로그아웃
                </button>
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
                <Chatbot
                    config={config}
                    messageParser={MessageParser}
                    actionProvider={ActionProviderWrapper}
                    headerText='MoneyChat'
                    placeholderText='자유롭게 지출 내용을 입력해주세요!'
                />

                {/* 메뉴 드롭다운 */}
                {isMenuOpen && (
                    <div className="menu-dropdown">
                        <div className="menu-header">
                            <span>💰 머니챗 메뉴</span>
                            <button
                                className="menu-close-button"
                                onClick={() => setIsMenuOpen(false)}
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
