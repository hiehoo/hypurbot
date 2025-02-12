const fetch = require("node-fetch");

const BOT_TOKEN = "7539603131:AAG6jNQoxc3BQ1bDVuOT9XEVKTpWB0zytmw";

async function getChatId() {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    const data = await response.json();

    if (data.ok && data.result.length > 0) {
        console.log("Your Chat ID:", data.result[0].message.chat.id);
    } else {
        console.log("No messages found. Send a message to your bot first.");
    }
}

getChatId();