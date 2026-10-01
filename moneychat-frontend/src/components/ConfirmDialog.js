// moneychat-frontend/src/components/ConfirmDialog.js
// 브라우저 기본 confirm 대신 사용하는 확인 대화상자 (Esc·바깥 클릭으로 닫기, 열리면 '취소'에 포커스)
import React, { useEffect, useRef } from 'react';
import useDialogKeyboard from './useDialogKeyboard';

const ConfirmDialog = ({ title, message, confirmText = '확인', cancelText = '취소', danger = false, busy = false, error = '', onConfirm, onCancel }) => {
    const dialogRef = useRef(null);
    const cancelRef = useRef(null);

    useEffect(() => {
        cancelRef.current?.focus();
    }, []);

    useDialogKeyboard(dialogRef, onCancel, busy);

    return (
        <div className="confirm-dialog-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
            <div
                ref={dialogRef}
                className="confirm-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-message"
            >
                <h2 id="confirm-dialog-title" className="confirm-dialog-title">{title}</h2>
                <p id="confirm-dialog-message" className="confirm-dialog-message">{message}</p>
                {error && <p className="confirm-dialog-error" role="alert">{error}</p>}
                <div className="confirm-dialog-actions">
                    <button type="button" ref={cancelRef} onClick={onCancel} disabled={busy}>{cancelText}</button>
                    <button
                        type="button"
                        className={danger ? 'confirm-dialog-danger' : 'confirm-dialog-primary'}
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
