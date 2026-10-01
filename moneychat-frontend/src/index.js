import React from 'react';
import ReactDOM from 'react-dom/client';
// 앱 전체 폰트 (필요한 글자 범위의 파일만 내려받는 분할 버전)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './index.css';
import './theme'; // 저장된 테마 적용 및 기기 설정 변경 감지
import App from './App';
import reportWebVitals from './reportWebVitals';
import { setWaitingWorker } from './serviceWorkerUpdate';

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

        // 이전 방문 때 설치된 새 버전이 아직 적용되지 않고 기다리는 경우
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
        }

        // 1. 새로운 업데이트가 발견되었을 때의 처리
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            // 새로운 서비스 워커가 설치 완료되었고, 기존 서비스 워커가 있는 경우 (업데이트 상황)
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('새로운 콘텐츠가 준비되었습니다.');

              // 화면 위쪽 업데이트 안내 배너 표시 (사용자가 '업데이트'를 누르면 적용)
              setWaitingWorker(newWorker);
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