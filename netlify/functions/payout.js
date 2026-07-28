const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase & Telegram using Environment Variables
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId, method, details, amount } = JSON.parse(event.body);

    if (!userId || !method || !details || amount < 50) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid payout request or below 50 minimum.' })
      };
    }

    // 1. Save Request in Supabase Database
    const { data, error } = await supabase
      .from('payout_requests')
      .insert([{ user_id: userId, method, account_details: details, amount }]);

    if (error) throw error;

    // 2. Send Telegram DM Alert
    const messageText = 
`🚨 *NEW PAYOUT REQUEST* 🚨

👤 *User ID:* \`${userId}\`
💳 *Method:* ${method}
📱 *Account:* \`${details}\`
💰 *Amount Requested:* ${amount} Coins
⏰ *Time:* ${new Date().toLocaleString()}`;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: messageText,
        parse_mode: 'Markdown'
      })
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Payout requested successfully!' })
    };

  } catch (err) {
    console.error('Payout Function Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error processing request.' })
    };
  }
};
