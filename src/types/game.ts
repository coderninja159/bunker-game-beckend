/**
 * Core Type Definitions for "Bunker" Multiplayer Game
 * 
 * Design Principles:
 * 1. Normalized State: Entities (like Players) are stored in Maps (Records) for O(1) lookups
 *    and efficient delta-updates/JSON-patching over Socket.io.
 * 2. Information Security: Clear separation between full Server State and Client-Safe Projection
 *    (Public vs. Private information) to prevent cheat engines from reading unrevealed cards.
 * 3. Minimal Redundancy: Turn-orders, votes, and cards are referenced via IDs or structural objects,
 *    minimizing sync payloads.
 */

/**
 * Tactical hazards that locations can possess and cards can interact with
 */
export type HazardType = 
  | 'extreme_cold' 
  | 'toxic_air' 
  | 'radiation' 
  | 'mechanical_failure' 
  | 'wildlife_aggression' 
  | 'psychological_stress' 
  | 'resource_scarcity';

/**
 * Contextual Location where the game is played
 */
export interface LocationContext {
  id: string;
  type: 'FOREST' | 'ALIEN_PLANET' | 'UNDERGROUND_BUNKER' | 'UNDERWATER_DOME' | 'DESERT_OUTPOST';
  name: string;
  description: string;
  primaryHazards: HazardType[];
}

/**
 * Synergy, mitigation, and vulnerability tags for card assets
 */
export interface CardCompatibility {
  mitigates: HazardType[];
  vulnerabilities: HazardType[];
  synergies: string[]; // List of card IDs or Profession titles they synergize with
}

/**
 * Card Types representing player attributes and action cards
 */
export enum CardType {
  BIOLOGY = 'biology',         // Age, gender, health/fertility
  PROFESSION = 'profession',   // Profession and work experience
  HOBBY = 'hobby',             // Personal hobby/skills
  PHOBIA = 'phobia',           // Phobia or psychological trait
  BAGGAGE = 'baggage',         // Physical item or background secret
  SPECIAL = 'special'          // Special action cards that can alter game rules
}

/**
 * Individual Card Structure
 */
export interface Card {
  id: string;                  // Unique UUID for the card instance
  type: CardType;              // Category of the card
  value: string;               // Text content of the card (e.g., "Surgeon, 10 years experience")
  isRevealed: boolean;         // Whether this card is visible to other players in the room
  metadata?: Record<string, any>; // Optional game designer execution payload
  compatibility?: CardCompatibility; // Injected during game generation
}

/**
 * Player Profile container holding the five core characteristic cards
 */
export interface PlayerProfile {
  biology: Card;
  profession: Card;
  hobby: Card;
  phobia: Card;
  baggage: Card;
}

/**
 * Full Player State (Stored securely on the server)
 */
export interface Player {
  id: string;                  // Socket ID or unique User UUID
  name: string;                // Player's display name
  isAlive: boolean;            // Player status (alive or eliminated)
  isHost: boolean;             // Whether player has admin/room control permissions
  isConnected: boolean;        // Connection status for handling reconnect grace periods
  
  // Character profile cards
  profile: PlayerProfile;
  
  // Special action cards held by the player
  specialCards: Card[];
  
  // Voting and game dynamics for the current round
  votesReceived: number;       // Number of votes cast against this player in the current phase
  votedFor: string | null;     // ID of the player this player voted for (null if not voted yet)
  hasVoted: boolean;           // Quick check flag for round progress
}

/**
 * Game Room Lifecycle Status
 */
export enum GameStatus {
  LOBBY = 'lobby',                   // Players joining, preparing game config
  DISASTER_REVEAL = 'disaster_reveal', // Disaster scenario and bunker specs announced
  DISCUSSION = 'discussion',         // Active discussion phase, players taking turns to speak/reveal cards
  VOTING = 'voting',                 // Voting phase in progress
  ELIMINATION = 'elimination',       // Resolving tie-breakers or executing elimination
  GAME_OVER_WON = 'game_over_won',   // survivors successfully survived against constraints
  GAME_OVER_LOST = 'game_over_lost'  // Anti-collusion failure, combined survival score fell below 30%
}

/**
 * Specific Phase of a Round
 */
export type RoundPhase = 'discussion' | 'voting' | 'elimination';

/**
 * Specifications for the shelter/bunker
 */
export interface BunkerSpecs {
  capacity: number;            // How many players can survive in the bunker (e.g., startingPlayers / 2)
  duration: string;            // Time to stay in the bunker (e.g., "3 years", "10 years")
  supplies: string[];          // List of available bunker supplies/facilities
  hazards: string[];           // List of defects or hazards in the bunker
}

