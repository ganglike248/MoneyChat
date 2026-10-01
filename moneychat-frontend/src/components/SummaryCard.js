// moneychat-frontend/src/components/SummaryCard.js
// 지출 요약 카드 (총액, 예산 사용률, 카테고리별 막대그래프, 상세 지출)
import React from 'react';
import { CalendarDays, CalendarRange, Calendar, CalendarClock, ClipboardList } from 'lucide-react';
import { stripEmoji } from '../chatbot/messageFormat';

const CARD_ICONS = { today: CalendarDays, week: CalendarRange, month: Calendar, lastMonth: CalendarClock, detail: ClipboardList };

// 카드 종류 (예전에 저장된 카드는 icon 값이 없으므로 제목으로 추정)
const getCardKind = (card) => {
  if (card.icon) return card.icon;
  const title = card.title || '';
  if (title.includes('상세')) return 'detail';
  if (title.includes('지난달')) return 'lastMonth';
  if (title.includes('이번 주')) return 'week';
  if (title.includes('이번 달')) return 'month';
  if (title.includes('오늘')) return 'today';
  return null;
};

export const BudgetBar = ({ status }) => (
    <div className="budget-bar">
        <div className="budget-bar-label">
            <span>예산 {status.budget.toLocaleString()}원</span>
            <span className={status.over ? 'budget-bar-over' : ''}>
                {status.over
                    ? `${(-status.remaining).toLocaleString()}원 초과`
                    : `${status.remaining.toLocaleString()}원 남음`}
            </span>
        </div>
        <div className="budget-bar-track" role="progressbar" aria-valuenow={status.percent} aria-valuemin={0} aria-valuemax={100}>
            <div
                className={`budget-bar-fill${status.over ? ' budget-bar-fill-over' : ''}`}
                style={{ width: `${Math.min(status.percent, 100)}%` }}
            />
        </div>
    </div>
);

const SummaryCard = ({ card }) => {
    const Icon = CARD_ICONS[getCardKind(card)];

    return (
        <div className="summary-card">
            <div className="summary-card-title">
                {Icon && <Icon size={14} aria-hidden="true" />}
                {stripEmoji(card.title).trim()}
            </div>
            <div className="summary-card-total">{card.total.toLocaleString()}원</div>

            {card.budget && <BudgetBar status={card.budget} />}

            {card.rows?.length > 0 && (
                <ul className="summary-card-rows">
                    {card.rows.map((row) => (
                        <li key={row.label}>
                            <div className="summary-card-row-head">
                                <span>{stripEmoji(row.label)}</span>
                                <span>{row.amount.toLocaleString()}원 <em>{row.percent}%</em></span>
                            </div>
                            <div className="summary-card-bar">
                                <div style={{ width: `${row.percent}%` }} />
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {card.details?.length > 0 && (
                <>
                    <div className="summary-card-subtitle">상세 지출</div>
                    <ul className="summary-card-details">
                        {card.details.map((detail) => (
                            <li key={detail.label}>
                                <span>{stripEmoji(detail.label)}</span>
                                <span>{detail.amount.toLocaleString()}원</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
};

export default SummaryCard;
