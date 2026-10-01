// moneychat-frontend/src/components/ExpensesPage.js
// 지출 관리 페이지: 한 달 지출을 표로 보고 추가/수정/삭제 (메뉴의 '지출 관리'에서 이동)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { auth } from '../firebase/firebaseConfig';
import { fetchExpensesInRange, fetchBudget, addExpenses, updateExpense, deleteExpenses } from '../expenseRepository';
import {
    CATEGORIES, getMonthRange, formatMonthLabel, toAmount, toLocalDateString, expenseDateFromString, getBudgetStatus,
} from '../chatbot/expenseUtils';
import ExpenseFormDialog from './ExpenseFormDialog';
import '../styles/appHeader.css';
import '../styles/ExpensesPage.css';

// 삭제 후 '되돌리기' 안내를 보여주는 시간
const TOAST_DURATION = 5000;

const isSameMonth = (date, month) => date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();

// 새 지출의 기본 날짜: 이번 달이면 오늘, 지난 달이면 그 달의 마지막 날
const defaultDateFor = (month, now = new Date()) =>
    toLocalDateString(isSameMonth(now, month) ? now : new Date(month.getFullYear(), month.getMonth() + 1, 0));

// 주소의 ?month=YYYY-MM 으로 처음 볼 달 지정 (없거나 올바르지 않거나 미래면 이번 달)
const getInitialMonth = (value, now = new Date()) => {
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})$/);
    if (!match) return thisMonth;

    const month = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    return Number(match[2]) >= 1 && Number(match[2]) <= 12 && month <= thisMonth ? month : thisMonth;
};

const formatRowDate = (date) => `${date.getMonth() + 1}.${date.getDate()}`;
const formatWeekday = (date) => date.toLocaleDateString('ko-KR', { weekday: 'short' });

const isSameDay = (a, b) => Boolean(a && b) && toLocalDateString(a.date) === toLocalDateString(b.date);

const ExpensesPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [uid, setUid] = useState(null);
    const [viewMonth, setViewMonth] = useState(() => getInitialMonth(searchParams.get('month')));
    const [expenses, setExpenses] = useState(null); // null: 불러오는 중
    const [loadFailed, setLoadFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [budget, setBudget] = useState(null);
    const [category, setCategory] = useState('all');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
    const [dialog, setDialog] = useState(null); // { mode: 'add' } | { mode: 'edit', expense }
    const [toast, setToast] = useState(null); // { message, deleted? }
    const [pendingId, setPendingId] = useState(null); // 삭제 중인 지출

    const isCurrentMonth = isSameMonth(new Date(), viewMonth);

    // 로그인 확인
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) setUid(user.uid);
            else navigate('/', { replace: true });
        });
        return () => unsubscribe();
    }, [navigate]);

    // 보고 있는 달의 지출 불러오기
    useEffect(() => {
        if (!uid) return;

        let cancelled = false;
        setExpenses(null);
        setLoadFailed(false);
        fetchExpensesInRange(getMonthRange(viewMonth.getFullYear(), viewMonth.getMonth()))
            .then((list) => {
                if (!cancelled) setExpenses(list.map((expense) => ({ ...expense, amount: toAmount(expense.amount) ?? 0 })));
            })
            .catch((error) => {
                console.error('지출 목록 조회 실패:', error);
                if (!cancelled) setLoadFailed(true);
            });
        return () => { cancelled = true; };
    }, [uid, viewMonth, reloadKey]);

    useEffect(() => {
        if (!uid) return;
        fetchBudget().then(setBudget).catch(() => setBudget(null));
    }, [uid]);

    // 안내 메시지는 잠시 뒤 자동으로 사라짐
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), TOAST_DURATION);
        return () => clearTimeout(timer);
    }, [toast]);

    const goBack = () => {
        // 채팅에서 들어왔으면 뒤로 가기, 주소로 바로 들어왔으면 채팅으로 이동
        if (window.history.state?.idx > 0) navigate(-1);
        else navigate('/chatbot', { replace: true });
    };

    const moveMonth = (offset) => {
        setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const goToThisMonth = () => {
        const now = new Date();
        setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    };

    const toggleSort = (key) => {
        setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
    };

    // 목록에 없는 예전 카테고리도 필터에 표시
    const categoryOptions = useMemo(() => {
        const extra = (expenses || []).map((expense) => expense.category).filter((item) => !CATEGORIES.includes(item));
        return [...CATEGORIES, ...new Set(extra)];
    }, [expenses]);

    const visibleExpenses = useMemo(() => {
        if (!expenses) return [];
        const keyword = query.trim().toLowerCase();
        const direction = sort.dir === 'desc' ? -1 : 1;
        return expenses
            .filter((expense) => category === 'all' || expense.category === category)
            .filter((expense) => !keyword || expense.subject.toLowerCase().includes(keyword))
            .sort((a, b) => direction * (sort.key === 'amount' ? a.amount - b.amount : a.date - b.date));
    }, [expenses, category, query, sort]);

    const monthTotal = (expenses || []).reduce((sum, expense) => sum + expense.amount, 0);
    const visibleTotal = visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const isFiltered = category !== 'all' || query.trim() !== '';
    const budgetStatus = isCurrentMonth && expenses ? getBudgetStatus(budget, monthTotal) : null;

    // 저장 후 목록 반영 (보고 있는 달이 아니면 목록에서 빠짐)
    const upsertExpense = (expense) => {
        setExpenses((prev) => {
            const rest = prev.filter((item) => item.id !== expense.id);
            return isSameMonth(expense.date, viewMonth) ? [...rest, expense] : rest;
        });
    };

    const handleAdd = async ({ date, subject, category: newCategory, amount }) => {
        const expenseDate = expenseDateFromString(date);
        const [id] = await addExpenses([{ subject, category: newCategory, amount, date: expenseDate }]);
        upsertExpense({ id, subject, category: newCategory, amount, date: expenseDate });
        setDialog(null);
        setToast({
            message: isSameMonth(expenseDate, viewMonth)
                ? `'${subject}' 지출을 추가했어요.`
                : `'${subject}' 지출을 ${formatMonthLabel(expenseDate)}에 추가했어요.`,
        });
    };

    const handleEdit = async (original, { date, subject, category: newCategory, amount }) => {
        const fields = { subject, category: newCategory, amount };
        // 날짜를 바꾼 경우에만 시각 변경
        if (date !== toLocalDateString(original.date)) fields.date = expenseDateFromString(date);

        await updateExpense(original.id, fields);
        upsertExpense({ ...original, ...fields, date: fields.date || original.date });
        setDialog(null);
        setToast({ message: '수정했어요.' });
    };

    const handleDelete = async (expense) => {
        setPendingId(expense.id);
        try {
            await deleteExpenses([expense.id]);
            setExpenses((prev) => prev.filter((item) => item.id !== expense.id));
            setToast({ message: `'${expense.subject}' 지출을 삭제했어요.`, deleted: expense });
        } catch (error) {
            console.error('지출 삭제 실패:', error);
            setToast({ message: '삭제하지 못했어요. 다시 시도해주세요.' });
        } finally {
            setPendingId(null);
        }
    };

    // 삭제한 지출을 다시 저장 (새 문서로 저장되므로 ID가 바뀜)
    const handleRestore = async () => {
        const deleted = toast?.deleted;
        if (!deleted) return;

        setToast(null);
        try {
            const [id] = await addExpenses([{ subject: deleted.subject, category: deleted.category, amount: deleted.amount, date: deleted.date }]);
            upsertExpense({ ...deleted, id });
            setToast({ message: '삭제를 되돌렸어요.' });
        } catch (error) {
            console.error('지출 복구 실패:', error);
            setToast({ message: '되돌리지 못했어요. 다시 시도해주세요.' });
        }
    };

    const closeDialog = useCallback(() => setDialog(null), []);

    const sortButton = (key, label) => {
        const isActive = sort.key === key;
        const SortIcon = sort.dir === 'desc' ? ArrowDown : ArrowUp;
        return (
            <button type="button" className={`expenseTable_sort${isActive ? ' is-active' : ''}`} onClick={() => toggleSort(key)}>
                {label}
                {isActive && <SortIcon size={12} aria-hidden="true" />}
            </button>
        );
    };

    const ariaSort = (key) => (sort.key === key ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none');

    return (
        <div className="expensesPage">
            <header className="appHeader">
                <button type="button" className="appHeader_iconButton" onClick={goBack} aria-label="채팅으로 돌아가기">
                    <ArrowLeft size={24} aria-hidden="true" />
                </button>
                <h1 className="appHeader_title">지출 관리</h1>
                <button
                    type="button"
                    className="expensesPage_addButton"
                    onClick={() => setDialog({ mode: 'add' })}
                    disabled={!uid}
                >
                    <Plus size={18} aria-hidden="true" />
                    추가
                </button>
            </header>

            <main className="expensesPage_body">
                {/* 월 이동 + 요약 */}
                <section className="expensesPage_summary" aria-label="월별 요약">
                    <div className="expensesPage_month">
                        <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">
                            <ChevronLeft size={20} aria-hidden="true" />
                        </button>
                        <div className="expensesPage_monthTitle">
                            <h2>{formatMonthLabel(viewMonth)}</h2>
                            {/* 다른 달을 보고 있을 때만 이번 달로 바로 돌아가는 버튼 표시 */}
                            {!isCurrentMonth && (
                                <button type="button" className="expensesPage_thisMonth" onClick={goToThisMonth}>
                                    이번 달
                                </button>
                            )}
                        </div>
                        <button type="button" onClick={() => moveMonth(1)} disabled={isCurrentMonth} aria-label="다음 달">
                            <ChevronRight size={20} aria-hidden="true" />
                        </button>
                    </div>
                    <div className="expensesPage_total">
                        <span className="expensesPage_totalLabel">총 지출</span>
                        {expenses
                            ? <strong>{monthTotal.toLocaleString()}원</strong>
                            : <span className="summaryBar_skeleton" aria-label="불러오는 중" />}
                        {expenses && <span className="expensesPage_count">{expenses.length}건</span>}
                    </div>
                    {budgetStatus && (
                        <div className="expensesPage_budget">
                            <div className="expensesPage_budgetLabel">
                                <span>예산 {budgetStatus.budget.toLocaleString()}원</span>
                                <span className={budgetStatus.over ? 'expensesPage_over' : ''}>
                                    {budgetStatus.over
                                        ? `${(-budgetStatus.remaining).toLocaleString()}원 초과`
                                        : `${budgetStatus.remaining.toLocaleString()}원 남음 · ${budgetStatus.percent}%`}
                                </span>
                            </div>
                            <span
                                className={`summaryBar_meter${budgetStatus.over ? ' summaryBar_meter--over' : budgetStatus.percent >= 80 ? ' summaryBar_meter--warn' : ''}`}
                                role="progressbar"
                                aria-label="예산 사용률"
                                aria-valuenow={Math.min(budgetStatus.percent, 100)}
                                aria-valuemin={0}
                                aria-valuemax={100}
                            >
                                <span style={{ width: `${Math.min(budgetStatus.percent, 100)}%` }} />
                            </span>
                        </div>
                    )}
                </section>

                {/* 필터 */}
                <div className="expensesPage_filters">
                    <label className="expensesPage_search">
                        <Search size={16} aria-hidden="true" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="내용 검색"
                            aria-label="내용 검색"
                        />
                    </label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="카테고리">
                        <option value="all">전체 카테고리</option>
                        {categoryOptions.map((item) => (
                            <option key={item} value={item}>{item}</option>
                        ))}
                    </select>
                </div>

                {/* 지출 표 */}
                {loadFailed ? (
                    <div className="expensesPage_message" role="alert">
                        <p>지출 내역을 불러오지 못했어요.</p>
                        <button type="button" onClick={() => setReloadKey((key) => key + 1)}>다시 시도</button>
                    </div>
                ) : expenses === null ? (
                    <div className="expensesPage_message"><p>불러오는 중...</p></div>
                ) : visibleExpenses.length === 0 ? (
                    <div className="expensesPage_message">
                        <p>{isFiltered ? '조건에 맞는 지출이 없어요.' : `${formatMonthLabel(viewMonth)} 지출 내역이 없어요.`}</p>
                        {!isFiltered && (
                            <button type="button" onClick={() => setDialog({ mode: 'add' })}>지출 추가하기</button>
                        )}
                    </div>
                ) : (
                    <table className="expenseTable">
                        <thead>
                            <tr>
                                <th scope="col" aria-sort={ariaSort('date')}>{sortButton('date', '날짜')}</th>
                                <th scope="col">내용</th>
                                <th scope="col" className="expenseTable_num" aria-sort={ariaSort('amount')}>{sortButton('amount', '금액')}</th>
                                <th scope="col"><span className="visually-hidden">관리</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleExpenses.map((expense, index) => {
                                // 바로 위 행과 날짜가 같으면 날짜를 화면에서 생략 (스크린 리더는 그대로 읽음)
                                const continuesDay = isSameDay(visibleExpenses[index - 1], expense);
                                const dayContinues = isSameDay(expense, visibleExpenses[index + 1]);
                                return (
                                    <tr key={expense.id} className={dayContinues ? 'expenseTable_row--dayContinues' : undefined}>
                                        <td className="expenseTable_date">
                                            <span className={continuesDay ? 'visually-hidden' : undefined}>
                                                {formatRowDate(expense.date)}
                                                <span className="expenseTable_weekday">({formatWeekday(expense.date)})</span>
                                            </span>
                                        </td>
                                        <td>
                                            <div className="expenseTable_subject">
                                                <span className="expenseTable_category">{expense.category}</span>
                                                <span>{expense.subject}</span>
                                            </div>
                                        </td>
                                        <td className="expenseTable_num">{expense.amount.toLocaleString()}원</td>
                                        <td className="expenseTable_actions">
                                            <button
                                                type="button"
                                                onClick={() => setDialog({ mode: 'edit', expense })}
                                                disabled={pendingId === expense.id}
                                                aria-label={`${expense.subject} 수정`}
                                            >
                                                <Pencil size={16} aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(expense)}
                                                disabled={pendingId === expense.id}
                                                aria-label={`${expense.subject} 삭제`}
                                            >
                                                <Trash2 size={16} aria-hidden="true" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row" colSpan={2}>{isFiltered ? `검색 결과 ${visibleExpenses.length}건` : `합계 ${visibleExpenses.length}건`}</th>
                                <td className="expenseTable_num">{visibleTotal.toLocaleString()}원</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                )}
            </main>

            {toast && (
                <div className="expensesPage_toast" role="status">
                    <span>{toast.message}</span>
                    {toast.deleted && <button type="button" onClick={handleRestore}>되돌리기</button>}
                </div>
            )}

            {dialog && (
                <ExpenseFormDialog
                    title={dialog.mode === 'add' ? '지출 추가' : '지출 수정'}
                    submitText={dialog.mode === 'add' ? '추가' : '저장'}
                    initial={dialog.mode === 'add'
                        ? { date: defaultDateFor(viewMonth), subject: '', category: CATEGORIES[0], amount: '' }
                        : {
                            date: toLocalDateString(dialog.expense.date),
                            subject: dialog.expense.subject,
                            category: dialog.expense.category,
                            amount: String(dialog.expense.amount),
                        }}
                    onSubmit={dialog.mode === 'add' ? handleAdd : (fields) => handleEdit(dialog.expense, fields)}
                    onCancel={closeDialog}
                />
            )}
        </div>
    );
};

export default ExpensesPage;
