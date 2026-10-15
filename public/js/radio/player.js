const MASTER_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8';
// Chrome/Firefox's Media Source Extensions (used by hls.js) do not reliably
// decode FLAC-in-fMP4, so hls.js is pointed at the AAC variant directly.
// Only Safari's native (non-MSE) HLS player gets the lossless FLAC stream.
const AAC_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/hls/aac_hifi.m3u8';
const audio = document.getElementById('player');
const playButton = document.getElementById('playButton');
const statusEl = document.getElementById('status');
const volumeSlider = document.getElementById('volume');
const volumeLevel = document.getElementById('volumeLevel');
const timeDisplay = document.getElementById('timeDisplay');

let hls = null;
let isPlaying = false;

// The HLS stream is live — audio.currentTime/duration are live-buffer
// positions, not per-song values, and the stream exposes no song length.
// Elapsed time is tracked independently, reset whenever metadata polling
// detects the track has changed.
let trackElapsedBaseline = 0;
let trackResumedAt = null;

function trackElapsedSeconds() {
  if (trackResumedAt === null) return trackElapsedBaseline;
  return trackElapsedBaseline + (Date.now() - trackResumedAt) / 1000;
}

function resetTrackElapsed() {
  trackElapsedBaseline = 0;
  trackResumedAt = isPlaying ? Date.now() : null;
}

function updateStatus(message, className = '') {
  statusEl.textContent = message;
  statusEl.className = 'status ' + className;
}

function initializeStream() {
  updateStatus('Initializing stream...', 'loading');

  if (audio.canPlayType('application/vnd.apple.mpegurl') === 'probably') {
    audio.src = MASTER_URL;
    updateStatus('Ready (native HLS, lossless FLAC)', 'loading');
  } else if (Hls.isSupported()) {
    hls = new Hls({
      debug: true,
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
      maxBufferLength: 120
    });
    window.hls = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      updateStatus('Stream ready', 'loading');
      console.log('HLS manifest parsed, duration:', audio.duration);
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, () => {
      const levelDetails = hls.levels[hls.currentLevel];
      if (levelDetails) {
        updateStatus(`Playing (${levelDetails.name || 'HLS'})`, '');
        console.log('Level switched:', levelDetails);
      }
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      console.error('HLS error:', data.type, data.details, data.fatal, data);
      if (data.fatal) {
        switch(data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            updateStatus('Network error - retrying...', 'error');
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            updateStatus('Live stream advanced - reloading...', 'error');
            audio.currentTime = 0;
            hls.recoverMediaError();
            setTimeout(() => {
              hls.startLoad();
            }, 500);
            break;
          default:
            updateStatus('Stream error: ' + (data.response?.statusText || data.details || 'unknown'), 'error');
            break;
        }
      } else if (data.details === 'bufferStalledError') {
        console.warn('Buffer stalled (non-fatal):', data);
      }
    });

    hls.loadSource(AAC_URL);
    hls.attachMedia(audio);
    startStallWatchdog();
  } else {
    updateStatus('HLS not supported on this browser', 'error');
  }
}

let stallWatchdogTimer = null;
let lastPlaybackTime = -1;
let stalledTicks = 0;

function startStallWatchdog() {
  if (stallWatchdogTimer) clearInterval(stallWatchdogTimer);
  lastPlaybackTime = -1;
  stalledTicks = 0;

  stallWatchdogTimer = setInterval(() => {
    if (!isPlaying) return;

    if (audio.currentTime === lastPlaybackTime) {
      stalledTicks++;
      console.warn('Watchdog: playback appears stalled at', audio.currentTime, 'tick', stalledTicks);
      if (stalledTicks >= 2) {
        console.warn('Watchdog: reloading stream after stall');
        updateStatus('Playback stalled - reloading stream...', 'error');
        stalledTicks = 0;
        if (hls) {
          hls.loadSource(AAC_URL);
          hls.attachMedia(audio);
          audio.play().catch(err => console.error('Watchdog resume failed:', err));
        } else {
          audio.load();
          audio.play().catch(err => console.error('Watchdog resume failed:', err));
        }
      }
    } else {
      stalledTicks = 0;
    }
    lastPlaybackTime = audio.currentTime;
  }, 3000);
}

function togglePlayPause() {
  if (isPlaying) {
    audio.pause();
    playButton.textContent = '▶';
    updateStatus('Paused', '');
    isPlaying = false;
    trackElapsedBaseline = trackElapsedSeconds();
    trackResumedAt = null;
  } else {
    audio.play();
    playButton.textContent = '❙❙';
    updateStatus('Playing', 'playing');
    isPlaying = true;
    trackResumedAt = Date.now();
  }
}

function setVolume() {
  const vol = parseInt(volumeSlider.value);
  audio.volume = vol / 100;
  volumeLevel.textContent = vol + '%';
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

audio.addEventListener('play', () => {
  playButton.textContent = '❙❙';
  isPlaying = true;
  if (trackResumedAt === null) trackResumedAt = Date.now();
  if (statusEl.className.includes('loading')) {
    updateStatus('Playing', 'playing');
  }
});

audio.addEventListener('pause', () => {
  playButton.textContent = '▶';
  isPlaying = false;
  if (trackResumedAt !== null) {
    trackElapsedBaseline = trackElapsedSeconds();
    trackResumedAt = null;
  }
  if (!statusEl.textContent.includes('error')) {
    updateStatus('Paused', '');
  }
});

audio.addEventListener('timeupdate', () => {
  if (isPlaying) {
    timeDisplay.textContent = 'Elapsed: ' + formatTime(trackElapsedSeconds());
  }
});

setInterval(() => {
  if (isPlaying) {
    timeDisplay.textContent = 'Elapsed: ' + formatTime(trackElapsedSeconds());
  }
}, 1000);

audio.addEventListener('loadstart', () => {
  updateStatus('Loading stream...', 'loading');
});

audio.addEventListener('canplay', () => {
  if (!isPlaying) {
    updateStatus('Ready to play', 'loading');
  }
});

audio.addEventListener('error', (e) => {
  updateStatus('Audio error: ' + (e.target.error?.message || 'unknown'), 'error');
});
