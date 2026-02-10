// /components/LoginPage.js
import React, { useState } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth'; // 모듈식으로 가져옴
import { useNavigate } from 'react-router-dom';
import '../styles/LoginPage.css';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    // 로그인
    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/chatbot');
        } catch (error) {
            let errorMessage = '로그인 실패: ';

            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage += '올바른 이메일 형식이 아닙니다.';
                    break;
                case 'auth/user-not-found':
                    errorMessage += '존재하지 않는 계정입니다.';
                    break;
                case 'auth/wrong-password':
                    errorMessage += '비밀번호가 틀렸습니다.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage += '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
                    break;
                default:
                    errorMessage += error.message;
            }

            alert(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

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
                        />
                        <input
                            type="password"
                            placeholder="비밀번호"
                            className='LoginPage_password'
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        className='LoginPage_LoginBtn'
                        type="submit"
                        disabled={isLoading}
                    >
                        {isLoading ? '로그인 중...' : '로그인'}
                    </button>
                </form>
                <button className='LoginPage_signupBtn' onClick={() => navigate('/signup')}>회원가입</button>
            </div>
        </div>
    );
};

export default LoginPage;
