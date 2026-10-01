// moneychat-frontend/src/components/useDialogKeyboard.js
// 대화상자 키보드 처리: Esc로 닫기, Tab 이동은 대화상자 안에서만
import { useEffect } from 'react';

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]';

// disabled: 저장 중처럼 닫으면 안 되는 동안 true
const useDialogKeyboard = (dialogRef, onClose, disabled = false) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (!disabled) onClose();
                return;
            }
            if (e.key !== 'Tab' || !dialogRef.current) return;

            const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [dialogRef, onClose, disabled]);
};

export default useDialogKeyboard;
