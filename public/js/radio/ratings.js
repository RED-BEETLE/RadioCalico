const thumbsUpButton = document.getElementById('thumbsUpButton');
const thumbsDownButton = document.getElementById('thumbsDownButton');
const thumbsUpCountEl = document.getElementById('thumbsUpCount');
const thumbsDownCountEl = document.getElementById('thumbsDownCount');

function getClientId() {
  let id = localStorage.getItem('radiocalico_client_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('radiocalico_client_id', id);
  }
  return id;
}
const clientId = getClientId();

function updateRatingDisplay(counts) {
  thumbsUpCountEl.textContent = counts.thumbs_up ?? 0;
  thumbsDownCountEl.textContent = counts.thumbs_down ?? 0;
  thumbsUpButton.classList.toggle('active', counts.voted === 'up');
  thumbsDownButton.classList.toggle('active', counts.voted === 'down');
  thumbsUpButton.disabled = !!counts.voted;
  thumbsDownButton.disabled = !!counts.voted;
}

async function refreshRatings(meta) {
  thumbsUpButton.disabled = false;
  thumbsDownButton.disabled = false;
  thumbsUpButton.classList.remove('active');
  thumbsDownButton.classList.remove('active');
  if (!meta.artist || !meta.title) return;
  try {
    const params = new URLSearchParams({ artist: meta.artist, title: meta.title, client_id: clientId });
    const response = await fetch('/api/ratings?' + params.toString());
    if (!response.ok) throw new Error('ratings fetch failed: ' + response.status);
    updateRatingDisplay(await response.json());
  } catch (error) {
    console.error('Error fetching ratings:', error);
  }
}

async function rateTrack(rating) {
  if (!lastMeta || !lastMeta.artist || !lastMeta.title) return;
  try {
    const response = await fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist: lastMeta.artist, title: lastMeta.title, rating, client_id: clientId })
    });
    if (response.status === 409) {
      // Already voted (e.g. duplicate click) - resync display from server state.
      refreshRatings(lastMeta);
      return;
    }
    if (!response.ok) throw new Error('rating post failed: ' + response.status);
    updateRatingDisplay(await response.json());
  } catch (error) {
    console.error('Error submitting rating:', error);
  }
}
