import { useState, useEffect } from 'react'
import axios from 'axios'

interface Message {
  id: number
  sender_id: number
  username: string
  content: string
  created_at: string
}

interface User {
  id: number
  username: string
  display_name: string
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [ws, setWs] = useState<WebSocket | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (token && userStr) {
      setUser(JSON.parse(userStr))
      loadMessages(token)
      connectWebSocket(token)
    }
  }, [])

  const loadMessages = async (token: string) => {
    try {
      const res = await axios.get('/api/messages', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMessages(res.data)
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  const connectWebSocket = (token: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`
    const socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', token }))
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'message') {
          setMessages((prev) => [...prev, msg])
        }
      } catch (err) {
        console.error('Failed to parse message:', err)
      }
    }

    socket.onerror = (err) => console.error('WebSocket error:', err)

    setWs(socket)
  }

  const handleAuth = async () => {
    if (!username || !password) return
    const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login'
    try {
      const res = await axios.post(endpoint, {
        username,
        password,
        display_name: username
      })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      setUser(res.data.user)
      loadMessages(res.data.token)
      connectWebSocket(res.data.token)
    } catch (err) {
      alert('Auth failed')
    }
  }

  const handleSendMessage = () => {
    if (!input.trim() || !ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'message', content: input }))
    setInput('')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setMessages([])
    if (ws) ws.close()
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '10px' }}>
        <h1>USAChat</h1>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
        <button onClick={handleAuth}>{isSignup ? 'Sign Up' : 'Login'}</button>
        <button onClick={() => setIsSignup(!isSignup)}>
          {isSignup ? 'Have an account? Login' : 'No account? Sign up'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between' }}>
        <h1>USAChat - {user.display_name}</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
            <strong>{msg.username}:</strong> {msg.content}
            <small style={{ color: '#666', marginLeft: '10px' }}>{new Date(msg.created_at).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>
      <div style={{ padding: '20px', borderTop: '1px solid #ccc', display: 'flex', gap: '10px' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button onClick={handleSendMessage} style={{ padding: '10px 20px' }}>Send</button>
      </div>
    </div>
  )
}
