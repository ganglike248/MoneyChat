import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 서비스 워커 등록 및 업데이트 관리
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker 등록 성공:', registration.scope);

        // 1. 새로운 업데이트가 발견되었을 때의 처리
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            // 새로운 서비스 워커가 설치 완료되었고, 기존 서비스 워커가 있는 경우 (업데이트 상황)
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('새로운 콘텐츠가 준비되었습니다.');

              // 모바일 사용자에게 알림을 띄우고 수락 시 즉시 업데이트 진행
              if (window.confirm('머니챗의 새로운 버전이 업데이트 되었습니다! 적용하시겠습니까?')) {
                // 대기 중인 새 서비스 워커에게 즉시 제어권을 넘기도록 메시지 전송
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            }
          });
        });
      })
      .catch(err => {
        console.log('ServiceWorker 등록 실패:', err);
      });

    // 2. 서비스 워커의 제어권이 새 버전으로 교체되면 페이지를 강제 새로고침
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        window.location.reload();
        refreshing = true;
      }
    });
  });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();