const METADATA_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/metadata.json';
const COVER_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/cover.jpg';
const albumArt = document.getElementById('albumArt');
const trackTitleEl = document.getElementById('trackTitle');
const trackAlbumEl = document.getElementById('trackAlbum');
const sourceQualityEl = document.getElementById('sourceQuality');
const previousTracksList = document.getElementById('previousTracksList');

let lastTrackKey = null;
let lastMeta = null;

function trackKey(meta) {
  return `${meta.artist || ''} - ${meta.title || ''}`;
}

function addPreviousTrack(meta) {
  const emptyMessage = previousTracksList.querySelector('.empty-message');
  if (emptyMessage) emptyMessage.remove();

  const li = document.createElement('li');
  li.textContent = `${meta.artist || 'Unknown artist'} - ${meta.title || 'Unknown title'}`;
  previousTracksList.insertBefore(li, previousTracksList.firstChild);
}

async function pollMetadata() {
  try {
    const response = await fetch(METADATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('metadata fetch failed: ' + response.status);
    const meta = await response.json();

    const key = trackKey(meta);
    const trackChanged = lastTrackKey === null || key !== lastTrackKey;
    if (lastTrackKey !== null && key !== lastTrackKey) {
      addPreviousTrack(lastMeta);
    }
    lastTrackKey = key;
    lastMeta = meta;

    if (trackChanged) {
      refreshRatings(meta);
      resetTrackElapsed();
    }

    trackTitleEl.textContent = meta.title || 'Unknown title';
    trackAlbumEl.textContent = [meta.album, meta.date].filter(Boolean).join(' • ');
    if (meta.bit_depth && meta.sample_rate) {
      const khz = meta.sample_rate / 1000;
      sourceQualityEl.textContent = `Source quality: ${meta.bit_depth}-bit / ${khz}kHz`;
    }
    albumArt.src = COVER_URL + '?t=' + Date.now();
  } catch (error) {
    console.error('Error fetching metadata:', error);
  }
}
