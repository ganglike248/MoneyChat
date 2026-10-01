// /src/theme.js
// 라이트/다크 테마 관리
// - 처음에는 기기 설정을 따르고, 사용자가 메뉴에서 바꾸면 그 선택을 이 기기에 저장
// - 화면 깜빡임을 막기 위해 첫 적용은 public/index.html의 스크립트에서 먼저 실행됨
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'moneychat-theme';

// 브라우저 상단 바 색 (앱 헤더 색과 맞춤)
const THEME_COLORS = { light: '#ffffff', dark: '#2d3748' };

const darkQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

const getStoredTheme = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch (error) {
    return null;
  }
};

const getSystemTheme = () => (darkQuery?.matches ? 'dark' : 'light');

const applyTheme = (theme) => {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme; // 날짜 선택창, 스크롤바 등 기본 요소 색
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', THEME_COLORS[theme]);
  });
};

let currentTheme = getStoredTheme() || getSystemTheme();
const listeners = new Set();

const setTheme = (theme) => {
  currentTheme = theme;
  applyTheme(theme);
  listeners.forEach((listener) => listener());
};

applyTheme(currentTheme);

// 사용자가 직접 고르기 전까지는 기기 설정이 바뀌면 따라감
darkQuery?.addEventListener?.('change', () => {
  if (!getStoredTheme()) setTheme(getSystemTheme());
});

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const toggleTheme = () => {
  const next = currentTheme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (error) {
    // 저장하지 못해도 이번 방문 동안은 적용
  }
  setTheme(next);
};

export const useTheme = () => useSyncExternalStore(subscribe, () => currentTheme);
