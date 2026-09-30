// moneychat-frontend/src/components/BudgetForm.js
// 월 예산 설정 위젯 ('💰 예산 설정' 메뉴에서 표시)
import React, { useState } from 'react';
import { toAmount } from '../chatbot/expenseUtils';

const BudgetForm = (props) => {
    const currentBudget = props.payload?.budget ?? null;
    const [value, setValue] = useState(currentBudget ? String(currentBudget) : '');
    const [isDone, setIsDone] = useState(false);
    const [error, setError] = useState('');

    if (isDone) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const budget = toAmount(value);
        if (budget === null) {
            setError('예산을 1원 이상의 금액으로 입력해주세요.');
            return;
        }
        setIsDone(true);
        await props.actions.handleSetBudget(budget);
    };

    const handleClear = async () => {
        setIsDone(true);
        await props.actions.handleSetBudget(0);
    };

    return (
        <form className="chat-widget-form" onSubmit={handleSubmit}>
            <div className="chat-widget-form-row">
                <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    placeholder="예) 500000"
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setError(''); }}
                    aria-label="한 달 예산 (원)"
                />
                <span>원</span>
                <button type="submit" className="chat-widget-form-primary">저장</button>
            </div>
            {currentBudget && (
                <button type="button" className="chat-widget-form-link" onClick={handleClear}>예산 해제하기</button>
            )}
            {error && <p className="chat-widget-form-error" role="alert">{error}</p>}
        </form>
    );
};

export default BudgetForm;
