// moneychat-frontend/src/components/ExpenseFormDialog.js
// 지출 관리 페이지의 지출 추가/수정 대화상자
import React, { useEffect, useRef, useState } from 'react';
import { CATEGORIES, toAmount, toLocalDateString, formatKoreanAmount } from '../chatbot/expenseUtils';
import useDialogKeyboard from './useDialogKeyboard';

// initial: { date: 'YYYY-MM-DD', subject, category, amount }
// onSubmit: 입력값을 받아 저장 (실패하면 에러를 던짐)
const ExpenseFormDialog = ({ title, submitText, initial, onSubmit, onCancel }) => {
    const dialogRef = useRef(null);
    const firstInputRef = useRef(null);
    const [values, setValues] = useState(initial);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        firstInputRef.current?.focus();
    }, []);

    useDialogKeyboard(dialogRef, onCancel, isSaving);

    const update = (field) => (e) => {
        setValues((prev) => ({ ...prev, [field]: e.target.value }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const subject = values.subject.trim();
        const amount = toAmount(values.amount);

        if (!values.date || !subject || amount === null) {
            setError('날짜, 내용, 금액을 올바르게 입력해주세요.');
            return;
        }

        setIsSaving(true);
        try {
            await onSubmit({ date: values.date, subject, category: values.category, amount });
        } catch (submitError) {
            console.error('지출 저장 실패:', submitError);
            setError('저장하지 못했어요. 다시 시도해주세요.');
            setIsSaving(false);
        }
    };

    // 목록에 없는 예전 카테고리도 선택지에 유지
    const categoryOptions = CATEGORIES.includes(values.category) ? CATEGORIES : [values.category, ...CATEGORIES];
    const amount = toAmount(values.amount);

    return (
        <div className="confirm-dialog-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget && !isSaving) onCancel(); }}>
            <form
                ref={dialogRef}
                className="confirm-dialog expense-form"
                role="dialog"
                aria-modal="true"
                aria-labelledby="expense-form-title"
                onSubmit={handleSubmit}
            >
                <h2 id="expense-form-title" className="confirm-dialog-title">{title}</h2>

                <label className="expense-form-field">
                    <span>날짜</span>
                    <input
                        ref={firstInputRef}
                        type="date"
                        value={values.date}
                        max={toLocalDateString(new Date())}
                        onChange={update('date')}
                        required
                    />
                </label>
                <label className="expense-form-field">
                    <span>내용</span>
                    <input
                        type="text"
                        value={values.subject}
                        onChange={update('subject')}
                        placeholder="예) 커피"
                        maxLength={50}
                        required
                    />
                </label>
                <label className="expense-form-field">
                    <span>카테고리</span>
                    <select value={values.category} onChange={update('category')}>
                        {categoryOptions.map((category) => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
                </label>
                <label className="expense-form-field">
                    <span>금액</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={values.amount}
                        onChange={update('amount')}
                        placeholder="예) 5000"
                        required
                    />
                    {amount !== null && <small className="amount-preview">{formatKoreanAmount(amount)}</small>}
                </label>

                {error && <p className="confirm-dialog-error" role="alert">{error}</p>}

                <div className="confirm-dialog-actions">
                    <button type="button" onClick={onCancel} disabled={isSaving}>취소</button>
                    <button type="submit" className="confirm-dialog-primary" disabled={isSaving}>
                        {isSaving ? '저장 중...' : submitText}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ExpenseFormDialog;
