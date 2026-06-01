import { Server, Socket } from 'socket.io';
import { RoomManager } from '../services/RoomManager.js';
import { getClientGameState } from '../utils/stateProjection.js';

const roomManager = new RoomManager();

/**
 * Utility to broadcast secure, personalized state projections to all active players.
 * Ensures zero cross-client leakage of unrevealed cards.
 */
export function broadcastGameState(io: Server, roomId: string) {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  // Map over players and emit personalized client-safe projections
  Object.keys(room.players).forEach(playerId => {
    const player = room.players[playerId];
    if (player.isConnected) {
      // Create specific payload for this target socket connection
      const safePayload = getClientGameState(room, playerId);
      io.to(playerId).emit('game:state', safePayload);
    }
  });

  // Emit a generic log/status event to the general room socket channel
  io.to(roomId).emit('game:status_update', {
    status: room.status,
    currentRound: room.currentRound.roundNumber,
    phase: room.currentRound.phase,
    activeSpeaker: room.currentRound.activeSpeakerId
  });
}

/**
 * Main socket listener registry for the Bunker Game Server
 */
export function registerGameHandlers(io: Server, socket: Socket) {
  
  // 1. Room Creation
  socket.on('room:create', (config, callback) => {
    try {
      const room = roomManager.createRoom(config);
      // Join the socket room for socket channel broadcasting
      socket.join(room.roomId);
      
      callback({ success: true, roomId: room.roomId });
    } catch (error: any) {
      callback({ success: false, error: error.message });
    }
  });

  // 2. Room Joining
  socket.on('room:join', ({ roomId, name }, callback) => {
    const normalizedRoomId = roomId.toUpperCase();
    
    roomManager.runTransaction(normalizedRoomId, () => {
      return roomManager.joinRoom(normalizedRoomId, name, socket.id);
    })
    .then((player) => {
      socket.join(normalizedRoomId);
      
      // Notify other room members of new player
      socket.to(normalizedRoomId).emit('player:joined', {
        id: player.id,
        name: player.name
      });

      // Send immediate state updates to all participants
      broadcastGameState(io, normalizedRoomId);
      callback({ success: true, playerId: socket.id });
    })
    .catch((error: any) => {
      callback({ success: false, error: error.message });
    });
  });

  // 3. Start Game (Host only)
  socket.on('game:start', ({ roomId }, callback) => {
    const normalizedRoomId = roomId.toUpperCase();
    
    roomManager.runTransaction(normalizedRoomId, (room) => {
      // Permission check: only the host socket can trigger start
      const player = room.players[socket.id];
      if (!player || !player.isHost) {
        throw new Error("Unauthorized: Only the host can start the game.");
      }
      return roomManager.startGame(normalizedRoomId);
    })
    .then(() => {
      // Broadcast starting game payloads
      broadcastGameState(io, normalizedRoomId);
      callback({ success: true });
    })
    .catch((error: any) => {
      callback({ success: false, error: error.message });
    });
  });

  // 4. Reveal Profile or Action Card
  socket.on('card:reveal', ({ roomId, cardId }, callback) => {
    const normalizedRoomId = roomId.toUpperCase();
    
    roomManager.runTransaction(normalizedRoomId, () => {
      return roomManager.revealCard(normalizedRoomId, socket.id, cardId);
    })
    .then(() => {
      // Broadcast updated profile state
      broadcastGameState(io, normalizedRoomId);
      callback({ success: true });
    })
    .catch((error: any) => {
      callback({ success: false, error: error.message });
    });
  });

  // 5. Cast/Update Vote
  socket.on('vote:cast', ({ roomId, targetId }, callback) => {
    const normalizedRoomId = roomId.toUpperCase();
    
    roomManager.runTransaction(normalizedRoomId, () => {
      return roomManager.castVote(normalizedRoomId, socket.id, targetId);
    })
    .then(() => {
      // Sync voting progress to players
      broadcastGameState(io, normalizedRoomId);
      callback({ success: true });
    })
    .catch((error: any) => {
      callback({ success: false, error: error.message });
    });
  });

  // 6. Graceful State Reconnection Link
  socket.on('room:reconnect', ({ roomId, originalPlayerId }, callback) => {
    const normalizedRoomId = roomId.toUpperCase();
    
    roomManager.runTransaction(normalizedRoomId, () => {
      return roomManager.handlePlayerReconnect(normalizedRoomId, originalPlayerId, socket.id);
    })
    .then(() => {
      // Bind socket channels
      socket.join(normalizedRoomId);
      broadcastGameState(io, normalizedRoomId);
      callback({ success: true, newPlayerId: socket.id });
    })
    .catch((error: any) => {
      callback({ success: false, error: error.message });
    });
  });

  // 7. Disconnection Listener
  socket.on('disconnect', () => {
    // Note: handlePlayerDisconnect executes setTimeout internally which runs in transaction lock.
    const disconnectInfo = roomManager.handlePlayerDisconnect(socket.id);
    
    if (disconnectInfo) {
      const { roomId, playerId } = disconnectInfo;
      // Announce disconnection flag to players in room
      io.to(roomId).emit('player:disconnected', { playerId });
      
      // Update state visibility
      broadcastGameState(io, roomId);
    }
  });
}
