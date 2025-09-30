// js/firebaseConfig.js
(function(){
  const firebaseConfig = {
    apiKey: "AIzaSyCy3fmE6jjoju1u5Zv6PQbSuHq6718zNcE",
    authDomain: "trulymarket-c25b6.firebaseapp.com",
    projectId: "trulymarket-c25b6",
    storageBucket: "trulymarket-c25b6.firebasestorage.app",
    messagingSenderId: "810610286008",
    appId: "1:810610286008:web:847f3bc2c441e103a1434d",
    measurementId: "G-KWN9XQD8K5"
  };
  firebase.initializeApp(firebaseConfig);
  window.db = firebase.firestore();
})();
