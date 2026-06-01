import {
  GameRoom,
  Player,
  Card,
  CardType,
  GameStatus,
  GameConfig,
  PlayerProfile,
  DisasterContext,
  EliminationRecord,
  LocationContext,
  Incident
} from '../types/game.js';
import {
  MOCK_DISASTERS,
  MOCK_BIOLOGY,
  MOCK_PROFESSIONS,
  MOCK_HOBBIES,
  MOCK_PHOBIAS,
  MOCK_BAGGAGE,
  MOCK_SPECIAL_CARDS,
  MOCK_LOCATIONS,
  MOCK_INCIDENTS
} from '../data/mockDb.js';

// Simple helper to generate unique secure IDs
const generateUUID = (): string => Math.random().toString(36).substring(2, 9).toUpperCase();

export class RoomManager {
  // In-memory thread-safe storage for active game rooms
  private rooms = new Map<string, GameRoom>();
  
  // Mapping to track which socketId/playerId belongs to which roomId for fast lookups on disconnect
  private playerToRoomMap = new Map<string, string>();
  
  // Storage for active reconnection timeouts to prevent memory leaks and handle recovery gracefully
  private reconnectTimeouts = new Map<string, NodeJS.Timeout>();

  // Transaction state locks to serialize asynchronous overlaps and prevent race conditions
  private roomLocks = new Set<string>();

  // Map to track active bunker defects (failed incidents) per room
  private roomDefects = new Map<string, number>();

  /**
   * Helper to acquire transaction lock for a room with a 5-second timeout safeguard
   */
  private async acquireLock(roomId: string): Promise<boolean> {
    const start = Date.now();
    while (this.roomLocks.has(roomId)) {
      if (Date.now() - start > 5000) {
        throw new Error(`Transaction lock acquisition timeout for room: ${roomId}`);
      }
      // Yield to event loop
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.roomLocks.add(roomId);
    return true;
  }

  /**
   * Releases an acquired transaction lock
   */
  private releaseLock(roomId: string): void {
    this.roomLocks.delete(roomId);
  }

  /**
   * Executes a state transition callback inside a transactional lock guard
   */
  public async runTransaction<T>(roomId: string, action: (room: GameRoom) => T | Promise<T>): Promise<T> {
    const normalizedId = roomId.toUpperCase();
    await this.acquireLock(normalizedId);
    try {
      const room = this.rooms.get(normalizedId);
      if (!room) throw new Error(`Room ${normalizedId} not found.`);
      const result = await action(room);
      return result;
    } finally {
      this.releaseLock(normalizedId);
    }
  }

  /**
   * Creates a new game room with custom configuration
   */
  public createRoom(customConfig?: Partial<GameConfig>): GameRoom {
    const roomId = generateUUID().substring(0, 6);
    
    const defaultConfig: GameConfig = {
      maxPlayers: 12,
      discussionTimeLimit: 60,
      votingTimeLimit: 30,
      allowSelfVoting: false,
      reconnectTimeout: 45000 // 45 seconds to reconnect
    };

    const room: GameRoom = {
      roomId,
      status: GameStatus.LOBBY,
      config: { ...defaultConfig, ...customConfig },
      disaster: null,
      location: null,
      activeIncident: null,
      players: {},
      playerOrder: [],
      currentRound: {
        roundNumber: 0,
        phase: 'discussion',
        activeSpeakerId: null,
        timerRemaining: 0
      },
      eliminationHistory: [],
      cardPool: {
        specialCards: [],
        profiles: []
      }
    };

    this.rooms.set(roomId, room);
    this.roomDefects.set(roomId, 0);
    return room;
  }

  /**
   * Retrieves a room by its ID
   */
  public getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  /**
   * Adds a player to a room. Handles Host promotion if they are the first to join.
   */
  public joinRoom(roomId: string, playerName: string, playerId: string): Player {
    const normalizedRoomId = roomId.toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    if (!room) {
      throw new Error(`Room ${normalizedRoomId} not found.`);
    }

    if (room.status !== GameStatus.LOBBY) {
      throw new Error(`Cannot join room ${normalizedRoomId}. Game has already started.`);
    }

    const currentPlayersCount = Object.keys(room.players).length;
    if (currentPlayersCount >= room.config.maxPlayers) {
      throw new Error(`Room ${normalizedRoomId} is full.`);
    }

    // Cancel any reconnection timeout if this player is re-joining with a new socket
    this.clearReconnectionTimeout(playerId);

    const isHost = currentPlayersCount === 0;

    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      isAlive: true,
      isHost,
      isConnected: true,
      profile: {
        biology: { id: generateUUID(), type: CardType.BIOLOGY, value: '', isRevealed: false },
        profession: { id: generateUUID(), type: CardType.PROFESSION, value: '', isRevealed: false },
        hobby: { id: generateUUID(), type: CardType.HOBBY, value: '', isRevealed: false },
        phobia: { id: generateUUID(), type: CardType.PHOBIA, value: '', isRevealed: false },
        baggage: { id: generateUUID(), type: CardType.BAGGAGE, value: '', isRevealed: false }
      },
      specialCards: [],
      votesReceived: 0,
      votedFor: null,
      hasVoted: false
    };

    room.players[playerId] = newPlayer;
    room.playerOrder.push(playerId);
    
    this.playerToRoomMap.set(playerId, normalizedRoomId);

    return newPlayer;
  }

