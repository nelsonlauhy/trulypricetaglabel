// js/firebaseConfig.js (NO secrets)

async function getFirebaseConfig() {
  const res = await fetch("/.netlify/functions/firebase-config", { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error("Failed to load firebase config: " + res.status + " " + t);
  }
  return await res.json();
}

async function initFirebase() {
  const cfg = await getFirebaseConfig();

  if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(cfg);
  }

  // expose db for existing pages that use window.db
  window.db = firebase.firestore();
  return window.db;
}

// keep compatible: pages can call window.initFirebase()
window.initFirebase = initFirebase;

