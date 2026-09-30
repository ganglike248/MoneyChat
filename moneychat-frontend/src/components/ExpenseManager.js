// moneychat-frontend/src/components/ExpenseManager.js
// '지출 상세' 아래에 표시되는 지출 수정/삭제 위젯 (◀ ▶로 다른 달도 확인 가능)
import React, { useState } from 'react';
import { fetchExpensesInRange, updateExpense, deleteExpenses } from '../expenseRepository';
import { CATEGORIES, getMonthRange, formatMonthLabel, toAmount, toLocalDateString, expenseDateFromString, formatMonthDay } from '../chatbot/expenseUtils';

const ExpenseManager = (props) => {
    const now = new Date();
    const [isOpen, setIsOpen] = useState(false);
    // 보고 있는 달 (payload로 받은 달, 없으면 이번 달)
    const [viewMonth, setViewMonth] = useState(() => new Date(
        props.payload?.year ?? now.getFullYear(),
        props.payload?.month ?? now.getMonth(),
        1
    ));
    const [expenses, setExpenses] = useState(null);
    const [editing, setEditing] = useState(null); // 수정 중인 지출의 입력값
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState('');

    const isCurrentMonth = viewMonth.getFullYear() === now.getFullYear() && viewMonth.getMonth() === now.getMonth();

    const loadMonth = async (month) => {
        setViewMonth(month);
        setExpenses(null);
        setEditing(null);
        setStatus('');
        try {
            setExpenses(await fetchExpensesInRange(getMonthRange(month.getFullYear(), month.getMonth())));
        } catch (error) {
            console.error('지출 목록 조회 실패:', error);
            setStatus('지출 내역을 불러오지 못했어요. 다시 시도해주세요.');
        }
    };

    const open = () => {
        setIsOpen(true);
        loadMonth(viewMonth);
    };

    const moveMonth = (offset) => {
        loadMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1));
    };

    const notifyDataChanged = () => {
        if (props.actions?.notifyDataChanged) props.actions.notifyDataChanged();
    };

    const close = () => {
        setIsOpen(false);
        setEditing(null);
        setStatus('');
    };

    const startEdit = (expense) => {
        setStatus('');
        setEditing({
            id: expense.id,
            subject: expense.subject,
            category: expense.category,
            amount: String(toAmount(expense.amount) ?? ''),
            date: toLocalDateString(expense.date),
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const amount = toAmount(editing.amount);
        const subject = editing.subject.trim();

        if (!subject || amount === null) {
            setStatus('항목과 금액을 올바르게 입력해주세요.');
            return;
        }

        const original = expenses.find((expense) => expense.id === editing.id);
        const fields = { subject, category: editing.category, amount };
        // 날짜를 바꾼 경우에만 시각 변경
        if (editing.date !== toLocalDateString(original.date)) {
            fields.date = expenseDateFromString(editing.date);
        }

        setIsSaving(true);
        try {
            await updateExpense(editing.id, fields);
            setExpenses((prev) => prev.map((expense) =>
                expense.id === editing.id ? { ...expense, ...fields, date: fields.date || expense.date } : expense
            ));
            setEditing(null);
            setStatus('수정했어요 ✅');
            notifyDataChanged();
        } catch (error) {
            console.error('지출 수정 실패:', error);
            setStatus('수정하지 못했어요. 다시 시도해주세요.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (expense) => {
        const amount = (toAmount(expense.amount) ?? 0).toLocaleString();
        if (!window.confirm(`'${expense.subject}' ${amount}원 지출을 삭제할까요?`)) return;

        setIsSaving(true);
        try {
            await deleteExpenses([expense.id]);
            setExpenses((prev) => prev.filter((item) => item.id !== expense.id));
            setStatus('삭제했어요 🗑');
            notifyDataChanged();
        } catch (error) {
            console.error('지출 삭제 실패:', error);
            setStatus('삭제하지 못했어요. 다시 시도해주세요.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) {
        return (
            <button className="chat-widget-button" onClick={open} type="button">
                ✏️ 지출 수정 / 삭제하기
            </button>
        );
    }

    // 목록에 없는 예전 카테고리도 선택지에 유지
    const categoryOptions = editing && !CATEGORIES.includes(editing.category)
        ? [editing.category, ...CATEGORIES]
        : CATEGORIES;

    return (
        <div className="expense-manager">
            <div className="expense-manager-header">
                <div className="expense-manager-month">
                    <button type="button" onClick={() => moveMonth(-1)} disabled={isSaving} aria-label="이전 달">◀</button>
                    <span>{formatMonthLabel(viewMonth)} 지출</span>
                    <button type="button" onClick={() => moveMonth(1)} disabled={isSaving || isCurrentMonth} aria-label="다음 달">▶</button>
                </div>
                <button className="expense-manager-close" onClick={close} type="button" aria-label="닫기">✕</button>
            </div>

            {status && <p className="expense-manager-status" role="status">{status}</p>}

            {expenses === null && !status && <p className="expense-manager-empty">불러오는 중...</p>}
            {expenses && expenses.length === 0 && <p className="expense-manager-empty">{formatMonthLabel(viewMonth)} 지출 내역이 없어요.</p>}

            {expenses && expenses.length > 0 && (
                <ul className="expense-manager-list">
                    {expenses.map((expense) => (
                        <li key={expense.id} className="expense-manager-item">
                            {editing?.id === expense.id ? (
                                <form className="expense-manager-form" onSubmit={handleSave}>
                                    <input
                                        type="date"
                                        value={editing.date}
                                        max={toLocalDateString(new Date())}
                                        onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                                        aria-label="날짜"
                                        required
                                    />
                                    <input
                                        type="text"
                                        value={editing.subject}
                                        onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                                        aria-label="항목"
                                        placeholder="항목"
                                        maxLength={50}
                                        required
                                    />
                                    <select
                                        value={editing.category}
                                        onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                                        aria-label="카테고리"
                                    >
                                        {categoryOptions.map((category) => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min="1"
                                        value={editing.amount}
                                        onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                                        aria-label="금액"
                                        placeholder="금액"
                                        required
                                    />
                                    <div className="expense-manager-actions">
                                        <button type="submit" className="expense-manager-save" disabled={isSaving}>
                                            {isSaving ? '저장 중...' : '저장'}
                                        </button>
                                        <button type="button" onClick={() => setEditing(null)} disabled={isSaving}>취소</button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <div className="expense-manager-info">
                                        <span className="expense-manager-meta">{formatMonthDay(expense.date)} · {expense.category}</span>
                                        <span>{expense.subject} <strong>{(toAmount(expense.amount) ?? 0).toLocaleString()}원</strong></span>
                                    </div>
                                    <div className="expense-manager-actions">
                                        <button type="button" onClick={() => startEdit(expense)} disabled={isSaving} aria-label={`${expense.subject} 수정`}>✏️</button>
                                        <button type="button" onClick={() => handleDelete(expense)} disabled={isSaving} aria-label={`${expense.subject} 삭제`}>🗑</button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ExpenseManager;