  /**
   * Removes a player completely from the lobby or marks them as eliminated if in-game
   */
  public leaveRoom(roomId: string, playerId: string): void {
    const normalizedRoomId = roomId.toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    if (!room) return;

    this.playerToRoomMap.delete(playerId);
    this.clearReconnectionTimeout(playerId);

    if (room.status === GameStatus.LOBBY) {
      // Remove entirely if in lobby
      delete room.players[playerId];
      room.playerOrder = room.playerOrder.filter(id => id !== playerId);

      // Promote a new host if host left
      const remainingIds = Object.keys(room.players);
      if (remainingIds.length > 0 && !remainingIds.some(id => room.players[id].isHost)) {
        room.players[remainingIds[0]].isHost = true;
      }

      // Cleanup room if empty
      if (remainingIds.length === 0) {
        this.rooms.delete(normalizedRoomId);
        this.roomDefects.delete(normalizedRoomId);
      }
    } else {
      // If in game, mark them as dead (abandoned game) rather than breaking the state
      const player = room.players[playerId];
      if (player && player.isAlive) {
        this.eliminatePlayer(room, playerId, 'disconnect');
      }
    }
  }

  /**
   * Initiates the game state: generates disaster, dynamic location, and shuffles/assigns cards
   */
  public startGame(roomId: string): GameRoom {
    const normalizedRoomId = roomId.toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    if (!room) throw new Error("Room not found");

    const playerIds = Object.keys(room.players);
    if (playerIds.length < 3) {
      throw new Error("A minimum of 3 players is required to play Bunker.");
    }

    // 1. Generate and assign disaster context & dynamic location context
    const disasterTemplate = MOCK_DISASTERS[Math.floor(Math.random() * MOCK_DISASTERS.length)];
    const capacity = Math.max(1, Math.round(playerIds.length / 2)); // Capacity is half the starting players
    
    room.disaster = {
      id: generateUUID(),
      title: disasterTemplate.title,
      description: disasterTemplate.description,
      bunker: {
        ...disasterTemplate.bunker,
        capacity
      }
    };

    // Pick random location context
    room.location = MOCK_LOCATIONS[Math.floor(Math.random() * MOCK_LOCATIONS.length)];

    // 2. Prep and shuffle Card Decks
    const biologyDeck = this.shuffle(MOCK_BIOLOGY);
    const professionDeck = this.shuffle(MOCK_PROFESSIONS);
    const hobbyDeck = this.shuffle(MOCK_HOBBIES);
    const phobiaDeck = this.shuffle(MOCK_PHOBIAS);
    const baggageDeck = this.shuffle(MOCK_BAGGAGE);
    const specialDeck = this.shuffle(MOCK_SPECIAL_CARDS);

    // Reset room defects
    this.roomDefects.set(room.roomId, 0);

    // 3. Populate Player characteristics and Action Cards (each player gets 2 Special Cards)
    playerIds.forEach((playerId, index) => {
      const player = room.players[playerId];
      const bio = biologyDeck[index % biologyDeck.length];
      const prof = professionDeck[index % professionDeck.length];
      const spec1 = specialDeck[(index * 2) % specialDeck.length];
      const spec2 = specialDeck[(index * 2 + 1) % specialDeck.length];
      
      player.profile = {
        biology: {
          id: generateUUID(),
          type: CardType.BIOLOGY,
          value: `${bio.gender}, ${bio.age}y. Health: ${bio.healthState} | Fertility: ${bio.fertilityStatus}`,
          isRevealed: false,
          metadata: bio,
          compatibility: bio.compatibility
        },
        profession: {
          id: generateUUID(),
          type: CardType.PROFESSION,
          value: `${prof.title} (Utility: ${prof.utility} | Disadvantage: ${prof.disadvantage})`,
          isRevealed: false,
          metadata: prof,
          compatibility: prof.compatibility
        },
        hobby: {
          id: generateUUID(),
          type: CardType.HOBBY,
          value: hobbyDeck[index % hobbyDeck.length],
          isRevealed: false
        },
        phobia: {
          id: generateUUID(),
          type: CardType.PHOBIA,
          value: phobiaDeck[index % phobiaDeck.length],
          isRevealed: false
        },
        baggage: {
          id: generateUUID(),
          type: CardType.BAGGAGE,
          value: baggageDeck[index % baggageDeck.length],
          isRevealed: false
        }
      };

      // Assign 2 action cards per player
      player.specialCards = [
        {
          id: generateUUID(),
          type: CardType.SPECIAL,
          value: `${spec1.name}: ${spec1.description}`,
          isRevealed: false,
          metadata: spec1
        },
        {
          id: generateUUID(),
          type: CardType.SPECIAL,
          value: `${spec2.name}: ${spec2.description}`,
          isRevealed: false,
          metadata: spec2
        }
      ];
    });

    // 4. Trigger the first global round Incident
    this.triggerRandomIncident(room);

    // 5. Update Game Status and Turn Setup
    room.status = GameStatus.DISASTER_REVEAL;
    room.playerOrder = this.shuffle(playerIds); // Randomized speaking order
    room.currentRound = {
      roundNumber: 1,
      phase: 'discussion',
      activeSpeakerId: room.playerOrder[0],
      timerRemaining: room.config.discussionTimeLimit
    };

    return room;
  }