/**
 * Context of the disaster generated at game start
 */
export interface DisasterContext {
  id: string;
  title: string;               // e.g., "Nuclear Winter", "Zombie Pandemic"
  description: string;         // Descriptive backstory/rules
  bunker: BunkerSpecs;         // The safe bunker state details
}

/**
 * Configurable parameters of a room session
 */
export interface GameConfig {
  maxPlayers: number;          // Typically 6 to 12
  discussionTimeLimit: number; // Time in seconds for discussion phase per player
  votingTimeLimit: number;     // Time in seconds for voting phase
  allowSelfVoting: boolean;    // Allow players to vote for themselves
  reconnectTimeout: number;    // Time in milliseconds allowed for disconnected players to reconnect
}

/**
 * Active incident generated per round requiring mitigation
 */
export interface Incident {
  id: string;
  title: string;
  description: string;
  requiredMitigationTags: string[]; // List of keywords or Profession titles (e.g. "Welder", "Botanist")
  penaltyType: 'health_damage' | 'resource_loss' | 'bunker_defect';
  penaltyValue: number;
  isMitigated: boolean;
}

/**
 * Details of the current round execution
 */
export interface CurrentRound {
  roundNumber: number;         // 1-indexed round counter
  phase: RoundPhase;           // Current active phase of the round
  activeSpeakerId: string | null; // ID of the player currently designated to speak (discussion phase)
  timerRemaining: number;      // Seconds remaining on the active phase timer
}

/**
 * Historical record of an eliminated player in a round
 */
export interface EliminationRecord {
  roundNumber: number;
  playerId: string;
  playerName: string;
  reason: 'vote' | 'disconnect' | 'special_card';
  revealedProfileOnElimination: PlayerProfile;
}

/**
 * Full Game Room State (Stored securely on the server)
 */
export interface GameRoom {
  roomId: string;              // 6-character room code (e.g., "BUNKER")
  status: GameStatus;          // Current room status
  config: GameConfig;          // Config settings
  disaster: DisasterContext | null; // Loaded disaster (null in Lobby)
  location: LocationContext | null; // Selected dynamic location (null in Lobby)
  activeIncident: Incident | null;  // Spawned incident in the current round
  
  // Players map. Key is playerId. Provides O(1) updates
  players: Record<string, Player>;
  
  // Ordered list of playerIds to maintain discussion turns consistently
  playerOrder: string[];
  
  // Current active round details
  currentRound: CurrentRound;
  
  // History of rounds and eliminations for reference
  eliminationHistory: EliminationRecord[];
  
  // Pool of remaining/undealt special action cards and profiles for mechanics
  cardPool: {
    specialCards: Card[];
    profiles: PlayerProfile[];
  };
}

// ==========================================
// CLIENT-SAFE SYNCHRONIZATION DATA DTOs
// ==========================================

/**
 * A client-safe projection of a card.
 * If the card is NOT revealed, the value is hidden (set to undefined)
 * unless it belongs to the client viewing it.
 */
export interface ClientCard {
  id: string;
  type: CardType;
  value: string | undefined;   // Redacted if !isRevealed and not owned by client
  isRevealed: boolean;
  metadata?: Record<string, any>; // Optional game designer execution payload
  compatibility?: CardCompatibility; // Included when revealed or owned
}

/**
 * A client-safe profile projection
 */
export interface ClientPlayerProfile {
  biology: ClientCard;
  profession: ClientCard;
  hobby: ClientCard;
  phobia: ClientCard;
  baggage: ClientCard;
}

/**
 * A client-safe Player representation (No leak of private data)
 */
export interface ClientPlayer {
  id: string;
  name: string;
  isAlive: boolean;
  isHost: boolean;
  isConnected: boolean;
  profile: ClientPlayerProfile;
  specialCardsCount: number;   // Only send the count of special action cards to other players!
  votesReceived: number;
  hasVoted: boolean;
}

/**
 * Safe State Payload sent to a specific client.
 * Provides full state needed to render the UI for a particular player.
 */
export interface ClientGameStatePayload {
  roomId: string;
  status: GameStatus;
  config: GameConfig;
  disaster: DisasterContext | null;
  location: LocationContext | null;
  activeIncident: Incident | null;
  players: Record<string, ClientPlayer>;
  playerOrder: string[];
  currentRound: CurrentRound;
  eliminationHistory: EliminationRecord[];
  
  // Private details specific to the receiving player
  localPlayer: {
    id: string;
    specialCards: Card[];      // Complete special action cards for the user to view/use
  };
}
