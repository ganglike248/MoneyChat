// /src/serviceWorkerUpdate.js
// 새 버전 서비스 워커가 설치되어 적용을 기다리는 상태
// (index.js에서 설정하고, App의 업데이트 안내 배너에서 사용)

let waitingWorker = null;
const listeners = new Set();

export const setWaitingWorker = (worker) => {
  waitingWorker = worker;
  listeners.forEach((listener) => listener());
};

export const getWaitingWorker = () => waitingWorker;

export const subscribeWaitingWorker = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// 대기 중인 새 서비스 워커에게 즉시 제어권을 넘기도록 요청 (교체되면 index.js에서 새로고침)
export const applyUpdate = () => {
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
};