  /**
   * Reveals a specific player profile card to the room. Checks and mitigates incidents if matched.
   */
  public revealCard(roomId: string, playerId: string, cardId: string): GameRoom {
    const room = this.getRoom(roomId);
    if (!room) throw new Error("Room not found");

    const player = room.players[playerId];
    if (!player) throw new Error("Player not found");

    // Search profile
    let cardFound = false;
    let targetCard: Card | null = null;
    const profile = player.profile;
    
    for (const key of Object.keys(profile) as Array<keyof PlayerProfile>) {
      if (profile[key].id === cardId) {
        profile[key].isRevealed = true;
        targetCard = profile[key];
        cardFound = true;
        break;
      }
    }

    // Search special hand if not found in profile
    if (!cardFound) {
      const specialCard = player.specialCards.find(c => c.id === cardId);
      if (specialCard) {
        specialCard.isRevealed = true;
        targetCard = specialCard;
        cardFound = true;
      }
    }

    if (!cardFound || !targetCard) {
      throw new Error(`Card with ID ${cardId} not found in player hand or profile.`);
    }

    // Check if this newly revealed card mitigates the current active incident
    if (room.activeIncident && !room.activeIncident.isMitigated) {
      const activeIncident = room.activeIncident;
      const profTitle = player.profile.profession.isRevealed 
        ? (player.profile.profession.metadata?.title as string || '') 
        : '';
      const bioState = player.profile.biology.isRevealed
        ? (player.profile.biology.metadata?.healthState as string || '')
        : '';
      const baggageVal = player.profile.baggage.isRevealed 
        ? player.profile.baggage.value 
        : '';

      const matched = activeIncident.requiredMitigationTags.some(tag => {
        return (profTitle && profTitle.toLowerCase().includes(tag.toLowerCase())) ||
               (bioState && bioState.toLowerCase().includes(tag.toLowerCase())) ||
               (baggageVal && baggageVal.toLowerCase().includes(tag.toLowerCase())) ||
               (targetCard!.value && targetCard!.value.toLowerCase().includes(tag.toLowerCase()));
      });

      if (matched) {
        activeIncident.isMitigated = true;
      }
    }

    return room;
  }

