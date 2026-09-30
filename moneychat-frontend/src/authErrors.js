// /src/authErrors.js
// Firebase 인증 에러 코드를 한국어 안내 문구로 변환

const AUTH_ERROR_MESSAGES = {
  'auth/invalid-email': '올바른 이메일 형식이 아닙니다.',
  'auth/missing-email': '이메일을 입력해주세요.',
  'auth/missing-password': '비밀번호를 입력해주세요.',
  // 이메일 노출 방지 설정에서는 계정 없음/비밀번호 틀림이 모두 invalid-credential로 옴
  'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'auth/user-not-found': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'auth/wrong-password': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'auth/user-disabled': '사용이 중지된 계정입니다.',
  'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인해주세요.',
  'auth/weak-password': '비밀번호는 최소 6자 이상이어야 합니다.',
  'auth/too-many-requests': '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.',
  'auth/network-request-failed': '네트워크 연결을 확인해주세요.',
};

export const getAuthErrorMessage = (error) =>
  AUTH_ERROR_MESSAGES[error?.code] || '문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
