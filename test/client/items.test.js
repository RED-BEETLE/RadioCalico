const { loadPage, jsonResponse } = require('../helpers/loadScripts');

let page;
const load = (fetch) => {
  page = loadPage('index.html', ['js/index.js'], { fetch });
  return page;
};

afterEach(() => page?.close());

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('index.js', () => {
  test('escapeHtml neutralises markup', () => {
    load(vi.fn().mockResolvedValue(jsonResponse([])));
    expect(page.run(`escapeHtml('<b>"x" & y</b>')`)).toBe('&lt;b&gt;"x" &amp; y&lt;/b&gt;');
  });

  test('loadItems shows the empty state', async () => {
    load(vi.fn().mockResolvedValue(jsonResponse([])));
    await flush();
    const container = page.document.getElementById('itemsContainer');
    expect(container.textContent).toContain('No items yet');
    expect(container.className).toBe('empty-state');
  });

  test('loadItems renders items with escaped content', async () => {
    const items = [{ id: 7, name: '<script>x</script>', description: 'd', created_at: '2024-01-01 10:00:00' }];
    load(vi.fn().mockResolvedValue(jsonResponse(items)));
    await flush();
    const container = page.document.getElementById('itemsContainer');
    expect(container.querySelectorAll('.item')).toHaveLength(1);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('.item-name').textContent).toBe('<script>x</script>');
    expect(container.querySelector('.item-delete').getAttribute('onclick')).toBe('deleteItem(7)');
  });

  test('addItem rejects an empty name without calling the API', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse([]));
    load(fetch);
    await flush();
    const alertSpy = vi.fn();
    page.window.alert = alertSpy;
    fetch.mockClear();
    await page.run('addItem()');
    expect(alertSpy).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('addItem posts trimmed values, clears the form and reloads the list', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse([]));
    load(fetch);
    await flush();
    fetch.mockClear();
    page.document.getElementById('itemName').value = '  Foo ';
    page.document.getElementById('itemDescription').value = ' Bar ';
    await page.run('addItem()');
    await flush();

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/items');
    expect(JSON.parse(options.body)).toEqual({ name: 'Foo', description: 'Bar' });
    expect(page.document.getElementById('itemName').value).toBe('');
    expect(page.document.getElementById('itemDescription').value).toBe('');
    // second call is the list reload
    expect(fetch.mock.calls[1][0]).toBe('/api/items');
  });

  test('deleteItem does nothing when the user cancels', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse([]));
    load(fetch);
    await flush();
    page.window.confirm = () => false;
    fetch.mockClear();
    await page.run('deleteItem(3)');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('deleteItem sends DELETE when confirmed', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse([]));
    load(fetch);
    await flush();
    fetch.mockClear();
    await page.run('deleteItem(3)');
    expect(fetch.mock.calls[0]).toEqual(['/api/items/3', { method: 'DELETE' }]);
  });
});
