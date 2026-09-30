// moneychat-frontend/src/components/PasswordInput.js
// 비밀번호 입력창 + 보기/숨기기 버튼 (로그인, 회원가입에서 사용)
import React, { useState } from 'react';

const PasswordInput = ({ className, ...inputProps }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className="password-input">
            <input {...inputProps} type={isVisible ? 'text' : 'password'} className={className} />
            <button
                type="button"
                className="password-input-toggle"
                onClick={() => setIsVisible((prev) => !prev)}
                aria-label={isVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
                aria-pressed={isVisible}
            >
                {isVisible ? '숨기기' : '보기'}
            </button>
        </div>
    );
};

export default PasswordInput;
