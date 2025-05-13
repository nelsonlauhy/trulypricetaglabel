const fetch = require("node-fetch");

exports.handler = async (event) => {
  try {
    const { text } = JSON.parse(event.body);
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "en",
        target: "zh-TW",
        format: "text"
      })
    });

    const data = await response.json();
    console.log("Google Translate raw response:", JSON.stringify(data));

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Translation failed", detail: error.message })
    };
  }
};
