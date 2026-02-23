import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'usachat',
  user: process.env.DB_USER || 'usachat',
  password: process.env.DB_PASSWORD || '',
});

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const PORT = process.env.PORT || 8080;

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') res.sendStatus(200);
  else next();
});

// Auth
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  const { username, password, display_name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, username, display_name',
      [username, hashedPassword, display_name || username]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  try {
    const result = await pool.query(
      'SELECT id, username, display_name, password_hash FROM users WHERE username = $1',
      [username]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, username: user.username, display_name: user.display_name }, token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/messages', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT m.id, m.content, m.sender_id, m.created_at, u.username FROM messages m JOIN users u ON m.sender_id = u.id ORDER BY m.created_at DESC LIMIT 100'
    );
    res.json(result.rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// WebSocket
wss.on('connection', (ws) => {
  let userId: number | null = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'auth') {
        jwt.verify(msg.token, JWT_SECRET, (err: any, decoded: any) => {
          if (err) ws.send(JSON.stringify({ type: 'auth_fail' }));
          else {
            userId = decoded.id;
            ws.send(JSON.stringify({ type: 'auth_ok' }));
          }
        });
      } else if (msg.type === 'message' && userId) {
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'message',
              sender_id: userId,
              content: msg.content,
              created_at: new Date().toISOString(),
            }));
          }
        });
      }
    } catch (err) {
      console.error('WebSocket error:', err);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
