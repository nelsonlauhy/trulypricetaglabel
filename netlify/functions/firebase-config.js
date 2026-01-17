exports.handler = async () => {
  const required = [
    "FB_API_KEY",
    "FB_AUTH_DOMAIN",
    "FB_PROJECT_ID",
    "FB_STORAGE_BUCKET",
    "FB_MESSAGING_SENDER_ID",
    "FB_APP_ID"
  ];

  for (const k of required) {
    if (!process.env[k]) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: `Missing env var: ${k}` })
      };
    }
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify({
      apiKey: process.env.FB_API_KEY,
      authDomain: process.env.FB_AUTH_DOMAIN,
      projectId: process.env.FB_PROJECT_ID,
      storageBucket: process.env.FB_STORAGE_BUCKET,
      messagingSenderId: process.env.FB_MESSAGING_SENDER_ID,
      appId: process.env.FB_APP_ID,
      measurementId: process.env.FB_MEASUREMENT_ID || ""
    })
  };
};
