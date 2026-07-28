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
    const { userId, type } = JSON.parse(event.body || '{}');

    if (!userId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ success: false, message: 'User ID is required' }) 
      };
    }

    let rewardAmount = 0.2; // Standard read reward
    if (type === 'daily_bonus') rewardAmount = 1.0;

    // Fetch existing user record
    let { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Fetch Error:', fetchError);
      return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Database fetch failed' }) };
    }

    // If user doesn't exist, create them
    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{ user_id: userId, coins: 0.0 }])
        .select()
        .single();

      if (createError) {
        console.error('Create Error:', createError);
        return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Could not create user record' }) };
      }
      user = newUser;
    }

    // Check daily bonus 24hr constraint
    if (type === 'daily_bonus') {
      const lastClaim = user.last_daily_bonus ? new Date(user.last_daily_bonus) : null;
      const today = new Date().toDateString();

      if (lastClaim && lastClaim.toDateString() === today) {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ success: false, message: 'Daily bonus already claimed today!' }) 
        };
      }
    }

    // Calculate new total safely (ensuring numerical conversion)
    const currentCoins = parseFloat(user.coins || 0);
    const newCoins = parseFloat((currentCoins + rewardAmount).toFixed(2));

    // Prepare update payload
    const updateData = { coins: newCoins };
    if (type === 'daily_bonus') {
      updateData.last_daily_bonus = new Date().toISOString();
    }

    // Update in Supabase
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError || !updatedUser) {
      console.error('Update Error:', updateError);
      return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Failed to update coins in DB' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        reward: rewardAmount, 
        newBalance: updatedUser.coins 
      })
    };

  } catch (err) {
    console.error('Server Catch Error:', err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ success: false, message: 'Server processing error' }) 
    };
  }
};