  /**
   * Registers a vote from one player towards another
   */
  public castVote(roomId: string, voterId: string, targetId: string | null): GameRoom {
    const room = this.getRoom(roomId);
    if (!room) throw new Error("Room not found");
    if (room.status !== GameStatus.VOTING) throw new Error("Voting is not open at this stage.");

    const voter = room.players[voterId];
    if (!voter || !voter.isAlive) throw new Error("Invalid voter.");

    // Validate self voting
    if (targetId === voterId && !room.config.allowSelfVoting) {
      throw new Error("Self-voting is disabled in this room's configurations.");
    }

    // Validate target
    if (targetId !== null) {
      const target = room.players[targetId];
      if (!target || !target.isAlive) {
        throw new Error("Invalid voting target. Player is either not in room or already eliminated.");
      }
    }

    // Register Vote (supports vote changing before final locks)
    const previousVoteTarget = voter.votedFor;
    if (previousVoteTarget !== null && room.players[previousVoteTarget]) {
      room.players[previousVoteTarget].votesReceived = Math.max(0, room.players[previousVoteTarget].votesReceived - 1);
    }

    voter.votedFor = targetId;
    voter.hasVoted = true;

    if (targetId !== null) {
      room.players[targetId].votesReceived += 1;
    }

    // Check if voting phase is now complete
    const activeAlivePlayers = Object.values(room.players).filter(p => p.isAlive && p.isConnected);
    const votesCastCount = activeAlivePlayers.filter(p => p.hasVoted).length;

    if (votesCastCount >= activeAlivePlayers.length) {
      this.resolveVotingPhase(room);
    }

    return room;
  }

  /**
   * Forces voting resolution for AFK/Disconnected timeout cases
   */
  public forceVotingResolution(roomId: string): GameRoom {
    const room = this.getRoom(roomId);
    if (!room) throw new Error("Room not found");
    if (room.status !== GameStatus.VOTING) throw new Error("Voting phase not active.");

    const activeAlivePlayers = Object.values(room.players).filter(p => p.isAlive);
    
    // Auto-abstain unvoted players
    activeAlivePlayers.forEach(player => {
      if (!player.hasVoted) {
        player.votedFor = null;
        player.hasVoted = true;
      }
    });

    this.resolveVotingPhase(room);
    return room;
  }

  /**
   * Handles physical disconnection gracefully. Runs a timer before final elimination.
   */
  public handlePlayerDisconnect(socketId: string): { roomId: string; playerId: string } | null {
    const roomId = this.playerToRoomMap.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = room.players[socketId];
    if (!player) return null;

    player.isConnected = false;

    // In Lobby, we remove them immediately
    if (room.status === GameStatus.LOBBY) {
      this.leaveRoom(roomId, socketId);
      return { roomId, playerId: socketId };
    }

    // In-game: Give them a grace-period timeout before eliminating them to allow clean re-entry
    this.clearReconnectionTimeout(socketId);

    const timeout = setTimeout(() => {
      this.runTransaction(roomId, (activeRoom) => {
        const deadPlayer = activeRoom.players[socketId];
        if (deadPlayer && !deadPlayer.isConnected && deadPlayer.isAlive) {
          this.eliminatePlayer(activeRoom, socketId, 'disconnect');
          
          // If we are currently in voting phase, check if this disconnect triggers voting resolution
          if (activeRoom.status === GameStatus.VOTING) {
            const activeAlivePlayers = Object.values(activeRoom.players).filter(p => p.isAlive && p.isConnected);
            const votesCastCount = activeAlivePlayers.filter(p => p.hasVoted).length;
            if (votesCastCount >= activeAlivePlayers.length) {
              this.resolveVotingPhase(activeRoom);
            }
          }
        }
      }).catch(err => console.error("Error in disconnection cleanup transaction:", err));
      
      this.reconnectTimeouts.delete(socketId);
    }, room.config.reconnectTimeout);

    this.reconnectTimeouts.set(socketId, timeout);

    return { roomId, playerId: socketId };
  }

