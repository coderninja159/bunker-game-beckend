import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerGameHandlers } from './sockets/gameHandlers.js';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io with CORS enabled for client connectivity
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',') 
  : '*';

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// Middleware & health checks
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'bunker-game-engine' });
});

// Connection lifecycle routing
io.on('connection', (socket) => {
  console.log(`[Socket Connection] Player connected. ID: ${socket.id}`);
  
  // Register all Bunker gameplay events and handlers
  registerGameHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`[Socket Disconnection] Player disconnected. ID: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  Bunker Real-time Game Engine running on port ${PORT}`);
  console.log(`==================================================`);
});
