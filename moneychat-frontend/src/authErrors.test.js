import { getAuthErrorMessage } from './authErrors';

test('계정 없음과 비밀번호 틀림은 같은 안내로 처리', () => {
  const message = '이메일 또는 비밀번호가 올바르지 않습니다.';
  expect(getAuthErrorMessage({ code: 'auth/invalid-credential' })).toBe(message);
  expect(getAuthErrorMessage({ code: 'auth/user-not-found' })).toBe(message);
  expect(getAuthErrorMessage({ code: 'auth/wrong-password' })).toBe(message);
});

test('모르는 에러는 영어 원문 대신 한국어 기본 안내', () => {
  expect(getAuthErrorMessage({ code: 'auth/something-new', message: 'Firebase: Error' })).toBe('문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
  expect(getAuthErrorMessage(undefined)).toBe('문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
});
