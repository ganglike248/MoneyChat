// moneychat-frontend/src/components/UndoExpenseButton.js
import React, { useState } from 'react';

const UndoExpenseButton = (props) => {
    const [isUsed, setIsUsed] = useState(false);

    const handleUndo = async () => {
        if (isUsed) return;

        // 중복 클릭 방지를 위해 먼저 숨김
        setIsUsed(true);
        await props.actions.handleUndoExpense(props.payload?.expenseId);
    };

    if (isUsed) {
        return null;
    }

    return (
        <button className="expense-undo-button" onClick={handleUndo} type="button">
            취소하기
        </button>
    );
};

export default UndoExpenseButton;
