const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('.')); // Serves index.html from current folder

// --- TELEGRAM CONFIGURATION ---
const BOT_TOKEN = '8673971356:AAEfDg8fmUmnNlO5HzICxXYU0m8bQ1KAcu4
'; // From @BotFather
const TELEGRAM_CHAT_ID = '7069045254';   // From @userinfobot

// In-Memory Database (Replace with MongoDB/Firebase in production)
const usersDB = {};

// Reward & Rate-Limit Settings
const REWARD_CONFIG = {
    article_read: { amount: 1.5, cooldownMs: 30000 },  // 30s cooldown
    sponsor_offer: { amount: 2.0, cooldownMs: 60000 }  // 60s cooldown
};

// Send Direct Message to Telegram
async function sendTelegramAlert(messageText) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: messageText,
                parse_mode: 'Markdown'
            })
        });
    } catch (err) {
        console.error('Telegram notification error:', err);
    }
}

// 1. API: Securely Credit Reward
app.post('/api/claim-reward', (req, res) => {
    const { userId, rewardType } = req.body;

    if (!userId || !REWARD_CONFIG[rewardType]) {
        return res.status(400).json({ message: "Invalid reward request." });
    }

    if (!usersDB[userId]) {
        usersDB[userId] = { balance: 0.0, lastClaimTime: 0 };
    }

    const user = usersDB[userId];
    const config = REWARD_CONFIG[rewardType];
    const now = Date.now();

    // Enforce cooldown check on server
    if (now - user.lastClaimTime < config.cooldownMs) {
        const remainingSecs = Math.ceil((config.cooldownMs - (now - user.lastClaimTime)) / 1000);
        return res.status(429).json({ message: `Cooldown active! Please wait ${remainingSecs} seconds.` });
    }

    user.balance += config.amount;
    user.lastClaimTime = now;

    return res.json({
        success: true,
        earned: config.amount,
        newBalance: user.balance
    });
});

// 2. API: Process Withdrawal & Send Telegram Alert
app.post('/api/request-payout', async (req, res) => {
    const { userId, withdrawMethod, accountDetails, amount } = req.body;
    const user = usersDB[userId];

    if (!user || user.balance < 50 || amount < 50) {
        return res.status(400).json({ message: "Minimum withdrawal requirement is 50 Coins." });
    }

    if (user.balance < amount) {
        return res.status(400).json({ message: "Insufficient account balance." });
    }

    // Deduct coins on server
    user.balance -= amount;

    // Send instant alert to Telegram
    const alertMessage = 
`🚨 *NEW WITHDRAWAL REQUEST* 🚨

👤 *User ID:* \`${userId}\`
💳 *Method:* ${withdrawMethod}
📱 *Account / UPI:* \`${accountDetails}\`
💰 *Amount Requested:* ${amount} Coins
🪙 *Remaining Balance:* ${user.balance} Coins
⏰ *Timestamp:* ${new Date().toLocaleString()}`;

    await sendTelegramAlert(alertMessage);

    return res.json({
        success: true,
        remainingBalance: user.balance
    });
});

app.listen(3000, () => {
    console.log('✅ NewsBuddy server running on http://localhost:3000');
});
