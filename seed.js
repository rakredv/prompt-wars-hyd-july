require('dotenv').config();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

async function run() {
  let firebaseAdminApp;
  if (!getApps().length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      let rawJson = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      if (rawJson.startsWith("'") && rawJson.endsWith("'")) rawJson = rawJson.slice(1, -1);
      const serviceAccount = JSON.parse(rawJson);
      firebaseAdminApp = initializeApp({ credential: cert(serviceAccount) });
    } else {
      console.error('No FIREBASE_SERVICE_ACCOUNT found in .env');
      process.exit(1);
    }
  }

  const auth = getAuth();
  const listUsers = await auth.listUsers(1);
  if (listUsers.users.length === 0) {
    console.error('No users found in Firebase Auth to seed data for.');
    process.exit(1);
  }
  const uid = listUsers.users[0].uid;
  console.log(`Seeding data for user: ${uid} (${listUsers.users[0].email})`);

  const db = getFirestore();
  const colRef = db.collection('users').doc(uid).collection('health_data');

  const batch = db.batch();
  const today = new Date();
  
  // Create 14 days of realistic data
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Weekend vs Weekday
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    
    const docRef = colRef.doc(dateStr);
    batch.set(docRef, {
      date: dateStr,
      recorded_at: d.toISOString(),
      screen_time_minutes: isWeekend ? 350 + Math.floor(Math.random()*120) : 220 + Math.floor(Math.random()*90),
      steps: isWeekend ? 4000 + Math.floor(Math.random()*3000) : 8000 + Math.floor(Math.random()*4000),
      sleep_hours: isWeekend ? 8 + Math.random() : 6 + Math.random()*1.5,
      heart_rate_avg: 65 + Math.floor(Math.random()*10),
      active_energy_kcal: isWeekend ? 200 + Math.floor(Math.random()*200) : 400 + Math.floor(Math.random()*300),
      mindful_minutes: Math.random() > 0.5 ? Math.floor(Math.random()*20) : 0,
      created_at: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  console.log('✅ Successfully seeded 14 days of data!');
  process.exit(0);
}

run().catch(console.error);
