import React, { useState } from 'react';

const MenuButton = (props) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const options = [
        {
            text: "📊 오늘 지출 확인",
            handler: () => props.actionProvider.handleTodayExpenses(),
            id: 1
        },
        {
            text: "📅 이번 주 지출 확인",
            handler: () => props.actionProvider.handleWeekExpenses(),
            id: 2
        },
        {
            text: "📈 이번 달 지출 확인",
            handler: () => props.actionProvider.handleMonthExpenses(),
            id: 3
        },
        {
            text: "📋 이번 달 지출 상세",
            handler: () => props.actionProvider.handleMonthDetailExpenses(),
            id: 4
        },
        {
            text: "🕒 최근 지출 알아보기",
            handler: () => props.actionProvider.handleRecentExpense(),
            id: 5
        },
        {
            text: "🔍 지출 패턴 분석",
            handler: () => props.actionProvider.handleExpenseFeedback(),
            id: 6
        },
    ];

    const handleOptionClick = (handler) => {
        handler();
        setIsMenuOpen(false);
    };

    return (
        <div className="menu-button-container">
            <button
                className="menu-toggle-button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title="메뉴 열기"
            >
                ☰
            </button>

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
                        {options.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => handleOptionClick(option.handler)}
                                className="menu-option-button"
                            >
                                {option.text}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MenuButton;
