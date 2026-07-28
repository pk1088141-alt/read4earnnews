const API_BASE = 'http://localhost:3000/api';
let userId = localStorage.getItem('user_id') || 'user_' + Math.random().toString(36).substring(2, 9);
localStorage.setItem('user_id', userId);

let timerInterval = null;
let readingTimeSpent = 0;
let isTabActive = true;

// Tab Switch Detection (Anti-Cheat)
document.addEventListener('visibilitychange', () => {
  isTabActive = !document.hidden;
});

// Load Current User Balance
async function loadUserData() {
  try {
    const res = await fetch(`${API_BASE}/user/${userId}`);
    const data = await res.json();
    document.getElementById('user-coins').innerText = data.coins.toFixed(1);
  } catch (e) {
    console.error('Error reaching backend server.');
  }
}

// Fetch Real Articles from Backend (Proxying GNews API)
async function fetchLiveNews() {
  const container = document.getElementById('news-container');
  const category = document.getElementById('news-category').value;
  container.innerHTML = `<p class="text-slate-400 text-sm">Fetching real-time news...</p>`;

  try {
    const res = await fetch(`${API_BASE}/news?category=${category}`);
    const articles = await res.json();

    if (!Array.isArray(articles) || articles.length === 0) {
      container.innerHTML = `<p class="text-rose-400 text-sm">Could not load news articles.</p>`;
      return;
    }

    container.innerHTML = '';
    articles.forEach((art, index) => {
      const card = document.createElement('article');
      card.className = "bg-slate-800 border border-slate-700/60 p-4 rounded-xl shadow-md space-y-3";
      
      card.innerHTML = `
        ${art.image ? `<img src="${art.image}" class="w-full h-40 object-cover rounded-lg" alt="News"/>` : ''}
        <h3 class="text-md font-bold text-white line-clamp-2">${art.title}</h3>
        <p class="text-slate-400 text-xs line-clamp-3">${art.description || 'Click to view full news story.'}</p>
        
        <div class="pt-2 border-t border-slate-700/50 flex justify-between items-center">
          <div id="timer-box-${index}" class="text-xs text-amber-400 hidden font-mono">
            ⏱️ Active reading: <span id="seconds-${index}">15</span>s left
          </div>
          <button id="read-btn-${index}" onclick="startReadingArticle(${index}, '${art.url}')" class="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition">
            Read & Earn (+1.5 Coins)
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML = `<p class="text-rose-400 text-sm">Error connecting to server.</p>`;
  }
}

// Handle Active Tab Reading Timer
function startReadingArticle(index, articleUrl) {
  window.open(articleUrl, '_blank');

  const btn = document.getElementById(`read-btn-${index}`);
  const timerBox = document.getElementById(`timer-box-${index}`);
  const timerText = document.getElementById(`seconds-${index}`);

  btn.disabled = true;
  btn.classList.add('opacity-50', 'cursor-not-allowed');
  timerBox.classList.remove('hidden');

  readingTimeSpent = 0;
  const targetSeconds = 15;

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    // Only increment when tab is active
    if (isTabActive) {
      readingTimeSpent++;
      let remaining = targetSeconds - readingTimeSpent;
      timerText.innerText = remaining > 0 ? remaining : 0;

      if (readingTimeSpent >= targetSeconds) {
        clearInterval(timerInterval);
        claimReward(readingTimeSpent);
      }
    }
  }, 1000);
}

// Submit Claim Request
async function claimReward(timeSpent) {
  try {
    const res = await fetch(`${API_BASE}/reward/news`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, timeSpentSeconds: timeSpent })
    });

    const data = await res.json();
    if (res.ok) {
      alert(`🎉 Earned ${data.added} Coins!`);
      loadUserData();
    } else {
      alert(`❌ Claim error: ${data.error}`);
    }
  } catch (e) {
    alert('Server communication error.');
  }
}

// Submit Withdrawal
async function handleWithdraw(e) {
  e.preventDefault();
  const method = document.getElementById('pay-method').value;
  const payoutDetails = document.getElementById('pay-details').value;
  const amount = parseFloat(document.getElementById('pay-amount').value);

  if (amount < 50) {
    alert('Minimum withdrawal requirement is 50 Coins!');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amount, method, payoutDetails })
    });

    const data = await res.json();
    if (res.ok) {
      alert('✅ Withdrawal requested successfully!');
      loadUserData();
    } else {
      alert(`❌ Error: ${data.error}`);
    }
  } catch (e) {
    alert('Failed to submit withdrawal request.');
  }
}

// Start app
loadUserData();
fetchLiveNews();
