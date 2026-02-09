// moneychat-frontend/src/components/UndoExpenseButton.js
import React, { useState } from 'react';

const UndoExpenseButton = (props) => {
    const [isUsed, setIsUsed] = useState(false);

    const handleUndo = async () => {
        if (isUsed) return;

        await props.actionProvider.handleUndoRecentExpense();
        setIsUsed(true);
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
