const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(cors());
app.use(express.json());

// Set GNews API Key from environment variable or direct string
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || 'f79c4c065fb03cc88219a01a034950c3';

// Initialize SQLite DB
const db = new sqlite3.Database('./database.db', (err) => {
  if (!err) {
    console.log('Database connected.');
    db.run(`CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      coins REAL DEFAULT 0,
      ip_address TEXT,
      last_claimed INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      amount REAL,
      method TEXT,
      payout_details TEXT,
      status TEXT DEFAULT 'PENDING'
    )`);
  }
});

// 1. Fetch Live News from GNews API
app.get('/api/news', async (req, res) => {
  try {
    const category = req.query.category || 'technology';
    const gnewsUrl = `https://gnews.io/api/v4/top-headlines?category=${category}&lang=en&max=10&apikey=${GNEWS_API_KEY}`;
    
    const response = await fetch(gnewsUrl);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.errors || 'Failed to fetch news' });
    }

    res.json(data.articles || []);
  } catch (error) {
    res.status(500).json({ error: 'Server error while fetching news' });
  }
});

// 2. Get User Balance
app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, row) => {
    if (!row) {
      db.run('INSERT INTO users (user_id, coins, ip_address) VALUES (?, ?, ?)', 
        [userId, 0, req.ip], () => {
          res.json({ user_id: userId, coins: 0 });
        });
    } else {
      res.json(row);
    }
  });
});

// 3. Claim Reward for Reading News (Anti-Cheat Server Logic)
app.post('/api/reward/news', (req, res) => {
  const { userId, timeSpentSeconds } = req.body;

  // Anti-Cheat: Minimum 15 seconds reading required
  if (timeSpentSeconds < 15) {
    return res.status(400).json({ error: 'Cheat detected: Read time too short!' });
  }

  db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, user) => {
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Date.now();
    // Anti-Cheat: Cooldown check between claims
    if (now - user.last_claimed < 15000) {
      return res.status(429).json({ error: 'Claiming too fast! Please slow down.' });
    }

    const reward = 1.5; // Earn 1.5 coins per read
    const newBalance = user.coins + reward;

    db.run('UPDATE users SET coins = ?, last_claimed = ? WHERE user_id = ?', 
      [newBalance, now, userId], 
      (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, coins: newBalance, added: reward });
      }
    );
  });
});

// 4. Withdraw Request (Min 50 Coins)
app.post('/api/withdraw', (req, res) => {
  const { userId, amount, method, payoutDetails } = req.body;

  if (amount < 50) {
    return res.status(400).json({ error: 'Minimum withdrawal amount is 50 coins!' });
  }

  db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, user) => {
    if (!user || user.coins < amount) {
      return res.status(400).json({ error: 'Insufficient coin balance.' });
    }

    const newBalance = user.coins - amount;

    db.run('UPDATE users SET coins = ? WHERE user_id = ?', [newBalance, userId], (err) => {
      db.run('INSERT INTO withdrawals (user_id, amount, method, payout_details) VALUES (?, ?, ?, ?)',
        [userId, amount, method, payoutDetails],
        () => {
          res.json({ success: true, newBalance, message: 'Withdrawal requested successfully!' });
        }
      );
    });
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