  /**
   * Restores a disconnected player when they rejoin under a new socket/ID
   */
  public handlePlayerReconnect(roomId: string, originalPlayerId: string, newSocketId: string): GameRoom {
    const normalizedRoomId = roomId.toUpperCase();
    const room = this.rooms.get(normalizedRoomId);
    if (!room) throw new Error("Room not found");

    const player = room.players[originalPlayerId];
    if (!player) throw new Error("Player context not found");

    this.clearReconnectionTimeout(originalPlayerId);

    // If socket ID changed (re-connected on a new connection line), migrate keys
    if (originalPlayerId !== newSocketId) {
      // Re-map in player list
      room.players[newSocketId] = {
        ...player,
        id: newSocketId,
        isConnected: true
      };
      
      // Update turns list
      room.playerOrder = room.playerOrder.map(id => id === originalPlayerId ? newSocketId : id);
      
      // Clean up old socket record
      delete room.players[originalPlayerId];
      this.playerToRoomMap.delete(originalPlayerId);
      this.playerToRoomMap.set(newSocketId, normalizedRoomId);

      // If active speaker, preserve speaker lock
      if (room.currentRound.activeSpeakerId === originalPlayerId) {
        room.currentRound.activeSpeakerId = newSocketId;
      }
    } else {
      player.isConnected = true;
    }

    return room;
  }

  // ==========================================
  // MATHEMATICAL EVALUATION ENGINE
  // ==========================================

  /**
   * Non-trivial synergy-aware mathematical survival scoring.
   * Start base at 50%. Evaluates all cards against location hazards.
   */
  public calculateSurvivalScore(players: Player[], location: LocationContext, bunkerDefectActive: boolean = false): Map<string, number> {
    const scoreMap = new Map<string, number>();
    const survivors = players.filter(p => p.isAlive);
    
    // Global list of synergies held by all active survivors
    const globalSynergies = survivors.map(s => s.profile.profession.compatibility?.synergies || []).flat();

    survivors.forEach(player => {
      let score = 50; // Base score

      const cards = [
        player.profile.biology,
        player.profile.profession,
        player.profile.hobby,
        player.profile.phobia,
        player.profile.baggage
      ];

      // 1. Hazard checking
      location.primaryHazards.forEach(hazard => {
        cards.forEach(card => {
          if (card.compatibility) {
            // Mitigation check
            if (card.compatibility.mitigates.includes(hazard)) {
              score += 15;
            }
            // Vulnerability check
            if (card.compatibility.vulnerabilities.includes(hazard)) {
              score -= 15;
            }
          }
        });
      });

      // 2. Synergy checking (matching profession titles)
      const myTitle = player.profile.profession.metadata?.title || '';
      if (myTitle && globalSynergies.includes(myTitle)) {
        score += 10;
      }

      // 3. Penalty from accumulated room defects
      if (bunkerDefectActive) {
        score -= 15;
      }

      // 4. Clamp results
      score = Math.max(0, Math.min(100, score));
      scoreMap.set(player.id, score);
    });

    // Eliminated or dead players have exactly 0 survival capability
    players.forEach(p => {
      if (!p.isAlive) {
        scoreMap.set(p.id, 0);
      }
    });

    return scoreMap;
  }

