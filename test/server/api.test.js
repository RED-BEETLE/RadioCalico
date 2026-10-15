const request = require('supertest');
const { createApp } = require('../../server');

let app, db;

beforeEach(async () => {
  const created = createApp(':memory:');
  ({ app, db } = created);
  await created.ready;
});

afterEach(() => new Promise((resolve) => db.close(resolve)));

describe('items', () => {
  test('creates, lists and deletes an item', async () => {
    const created = await request(app).post('/api/items').send({ name: 'Foo', description: 'Bar' });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ name: 'Foo', description: 'Bar' });

    const list = await request(app).get('/api/items');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('Foo');

    await request(app).delete(`/api/items/${created.body.id}`).expect(200, { success: true });
    expect((await request(app).get('/api/items')).body).toHaveLength(0);
  });

  test('description is optional', async () => {
    const res = await request(app).post('/api/items').send({ name: 'Only name' });
    expect(res.status).toBe(200);
  });

  test('rejects an item without a name', async () => {
    const res = await request(app).post('/api/items').send({ description: 'no name' });
    expect(res.status).toBe(500); // NOT NULL constraint; no explicit validation yet
  });
});

describe('GET /api/ratings', () => {
  test('requires artist and title', async () => {
    await request(app).get('/api/ratings').expect(400);
    await request(app).get('/api/ratings?artist=A').expect(400);
  });

  test('returns zero counts and no vote for an unknown track', async () => {
    const res = await request(app).get('/api/ratings?artist=A&title=T&client_id=c1');
    expect(res.body).toEqual({ thumbs_up: 0, thumbs_down: 0, voted: null });
  });
});

describe('POST /api/ratings', () => {
  const vote = (body) => request(app).post('/api/ratings').send(body);

  test.each([
    [{ title: 'T', rating: 'up', client_id: 'c1' }],
    [{ artist: 'A', rating: 'up', client_id: 'c1' }],
    [{ artist: 'A', title: 'T', rating: 'up' }],
    [{ artist: 'A', title: 'T', rating: 'sideways', client_id: 'c1' }],
  ])('returns 400 for invalid body %j', async (body) => {
    await vote(body).expect(400);
  });

  test('records an up vote and reports it back', async () => {
    const res = await vote({ artist: 'A', title: 'T', rating: 'up', client_id: 'c1' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ thumbs_up: 1, thumbs_down: 0, voted: 'up' });

    const get = await request(app).get('/api/ratings?artist=A&title=T&client_id=c1');
    expect(get.body).toEqual({ thumbs_up: 1, thumbs_down: 0, voted: 'up' });
  });

  test('a second vote from the same client returns 409 and leaves counts unchanged', async () => {
    await vote({ artist: 'A', title: 'T', rating: 'up', client_id: 'c1' });
    await vote({ artist: 'A', title: 'T', rating: 'down', client_id: 'c1' }).expect(409);

    const get = await request(app).get('/api/ratings?artist=A&title=T&client_id=c1');
    expect(get.body).toEqual({ thumbs_up: 1, thumbs_down: 0, voted: 'up' });
  });

  test('different clients accumulate counts and see only their own vote', async () => {
    await vote({ artist: 'A', title: 'T', rating: 'up', client_id: 'c1' });
    await vote({ artist: 'A', title: 'T', rating: 'down', client_id: 'c2' });

    const c1 = await request(app).get('/api/ratings?artist=A&title=T&client_id=c1');
    const c2 = await request(app).get('/api/ratings?artist=A&title=T&client_id=c2');
    const anon = await request(app).get('/api/ratings?artist=A&title=T');
    expect(c1.body).toEqual({ thumbs_up: 1, thumbs_down: 1, voted: 'up' });
    expect(c2.body.voted).toBe('down');
    expect(anon.body.voted).toBeNull();
  });

  test('the same client can vote on a different track', async () => {
    await vote({ artist: 'A', title: 'T1', rating: 'up', client_id: 'c1' }).expect(200);
    await vote({ artist: 'A', title: 'T2', rating: 'up', client_id: 'c1' }).expect(200);
  });
});
