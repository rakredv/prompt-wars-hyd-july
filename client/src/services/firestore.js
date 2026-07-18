import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, limit, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Helper to get user subcollection
const userCol = (uid, colName) => collection(db, 'users', uid, colName);

// ── Profiles ──────────────────────────────────────────────────────────────────
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) return snap.data();
  return null;
}

export async function setUserProfile(uid, data) {
  return setDoc(doc(db, 'users', uid), data, { merge: true });
}

// ── Health Data ───────────────────────────────────────────────────────────────
export async function getHealthData(uid, limitNum = 30) {
  const q = query(
    userCol(uid, 'health_data'),
    orderBy('recorded_at', 'desc'),
    limit(limitNum)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveHealthData(uid, dateStr, data) {
  return setDoc(doc(db, 'users', uid, 'health_data', dateStr), data, { merge: true });
}

// ── Insights ──────────────────────────────────────────────────────────────────
export async function getLatestInsight(uid) {
  const q = query(
    userCol(uid, 'insights'),
    where('insight_type', '==', 'daily_nudge'),
    orderBy('generated_at', 'desc'),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.docs.length ? snap.docs[0].data() : null;
}

export async function saveInsight(uid, data) {
  return addDoc(userCol(uid, 'insights'), data);
}

// ── Chat Messages ─────────────────────────────────────────────────────────────
export async function getChatHistory(uid, limitNum = 50) {
  const q = query(
    userCol(uid, 'chat_messages'),
    orderBy('created_at', 'asc'),
    limit(limitNum)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addChatMessage(uid, role, content) {
  return addDoc(userCol(uid, 'chat_messages'), {
    role, content,
    created_at: new Date()
  });
}

export async function clearChatHistory(uid) {
  const snap = await getDocs(userCol(uid, 'chat_messages'));
  // In a real app, do this in batches or server-side. For hackathon, just fire and forget.
  snap.docs.forEach(d => updateDoc(d.ref, { deleted: true })); 
}

// ── Goals ─────────────────────────────────────────────────────────────────────
export async function getGoals(uid) {
  const snap = await getDocs(query(userCol(uid, 'goals'), orderBy('created_at', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addGoal(uid, data) {
  return addDoc(userCol(uid, 'goals'), { ...data, created_at: new Date() });
}

export async function updateGoal(uid, goalId, data) {
  return updateDoc(doc(db, 'users', uid, 'goals', goalId), data);
}

// ── Nudges ────────────────────────────────────────────────────────────────────
export async function getNudges(uid) {
  const q = query(
    userCol(uid, 'nudges'),
    orderBy('created_at', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function markNudgesRead(uid) {
  const snap = await getDocs(query(userCol(uid, 'nudges'), where('is_read', '==', 0)));
  snap.docs.forEach(d => updateDoc(d.ref, { is_read: 1 }));
}