  // ==========================================
  // GLOBAL INCIDENTS SERVICE METHODS
  // ==========================================

  /**
   * Spawns a random global incident
   */
  public triggerRandomIncident(room: GameRoom): Incident {
    const template = MOCK_INCIDENTS[Math.floor(Math.random() * MOCK_INCIDENTS.length)];
    
    const incident: Incident = {
      id: generateUUID(),
      title: template.title,
      description: template.description,
      requiredMitigationTags: [...template.requiredMitigationTags],
      penaltyType: template.penaltyType,
      penaltyValue: template.penaltyValue,
      isMitigated: false
    };

    room.activeIncident = incident;
    return incident;
  }

  /**
   * Resolves unmitigated incident penalties at round transitions
   */
  private applyIncidentPenalty(room: GameRoom): void {
    if (!room.activeIncident || room.activeIncident.isMitigated) return;

    const penalty = room.activeIncident.penaltyType;
    const val = room.activeIncident.penaltyValue;

    if (penalty === 'health_damage') {
      // Eliminate a random alive player due to hazard catastrophe
      const survivors = Object.values(room.players).filter(p => p.isAlive);
      if (survivors.length > 0) {
        const victim = survivors[Math.floor(Math.random() * survivors.length)];
        this.eliminatePlayer(room, victim.id, 'special_card');
      }
    } else if (penalty === 'resource_loss') {
      // Tighten survival criteria by shrinking bunker capacity
      if (room.disaster && room.disaster.bunker) {
        room.disaster.bunker.capacity = Math.max(1, room.disaster.bunker.capacity - 1);
      }
    } else if (penalty === 'bunker_defect') {
      // Register global defect penalty multiplier
      const currentDefects = this.roomDefects.get(room.roomId) || 0;
      this.roomDefects.set(room.roomId, currentDefects + 1);
    }
  }

  // ==========================================
  // PRIVATE HELPER ENGINE METHODS
  // ==========================================

