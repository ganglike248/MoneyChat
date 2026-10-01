// /components/SignupPage.js
import React, { useState } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { getAuthErrorMessage } from '../authErrors';
import PasswordInput from './PasswordInput';
import '../styles/SignupPage.css';

const SignupPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  // 회원가입
  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (password.length < 6) {
      setErrorMessage('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage('비밀번호가 서로 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Firestore에 사용자 정보 저장 (실패해도 계정은 만들어졌으므로 가입은 계속 진행)
      try {
        await setDoc(doc(db, "users", user.uid), {
          email: user.email
        });
      } catch (profileError) {
        console.error('사용자 정보 저장 실패:', profileError);
      }

      // 가입과 동시에 로그인되므로 바로 챗봇 화면으로 이동
      navigate('/chatbot', { replace: true });
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
      setIsLoading(false);
    }
  };

  return (
    <div className="SignupPage_container">
      <div className="SignupPage_subContainer">
        <img src="/avatar-large.png" alt="MoneyChat" className="auth_logo" />
        <h2 style={{ marginTop: '0' }}>MoneyChat 회원가입</h2>
        <form onSubmit={handleSignup} className="SignupPage_form">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="SignupPage_input"
            autoComplete="email"
            required
          />
          <PasswordInput
            placeholder="비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="SignupPage_input"
            autoComplete="new-password"
            required
          />
          <PasswordInput
            placeholder="비밀번호 확인"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="SignupPage_input"
            autoComplete="new-password"
            required
          />
          {errorMessage && <p className="SignupPage_error" role="alert">{errorMessage}</p>}
          <button type="submit" className="SignupPage_button" disabled={isLoading}>
            {isLoading ? '가입 중...' : '회원가입'}
          </button>
        </form>
        <Link to="/" className="SignupPage_loginLink">이미 계정이 있으신가요? 로그인</Link>
      </div>
    </div>
  );
};

export default SignupPage;
