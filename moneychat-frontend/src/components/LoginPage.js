// /components/LoginPage.js
import React, { useState } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth'; // 모듈식으로 가져옴
import { useNavigate } from 'react-router-dom';
import '../styles/LoginPage.css';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    // 로그인
    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            // 모듈식으로 signInWithEmailAndPassword 호출
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/chatbot'); // 챗봇 화면으로 이동
        } catch (error) {
            alert('로그인 실패: ' + error.message);
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
                <h5>머니챗과 함께 하루를 기록해보세요!</h5>
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
                    <button className='LoginPage_LoginBtn' type="submit">로그인</button>
                </form>
                <button className='LoginPage_signupBtn' onClick={() => navigate('/signup')}>회원가입</button>
            </div>
        </div>
    );
};

export default LoginPage;
