import {
  GameRoom,
  Player,
  Card,
  ClientCard,
  ClientPlayer,
  ClientGameStatePayload
} from '../types/game.js';

/**
 * Redacts a Card object based on its revelation state or ownership.
 * 
 * @param card - The full card details from the server state
 * @param isOwner - Whether the requesting client owns this card
 * @returns Client-safe card with value hidden if unrevealed and not owned by the recipient
 */
export function projectCardToClient(card: Card, isOwner: boolean): ClientCard {
  return {
    id: card.id,
    type: card.type,
    isRevealed: card.isRevealed,
    value: (card.isRevealed || isOwner) ? card.value : undefined,
    metadata: (card.isRevealed || isOwner) ? card.metadata : undefined
  };
}

/**
 * Projects a full server-side Player state into a safe client-side representation.
 * Masks unrevealed profile cards and hides special card details from other players.
 * 
 * @param player - The full player object from the server
 * @param isTargetClient - Whether the player being projected is the client requesting the state
 * @returns Client-safe player object
 */
export function projectPlayerToClient(player: Player, isTargetClient: boolean): ClientPlayer {
  return {
    id: player.id,
    name: player.name,
    isAlive: player.isAlive,
    isHost: player.isHost,
    isConnected: player.isConnected,
    profile: {
      biology: projectCardToClient(player.profile.biology, isTargetClient),
      profession: projectCardToClient(player.profile.profession, isTargetClient),
      hobby: projectCardToClient(player.profile.hobby, isTargetClient),
      phobia: projectCardToClient(player.profile.phobia, isTargetClient),
      baggage: projectCardToClient(player.profile.baggage, isTargetClient)
    },
    specialCardsCount: player.specialCards.length,
    votesReceived: player.votesReceived,
    hasVoted: player.hasVoted
  };
}

/**
 * Formats and filters the entire room state to be safe for synchronization to a specific player's client.
 * Hides all sensitive information that the player should not know (e.g., other players' special cards, 
 * unrevealed profiles, and the remaining deck pool).
 * 
 * @param room - The complete server-side GameRoom state
 * @param playerId - The ID of the player requesting the state
 * @returns ClientGameStatePayload suitable for JSON serialization and socket transmission
 */
export function getClientGameState(room: GameRoom, playerId: string): ClientGameStatePayload {
  const projectedPlayers: Record<string, ClientPlayer> = {};
  
  // Transform all players securely
  for (const pid in room.players) {
    if (Object.prototype.hasOwnProperty.call(room.players, pid)) {
      const isSelf = pid === playerId;
      projectedPlayers[pid] = projectPlayerToClient(room.players[pid], isSelf);
    }
  }

  // Get local player special cards securely (only defined if player is valid)
  const localPlayerDetails = room.players[playerId];
  const localSpecialCards = localPlayerDetails ? localPlayerDetails.specialCards : [];

  return {
    roomId: room.roomId,
    status: room.status,
    config: room.config,
    disaster: room.disaster,
    location: room.location,
    activeIncident: room.activeIncident,
    players: projectedPlayers,
    playerOrder: room.playerOrder,
    currentRound: room.currentRound,
    eliminationHistory: room.eliminationHistory,
    localPlayer: {
      id: playerId,
      specialCards: localSpecialCards
    }
  };
}
