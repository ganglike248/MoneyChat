// moneychat-frontend/src/components/UpdateBanner.js
// 새 버전이 준비되면 화면 위쪽에 표시되는 업데이트 안내
import React, { useState, useSyncExternalStore } from 'react';
import { getWaitingWorker, subscribeWaitingWorker, applyUpdate } from '../serviceWorkerUpdate';

const UpdateBanner = () => {
    const waitingWorker = useSyncExternalStore(subscribeWaitingWorker, getWaitingWorker);
    const [dismissedWorker, setDismissedWorker] = useState(null);

    if (!waitingWorker || waitingWorker === dismissedWorker) return null;

    return (
        <div className="update-banner" role="status">
            <span>머니챗의 새 버전이 준비됐어요.</span>
            <div className="update-banner-actions">
                <button type="button" onClick={() => setDismissedWorker(waitingWorker)}>나중에</button>
                <button type="button" className="update-banner-primary" onClick={applyUpdate}>업데이트</button>
            </div>
        </div>
    );
};

export default UpdateBanner;
