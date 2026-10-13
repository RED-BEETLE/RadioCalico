const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const db = new sqlite3.Database('./data.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initDatabase();
  }
});

function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating table:', err);
    else console.log('Database initialized');
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist TEXT NOT NULL,
      title TEXT NOT NULL,
      thumbs_up INTEGER NOT NULL DEFAULT 0,
      thumbs_down INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(artist, title)
    )
  `, (err) => {
    if (err) console.error('Error creating ratings table:', err);
    else console.log('Ratings table initialized');
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS rating_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      artist TEXT NOT NULL,
      title TEXT NOT NULL,
      rating TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(client_id, artist, title)
    )
  `, (err) => {
    if (err) console.error('Error creating rating_votes table:', err);
    else console.log('Rating votes table initialized');
  });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/items', (req, res) => {
  db.all('SELECT * FROM items ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/items', (req, res) => {
  const { name, description } = req.body;
  db.run(
    'INSERT INTO items (name, description) VALUES (?, ?)',
    [name, description],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, name, description });
      }
    }
  );
});

app.delete('/api/items/:id', (req, res) => {
  db.run('DELETE FROM items WHERE id = ?', [req.params.id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});

app.get('/api/ratings', (req, res) => {
  const { artist, title, client_id } = req.query;
  if (!artist || !title) {
    return res.status(400).json({ error: 'artist and title are required' });
  }
  db.get(
    'SELECT thumbs_up, thumbs_down FROM ratings WHERE artist = ? AND title = ?',
    [artist, title],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const counts = row || { thumbs_up: 0, thumbs_down: 0 };
      if (!client_id) {
        return res.json({ ...counts, voted: null });
      }
      db.get(
        'SELECT rating FROM rating_votes WHERE client_id = ? AND artist = ? AND title = ?',
        [client_id, artist, title],
        (err, voteRow) => {
          if (err) {
            res.status(500).json({ error: err.message });
          } else {
            res.json({ ...counts, voted: voteRow ? voteRow.rating : null });
          }
        }
      );
    }
  );
});

app.post('/api/ratings', (req, res) => {
  const { artist, title, rating, client_id } = req.body;
  if (!artist || !title || !client_id || (rating !== 'up' && rating !== 'down')) {
    return res.status(400).json({ error: 'artist, title, client_id, and rating ("up" or "down") are required' });
  }
  db.run(
    'INSERT INTO rating_votes (client_id, artist, title, rating) VALUES (?, ?, ?, ?)',
    [client_id, artist, title, rating],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'This client has already rated this track' });
        }
        return res.status(500).json({ error: err.message });
      }

      const column = rating === 'up' ? 'thumbs_up' : 'thumbs_down';
      db.run(
        `INSERT INTO ratings (artist, title, ${column}) VALUES (?, ?, 1)
         ON CONFLICT(artist, title) DO UPDATE SET ${column} = ${column} + 1`,
        [artist, title],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          db.get(
            'SELECT thumbs_up, thumbs_down FROM ratings WHERE artist = ? AND title = ?',
            [artist, title],
            (err, row) => {
              if (err) {
                res.status(500).json({ error: err.message });
              } else {
                res.json({ ...row, voted: rating });
              }
            }
          );
        }
      );
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
