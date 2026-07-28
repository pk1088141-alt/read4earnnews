const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId, type, articleUrl } = JSON.parse(event.body);

    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ message: 'User ID required' }) };
    }

    let rewardAmount = 0.2; // Default article reward
    if (type === 'daily_bonus') rewardAmount = 1.0;

    // Fetch user or create if not exists
    let { data: user } = await supabase.from('users').select('*').eq('user_id', userId).single();

    if (!user) {
      const { data: newUser } = await supabase.from('users').insert([{ user_id: userId, coins: 0 }]).select().single();
      user = newUser;
    }

    // Check if daily bonus already claimed today
    if (type === 'daily_bonus') {
      const lastClaim = user.last_daily_bonus ? new Date(user.last_daily_bonus) : null;
      const today = new Date().toDateString();

      if (lastClaim && lastClaim.toDateString() === today) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Daily bonus already claimed today!' }) };
      }

      await supabase.from('users').update({ 
        coins: user.coins + rewardAmount, 
        last_daily_bonus: new Date().toISOString() 
      }).eq('user_id', userId);

    } else {
      // Reward standard article read
      await supabase.from('users').update({ coins: user.coins + rewardAmount }).eq('user_id', userId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, reward: rewardAmount, newBalance: user.coins + rewardAmount })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Server error processing reward' }) };
  }
};
