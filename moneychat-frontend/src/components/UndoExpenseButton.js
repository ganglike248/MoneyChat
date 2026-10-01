// moneychat-frontend/src/components/UndoExpenseButton.js
import React, { useState } from 'react';
import { Undo2 } from 'lucide-react';

const UndoExpenseButton = (props) => {
    const [isUsed, setIsUsed] = useState(false);
    const expenseIds = props.payload?.expenseIds || [];

    const handleUndo = async () => {
        if (isUsed) return;

        // 중복 클릭 방지를 위해 먼저 숨김
        setIsUsed(true);
        await props.actions.handleUndoExpense(expenseIds);
    };

    if (isUsed) {
        return null;
    }

    return (
        <button className="expense-undo-button" onClick={handleUndo} type="button">
            <Undo2 size={14} aria-hidden="true" />
            {expenseIds.length > 1 ? `${expenseIds.length}건 모두 취소하기` : '취소하기'}
        </button>
    );
};

export default UndoExpenseButton;