  /**
   * Shuffles an array deterministically
   */
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Cleans up scheduled timers
   */
  private clearReconnectionTimeout(playerId: string) {
    const timer = this.reconnectTimeouts.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimeouts.delete(playerId);
    }
  }

  /**
   * Safe elimination execution. Tracks history and triggers collusion limits.
   */
  private eliminatePlayer(room: GameRoom, playerId: string, reason: 'vote' | 'disconnect' | 'special_card'): void {
    const player = room.players[playerId];
    if (!player) return;

    player.isAlive = false;

    const record: EliminationRecord = {
      roundNumber: room.currentRound.roundNumber,
      playerId,
      playerName: player.name,
      reason,
      revealedProfileOnElimination: JSON.parse(JSON.stringify(player.profile)) // Clone for history
    };

    room.eliminationHistory.push(record);

    // Immediately reveal all profile cards for the eliminated player (standard rules)
    player.profile.biology.isRevealed = true;
    player.profile.profession.isRevealed = true;
    player.profile.hobby.isRevealed = true;
    player.profile.phobia.isRevealed = true;
    player.profile.baggage.isRevealed = true;

    // Check overall survival capabilities of remaining survivors
    const survivors = Object.values(room.players).filter(p => p.isAlive);
    const capacityLimit = room.disaster?.bunker.capacity || 1;
    
    // Evaluate survival math
    const roomDefectsCount = this.roomDefects.get(room.roomId) || 0;
    const scores = this.calculateSurvivalScore(Object.values(room.players), room.location!, roomDefectsCount > 0);

    // Anti-Collusion math hook: If down to 2 or capacity matching survivors, compute suitability average
    if (survivors.length <= 2 && survivors.length > 0) {
      const totalScore = survivors.reduce((sum, s) => sum + (scores.get(s.id) || 0), 0);
      const average = totalScore / survivors.length;

      if (average < 30) {
        room.status = GameStatus.GAME_OVER_LOST;
        return;
      }
    }

    if (survivors.length <= capacityLimit) {
      const totalScore = survivors.reduce((sum, s) => sum + (scores.get(s.id) || 0), 0);
      const average = survivors.length > 0 ? totalScore / survivors.length : 0;

      if (average < 30) {
        room.status = GameStatus.GAME_OVER_LOST;
      } else {
        room.status = GameStatus.GAME_OVER_WON;
      }
    }
  }

  /**
   * Processes all casted votes. Prevents deadlocks using a multi-layered tie-breaker.
   */
  private resolveVotingPhase(room: GameRoom): void {
    room.status = GameStatus.ELIMINATION;

    // Compile active candidates and compile votes count
    const alivePlayers = Object.values(room.players).filter(p => p.isAlive);
    
    let maxVotes = -1;
    let candidatesToEliminate: Player[] = [];

    alivePlayers.forEach(player => {
      if (player.votesReceived > maxVotes) {
        maxVotes = player.votesReceived;
        candidatesToEliminate = [player];
      } else if (player.votesReceived === maxVotes && maxVotes > 0) {
        candidatesToEliminate.push(player);
      }
    });

    // Check if there are no votes at all
    if (maxVotes === 0 || candidatesToEliminate.length === 0) {
      // Deadlock mitigation 1: Nobody voted, or all votes are skipped/null. Go to next round directly without elimination.
      this.transitionToNextRound(room);
      return;
    }

    if (candidatesToEliminate.length === 1) {
      // 1 Clear target found
      this.eliminatePlayer(room, candidatesToEliminate[0].id, 'vote');
      this.transitionToNextRound(room);
    } else {
      // Deadlock mitigation 2: Voting Tie.
      // Resolution strategy: We give the Room Host the tie-breaker vote, or resolve by random draft if no host.
      const hostId = Object.keys(room.players).find(id => room.players[id].isHost && room.players[id].isAlive);
      
      let finalTarget: Player;

      if (hostId && room.players[hostId]) {
        // Tie-breaker goes to host. If host didn't vote for one of them, select the first tied candidate
        const hostVote = room.players[hostId].votedFor;
        const hostVotedCandidate = candidatesToEliminate.find(c => c.id === hostVote);
        finalTarget = hostVotedCandidate || candidatesToEliminate[Math.floor(Math.random() * candidatesToEliminate.length)];
      } else {
        // Fallback: Random selection amongst tied candidates (Survival lottery)
        finalTarget = candidatesToEliminate[Math.floor(Math.random() * candidatesToEliminate.length)];
      }

      this.eliminatePlayer(room, finalTarget.id, 'vote');
      this.transitionToNextRound(room);
    }
  }

  /**
   * Advances the round number, resets temporary variables, and sets up phase loops
   */
  private transitionToNextRound(room: GameRoom): void {
    if ((room.status as GameStatus) === GameStatus.GAME_OVER_WON || (room.status as GameStatus) === GameStatus.GAME_OVER_LOST) return;

    // Apply any unmitigated incident penalties from the preceding round
    this.applyIncidentPenalty(room);

    if ((room.status as GameStatus) === GameStatus.GAME_OVER_WON || (room.status as GameStatus) === GameStatus.GAME_OVER_LOST) return;

    // Reset votes received and state variables for all players
    Object.values(room.players).forEach(player => {
      player.votesReceived = 0;
      player.votedFor = null;
      player.hasVoted = false;
    });

    const nextRoundNumber = room.currentRound.roundNumber + 1;
    const survivingPlayers = room.playerOrder.filter(id => room.players[id] && room.players[id].isAlive);

    if (survivingPlayers.length === 0) {
      room.status = GameStatus.GAME_OVER_LOST;
      return;
    }

    // Set status and speaking rotation
    room.status = GameStatus.DISCUSSION;
    room.currentRound = {
      roundNumber: nextRoundNumber,
      phase: 'discussion',
      activeSpeakerId: survivingPlayers[0],
      timerRemaining: room.config.discussionTimeLimit
    };

    // Trigger next round's Incident
    this.triggerRandomIncident(room);
  }
}
