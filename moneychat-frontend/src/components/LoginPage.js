// /components/LoginPage.js
import React, { useEffect, useState } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'; // 모듈식으로 가져옴
import { useNavigate } from 'react-router-dom';
import { getAuthErrorMessage } from '../authErrors';
import '../styles/LoginPage.css';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const navigate = useNavigate();

    // 이미 로그인되어 있으면 바로 챗봇 화면으로 이동 (자동 로그인)
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                navigate('/chatbot', { replace: true });
            } else {
                setIsCheckingAuth(false);
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    // 로그인
    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage('');
        setInfoMessage('');
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
            navigate('/chatbot', { replace: true });
        } catch (error) {
            setErrorMessage(getAuthErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    // 비밀번호 재설정 메일 보내기
    const handlePasswordReset = async () => {
        setErrorMessage('');
        setInfoMessage('');

        if (!email.trim()) {
            setErrorMessage('비밀번호를 재설정할 이메일을 입력해주세요.');
            return;
        }

        try {
            auth.languageCode = 'ko';
            await sendPasswordResetEmail(auth, email.trim());
            setInfoMessage('가입된 이메일이라면 비밀번호 재설정 메일이 발송됐어요. 메일함(스팸함 포함)을 확인해주세요.');
        } catch (error) {
            setErrorMessage(getAuthErrorMessage(error));
        }
    };

    // 로그인 상태 확인 중에는 로그인 폼이 잠깐 보였다 사라지지 않도록 비워둠
    if (isCheckingAuth) {
        return <div className='LoginPage_container' />;
    }

    return (
        <div className='LoginPage_container'>
            <div className='LoginPage_subContainer'>
                <img
                    src="/logo.png"
                    alt="MoneyChat Avatar"
                    style={{
                        width: '40%',
                        height: '40%',
                        borderRadius: '50%',
                        objectFit: 'cover',
                    }}
                />
                <h2 style={{ marginTop: '0' }}>MoneyChat</h2>
                <h5 style={{ marginTop: '0' }}>머니챗과 함께 쉽고 빠르게 지출을 기록해보세요!</h5>
                <form onSubmit={handleLogin} className='LoginPage_LoginForm'>
                    <div className='LoginPage_Logininput'>
                        <input
                            type="email"
                            placeholder="이메일" className='LoginPage_email'
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                        <input
                            type="password"
                            placeholder="비밀번호"
                            className='LoginPage_password'
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </div>
                    {errorMessage && <p className='LoginPage_error' role="alert">{errorMessage}</p>}
                    {infoMessage && <p className='LoginPage_info' role="status">{infoMessage}</p>}
                    <button
                        className='LoginPage_LoginBtn'
                        type="submit"
                        disabled={isLoading}
                    >
                        {isLoading ? '로그인 중...' : '로그인'}
                    </button>
                </form>
                <button className='LoginPage_signupBtn' onClick={() => navigate('/signup')}>회원가입</button>
                <button className='LoginPage_resetBtn' type="button" onClick={handlePasswordReset}>
                    비밀번호를 잊으셨나요?
                </button>
            </div>
        </div>
    );
};

export default LoginPage;
