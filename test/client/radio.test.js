const { loadPage, jsonResponse, RADIO_SCRIPTS } = require('../helpers/loadScripts');

let page;
const load = (fetch) => {
  page = loadPage('radio.html', RADIO_SCRIPTS, { fetch });
  return page;
};

afterEach(() => {
  page?.close();
  vi.useRealTimers();
});

describe('player.js', () => {
  test.each([
    [0, '00:00'],
    [5, '00:05'],
    [65, '01:05'],
    [3600, '60:00'],
    [-1, '--:--'],
    [Infinity, '--:--'],
    [NaN, '--:--'],
  ])('formatTime(%s) = %s', (seconds, expected) => {
    load();
    expect(page.run(`formatTime(${seconds})`)).toBe(expected);
  });

  test('elapsed time counts only while playing and resets on a new track', () => {
    vi.useFakeTimers();
    load();
    // The scripts run in jsdom's own realm; give it the faked Date.
    page.window.Date = Date;
    expect(page.run('trackElapsedSeconds()')).toBe(0);

    page.run('isPlaying = true; resetTrackElapsed();');
    vi.advanceTimersByTime(5000);
    expect(page.run('trackElapsedSeconds()')).toBeCloseTo(5, 1);

    page.document.getElementById('player').dispatchEvent(new page.window.Event('pause'));
    vi.advanceTimersByTime(5000);
    expect(page.run('trackElapsedSeconds()')).toBeCloseTo(5, 1);

    page.run('resetTrackElapsed()');
    expect(page.run('trackElapsedSeconds()')).toBe(0);
  });

  test('setVolume updates audio volume and label', () => {
    load();
    page.document.getElementById('volume').value = '40';
    page.run('setVolume()');
    expect(page.document.getElementById('player').volume).toBeCloseTo(0.4);
    expect(page.document.getElementById('volumeLevel').textContent).toBe('40%');
  });
});

describe('ratings.js', () => {
  test('getClientId generates once and persists in localStorage', () => {
    load();
    const first = page.run('getClientId()');
    expect(first).toBeTruthy();
    expect(page.window.localStorage.getItem('radiocalico_client_id')).toBe(first);
    expect(page.run('getClientId()')).toBe(first);
  });

  test('updateRatingDisplay shows counts and locks buttons once voted', () => {
    load();
    page.run(`updateRatingDisplay({ thumbs_up: 3, thumbs_down: 1, voted: 'up' })`);
    const { document } = page;
    expect(document.getElementById('thumbsUpCount').textContent).toBe('3');
    expect(document.getElementById('thumbsDownCount').textContent).toBe('1');
    expect(document.getElementById('thumbsUpButton').classList.contains('active')).toBe(true);
    expect(document.getElementById('thumbsDownButton').classList.contains('active')).toBe(false);
    expect(document.getElementById('thumbsUpButton').disabled).toBe(true);
    expect(document.getElementById('thumbsDownButton').disabled).toBe(true);
  });

  test('updateRatingDisplay leaves buttons enabled when not voted', () => {
    load();
    page.run(`updateRatingDisplay({ thumbs_up: 0, thumbs_down: 0, voted: null })`);
    expect(page.document.getElementById('thumbsUpButton').disabled).toBe(false);
  });

  test('refreshRatings requests counts with the client id', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ thumbs_up: 2, thumbs_down: 0, voted: null }));
    load(fetch);
    await page.run(`refreshRatings({ artist: 'A B', title: 'T' })`);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('/api/ratings?');
    expect(url).toContain('artist=A+B');
    expect(url).toContain('client_id=');
    expect(page.document.getElementById('thumbsUpCount').textContent).toBe('2');
  });

  test('refreshRatings skips the request when the track has no artist/title', async () => {
    const fetch = vi.fn();
    load(fetch);
    await page.run(`refreshRatings({})`);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('rateTrack posts the vote and updates the display', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ thumbs_up: 1, thumbs_down: 0, voted: 'up' }));
    load(fetch);
    page.run(`lastMeta = { artist: 'A', title: 'T' }`);
    await page.run(`rateTrack('up')`);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/ratings');
    expect(JSON.parse(options.body)).toMatchObject({ artist: 'A', title: 'T', rating: 'up' });
    expect(page.document.getElementById('thumbsUpButton').disabled).toBe(true);
  });

  test('rateTrack does nothing before any track metadata is known', async () => {
    const fetch = vi.fn();
    load(fetch);
    await page.run(`rateTrack('up')`);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('rateTrack resyncs from the server on 409', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'dup' }, 409))
      .mockResolvedValueOnce(jsonResponse({ thumbs_up: 4, thumbs_down: 0, voted: 'up' }));
    load(fetch);
    page.run(`lastMeta = { artist: 'A', title: 'T' }`);
    await page.run(`rateTrack('down')`);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[1][0]).toContain('/api/ratings?');
    await vi.waitFor(() =>
      expect(page.document.getElementById('thumbsUpCount').textContent).toBe('4')
    );
  });
});

describe('metadata.js', () => {
  test('trackKey combines artist and title, tolerating missing fields', () => {
    load();
    expect(page.run(`trackKey({ artist: 'A', title: 'T' })`)).toBe('A - T');
    expect(page.run(`trackKey({})`)).toBe(' - ');
  });

  test('pollMetadata renders the track and queues the previous one on change', async () => {
    const metas = [
      { artist: 'A1', title: 'T1', album: 'Alb', date: '2020', bit_depth: 16, sample_rate: 44100 },
      { artist: 'A2', title: 'T2' },
    ];
    const fetch = vi.fn((url) => {
      if (url.includes('metadata.json')) return Promise.resolve(jsonResponse(metas.shift()));
      return Promise.resolve(jsonResponse({ thumbs_up: 0, thumbs_down: 0, voted: null }));
    });
    load(fetch);

    await page.run('pollMetadata()');
    const { document } = page;
    expect(document.getElementById('trackTitle').textContent).toBe('T1');
    expect(document.getElementById('trackAlbum').textContent).toBe('Alb • 2020');
    expect(document.getElementById('sourceQuality').textContent).toBe('Source quality: 16-bit / 44.1kHz');
    expect(document.querySelectorAll('#previousTracksList li:not(.empty-message)')).toHaveLength(0);

    await page.run('pollMetadata()');
    expect(document.getElementById('trackTitle').textContent).toBe('T2');
    const items = document.querySelectorAll('#previousTracksList li');
    expect(items[0].textContent).toBe('A1 - T1');
  });

  test('pollMetadata does not queue a previous track when the track is unchanged', async () => {
    const fetch = vi.fn((url) =>
      Promise.resolve(
        url.includes('metadata.json')
          ? jsonResponse({ artist: 'A', title: 'T' })
          : jsonResponse({ thumbs_up: 0, thumbs_down: 0, voted: null })
      )
    );
    load(fetch);
    await page.run('pollMetadata()');
    await page.run('pollMetadata()');
    expect(page.document.querySelectorAll('#previousTracksList li:not(.empty-message)')).toHaveLength(0);
  });

  test('pollMetadata survives a failed request', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    load(vi.fn().mockRejectedValue(new Error('offline')));
    await expect(page.run('pollMetadata()')).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
