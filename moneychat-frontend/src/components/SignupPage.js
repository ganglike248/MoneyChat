// /components/SignupPage.js
import React, { useState } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/SignupPage.css';

const SignupPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // const [nickname, setNickname] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Firestore에 사용자의 닉네임 저장
      await setDoc(doc(db, "users", user.uid), {
        // nickname: nickname,
        email: email
      });
      alert('환영합니다!');
      navigate('/');
    } catch (error) {
      alert('회원가입 실패: ' + error.message);
    }
  };

  return (
    <div className="SignupPage_container">
      <div className="SignupPage_subContainer">
        <h2>MoneyChat 회원가입</h2>
        <form onSubmit={handleSignup} className="SignupPage_form">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="SignupPage_input"
          />
          <input
            type="password"
            placeholder="비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="SignupPage_input"
          />
          {/* <input
            type="text"
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="SignupPage_input"
          /> */}
          <button type="submit" className="SignupPage_button">회원가입</button>
        </form>
        <Link to="/" className="SignupPage_loginLink">이미 계정이 있으신가요? 로그인</Link>
      </div>
    </div>
  );
};

export default SignupPage;