// services/firestore.js — All Firestore read/write operations
// Each user's data is namespaced under users/{uid}/ for security
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, setDoc, getDoc
} from 'firebase/firestore';
import { db } from '../firebase';

// ── Helpers ──────────────────────────────────────────────────────────────────
const userCol = (uid, col) => collection(db, 'users', uid, col);
const userDoc = (uid, col, id) => doc(db, 'users', uid, col, id);

// ── User Profile ──────────────────────────────────────────────────────────────
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'profile', 'data'));
  return snap.exists() ? snap.data() : null;
}

export async function setUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid, 'profile', 'data'), data, { merge: true });
}

// ── Health Data ───────────────────────────────────────────────────────────────
export async function getHealthData(uid, demoMode, limitNum = 30) {
  const q = query(
    userCol(uid, 'health_data'),
    where('is_demo', '==', demoMode ? 1 : 0),
    orderBy('recorded_at', 'desc'),
    limit(limitNum)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addHealthData(uid, data) {
  return addDoc(userCol(uid, 'health_data'), {
    ...data,
    created_at: serverTimestamp(),
  });
}

// ── Insights ──────────────────────────────────────────────────────────────────
export async function getLatestInsight(uid, demoMode) {
  const q = query(
    userCol(uid, 'insights'),
    where('insight_type', '==', 'daily_nudge'),
    where('is_demo', '==', demoMode ? 1 : 0),
    orderBy('generated_at', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function saveInsight(uid, data) {
  return addDoc(userCol(uid, 'insights'), {
    ...data,
    generated_at: serverTimestamp(),
  });
}

// ── Chat Messages ─────────────────────────────────────────────────────────────
export async function getChatHistory(uid, demoMode) {
  const q = query(
    userCol(uid, 'chat_messages'),
    where('is_demo', '==', demoMode ? 1 : 0),
    orderBy('created_at', 'asc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addChatMessage(uid, role, content, demoMode) {
  return addDoc(userCol(uid, 'chat_messages'), {
    role, content,
    is_demo: demoMode ? 1 : 0,
    created_at: serverTimestamp(),
  });
}

export async function clearChatHistory(uid, demoMode) {
  const q = query(
    userCol(uid, 'chat_messages'),
    where('is_demo', '==', demoMode ? 1 : 0)
  );
  const snap = await getDocs(q);
  const deletes = snap.docs.map(d => deleteDoc(d.ref));
  return Promise.all(deletes);
}

// ── Goals ─────────────────────────────────────────────────────────────────────
export async function getGoals(uid) {
  const q = query(
    userCol(uid, 'goals'),
    where('is_active', '==', 1),
    orderBy('created_at', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addGoal(uid, data) {
  return addDoc(userCol(uid, 'goals'), {
    ...data,
    streak_days: 0,
    is_active: 1,
    created_at: serverTimestamp(),
  });
}

export async function deleteGoal(uid, goalId) {
  return updateDoc(userDoc(uid, 'goals', goalId), { is_active: 0 });
}

// ── Nudges ────────────────────────────────────────────────────────────────────
export async function getNudges(uid) {
  const q = query(
    userCol(uid, 'nudges'),
    orderBy('created_at', 'desc'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addNudge(uid, content, isDemo = false) {
  return addDoc(userCol(uid, 'nudges'), {
    content,
    is_read: 0,
    is_demo: isDemo ? 1 : 0,
    created_at: serverTimestamp(),
  });
}

export async function markNudgeRead(uid, nudgeId) {
  return updateDoc(userDoc(uid, 'nudges', nudgeId), { is_read: 1 });
}
