// ChatbotPage.js
import React, { useEffect } from 'react';
import Chatbot from 'react-chatbot-kit';
import 'react-chatbot-kit/build/main.css';
import config from '../chatbot/config';
import MessageParser from '../chatbot/MessageParser';
import ActionProvider from '../chatbot/ActionProvider';
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import '../styles/chatbot.css';

const ChatbotPage = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (!user) {
                navigate('/');
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            alert("로그아웃 되었습니다!");
            navigate('/');
        } catch (error) {
            console.error("로그아웃 실패: ", error);
        }
    };

    return (
        <div className="chatbotPage_container">
            <div className='chatbotPage_headerDiv'>
                <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'start', width: '70%'}}>
                    <img
                        src="/logo.png"
                        alt="MoneyChat Avatar"
                        style={{
                            width: '15%',
                            height: '15%',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            marginRight: '10px'
                        }}
                    />
                    <h2 className="chatbotPage_header">하루의 지출을 머니챗과 함께!</h2>
                </div>
                <button className="chatbotPage_logoutBtn" onClick={handleLogout}>
                    로그아웃
                </button>
            </div>
            <Chatbot
                config={config}
                messageParser={MessageParser}
                actionProvider={ActionProvider}
                headerText='MoneyChat'
                placeholderText='자유롭게 지출 내용을 입력해주세요!'
            />
        </div>
    );
};

export default ChatbotPage;