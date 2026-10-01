// moneychat-frontend/src/components/ExpenseTableLink.js
// 지출 상세 답변 아래의 '지출 관리 표에서 보기' 버튼 (해당 달의 지출 관리 페이지로 이동)
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Table2 } from 'lucide-react';

const ExpenseTableLink = ({ payload }) => {
    const navigate = useNavigate();
    const hasMonth = Number.isInteger(payload?.year) && Number.isInteger(payload?.month);
    const query = hasMonth ? `?month=${payload.year}-${String(payload.month + 1).padStart(2, '0')}` : '';

    return (
        <button className="chat-widget-button" type="button" onClick={() => navigate(`/expenses${query}`)}>
            <Table2 size={16} aria-hidden="true" />
            지출 관리 표에서 보기 · 수정
        </button>
    );
};

export default ExpenseTableLink;
