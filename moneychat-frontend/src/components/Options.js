import React from 'react';

// 버튼 옵션
const Options = (props) => {
    const options = [
        { 
            text: "오늘 지출 확인하기", 
            handler: () => props.actionProvider.handleTodayExpenses(), 
            id: 1 
        },
        { 
            text: "이번 주 지출 확인하기", 
            handler: () => props.actionProvider.handleWeekExpenses(), 
            id: 2 
        },
        { 
            text: "이번 달 지출 확인하기", 
            handler: () => props.actionProvider.handleMonthExpenses(), 
            id: 3 
        },
        { 
            text: "지출 패턴 분석 받기", 
            handler: () => props.actionProvider.handleExpenseFeedback(), 
            id: 4 
        },
    ];

    const optionsMarkup = options.map((option) => (
        <button key={option.id} onClick={option.handler} className="option-button">
            {option.text}
        </button>
    ));

    return <div className="options-container">{optionsMarkup}</div>;
};

export default Options;