// /src/expenseRepository.js
// Firestore 지출 데이터 접근 (expenses/{uid}/userExpenses/{expenseId})
import { db, auth } from './firebase/firebaseConfig';
import { collection, doc, getDocs, query, where, orderBy, limit, Timestamp, writeBatch, updateDoc } from 'firebase/firestore';

export const LOGIN_REQUIRED_MESSAGE = "로그인이 필요한 서비스입니다.";

// 사용자에게 그대로 보여줄 메시지를 담은 에러
export class UserFacingError extends Error {
  constructor(userMessage) {
    super(userMessage);
    this.userMessage = userMessage;
  }
}

// 로그인한 사용자의 지출 컬렉션 참조
const getUserExpensesRef = () => {
  const user = auth.currentUser;
  if (!user) throw new UserFacingError(LOGIN_REQUIRED_MESSAGE);
  return collection(doc(db, 'expenses', user.uid), 'userExpenses');
};

// Firestore 문서를 화면에서 쓰는 형태로 변환 (timestamp → date)
const toExpense = (expenseDoc) => {
  const { timestamp, ...data } = expenseDoc.data();
  return { id: expenseDoc.id, ...data, date: timestamp.toDate() };
};

// 여러 지출을 한 번에 저장 (일부만 저장되는 일이 없도록 batch 사용)
export const addExpenses = async (expenses) => {
  const expensesRef = getUserExpensesRef();
  const batch = writeBatch(db);

  const ids = expenses.map(({ subject, category, amount, date }) => {
    const expenseRef = doc(expensesRef);
    batch.set(expenseRef, { subject, category, amount, timestamp: Timestamp.fromDate(date) });
    return expenseRef.id;
  });

  await batch.commit();
  return ids;
};

export const deleteExpenses = async (ids) => {
  const expensesRef = getUserExpensesRef();
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(expensesRef, id)));
  await batch.commit();
};

// 지출 수정 (date를 넘기면 날짜도 변경)
export const updateExpense = async (id, { date, ...fields }) => {
  const update = date ? { ...fields, timestamp: Timestamp.fromDate(date) } : fields;
  await updateDoc(doc(getUserExpensesRef(), id), update);
};

// 특정 시각 이후의 지출 (최신순)
export const fetchExpensesSince = async (startDate) => {
  const q = query(getUserExpensesRef(), where('timestamp', '>=', Timestamp.fromDate(startDate)), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(toExpense);
};

export const fetchRecentExpense = async () => {
  const q = query(getUserExpensesRef(), orderBy('timestamp', 'desc'), limit(1));
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : toExpense(snapshot.docs[0]);
};
