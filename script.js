const SUPABASE_URL = 'https://euhqeqqalrvluyzhuhlh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1aHFlcXFhbHJ2bHV5emh1aGxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NjQzNjksImV4cCI6MjEwMDQ0MDM2OX0.U3EbqQtmPy3bwJqg9DxogJUFBdKW3NRU0-Qnp-fabQU';                 // Replace with your anon key
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Function to claim coins for reading or sponsor offers
async function claimCoins(buttonElement, rewardType) {
    // 1. Immediately disable button to prevent multi-clicking
    buttonElement.disabled = true;
    const originalText = buttonElement.innerText;
    buttonElement.innerText = "Processing...";

    const userId = getUserId(); // Fetch your logged-in user ID or session ID

    try {
        // 2. Call your secure backend server (DO NOT update balance in frontend)
        const response = await fetch('/api/claim-reward', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, rewardType })
        });

        const data = await response.json();

        if (response.ok) {
            // Update balance on screen from server response
            document.getElementById('coin-balance').innerText = `${data.newBalance} Coins`;
            alert(`Success! You earned ${data.earned} coins.`);
        } else {
            alert(data.message || "Action not allowed.");
        }
    } catch (error) {
        console.error("Error claiming reward:", error);
        alert("Server error. Please try again later.");
    } finally {
        // 3. Enforce a local 30-second cooldown timer before re-enabling
        let secondsLeft = 30;
        const interval = setInterval(() => {
            buttonElement.innerText = `Wait (${secondsLeft}s)`;
            secondsLeft--;

            if (secondsLeft < 0) {
                clearInterval(interval);
                buttonElement.innerText = originalText;
                buttonElement.disabled = false;
            }
        }, 1000);
    }
}

// Attach listeners to your buttons
document.querySelectorAll('.read-earn-btn').forEach(btn => {
    btn.addEventListener('click', (e) => claimCoins(e.target, 'article_read'));
});

document.querySelector('#sponsor-btn')?.addEventListener('click', (e) => {
    claimCoins(e.target, 'sponsor_offer');
});
