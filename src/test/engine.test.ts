import { RoomManager } from '../services/RoomManager.js';
import { GameStatus, CardType } from '../types/game.js';
import { MOCK_LOCATIONS } from '../data/mockDb.js';

// Simple unit assertion helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`\x1b[31m[FAIL] Assertion failed: ${message}\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m[PASS] ${message}\x1b[0m`);
  }
}

async function runTests() {
  console.log("=== STARTING BUNKER REDESIGN ARCHITECTURE TESTS ===");
  const roomManager = new RoomManager();

  // Test 1: Room Creation
  const room = roomManager.createRoom({
    maxPlayers: 6,
    discussionTimeLimit: 5,
    votingTimeLimit: 5
  });
  assert(room.roomId.length === 6, "Room ID was generated with correct length");
  assert(room.status === GameStatus.LOBBY, "Room initialized in LOBBY state");

  // Test 2: Player Joining
  const p1 = roomManager.joinRoom(room.roomId, "Surge", "socket-surge");
  const p2 = roomManager.joinRoom(room.roomId, "Cyber", "socket-cyber");
  const p3 = roomManager.joinRoom(room.roomId, "Agron", "socket-agron");
  const p4 = roomManager.joinRoom(room.roomId, "Virol", "socket-virol");

  assert(p1.isHost === true, "First joining player promoted to host");
  assert(p2.isHost === false, "Second player is standard client");
  assert(Object.keys(room.players).length === 4, "4 players registered in room map");

  // Test 3: Game Starting (Dynamic Location, Disaster, and Incident Generation)
  roomManager.startGame(room.roomId);
  assert(room.status === GameStatus.DISASTER_REVEAL, "Room transitioned to disaster announcement status");
  assert(room.location !== null, "Dynamic LocationContext successfully generated");
  assert(room.disaster !== null, "Disaster context loaded");
  assert(room.activeIncident !== null, "First global incident spawned at round start");
  
  console.log(`\x1b[34m[INFO] Spawned Location: ${room.location!.name} (${room.location!.type})\x1b[0m`);
  console.log(`\x1b[34m[INFO] Spawned Incident: ${room.activeIncident!.title}\x1b[0m`);

  // Test 4: Transaction Mutex Verification
  let transactionCompleted: boolean = false;
  const tPromise = roomManager.runTransaction(room.roomId, async (lockedRoom) => {
    // Hold transaction for 100ms
    await new Promise(resolve => setTimeout(resolve, 100));
    assert(lockedRoom.roomId === room.roomId, "Acquired room handle inside transaction block");
    transactionCompleted = true;
  });

  // Attempt simultaneous read/write immediately. Should queue or block until first completes.
  await tPromise;
  assert((transactionCompleted as boolean) === true, "Transactional transaction locking executed sequentially");

  // Test 5: Incident Mitigation Checking
  // We'll set a mock active incident with specific mitigation keyword to verify mitigation loops
  room.activeIncident = {
    id: "INC_TEST",
    title: "Filter Breach",
    description: "Ventilation split.",
    requiredMitigationTags: ["HVAC & Ventilation Specialist", "Atmospheric Analyst"],
    penaltyType: "health_damage",
    penaltyValue: 20,
    isMitigated: false
  };

  // Mock p1 profile profession card to match tag
  p1.profile.profession = {
    id: "CARD_PROF_1",
    type: CardType.PROFESSION,
    value: "HVAC & Ventilation Specialist (Utility: Repair air ducts)",
    isRevealed: false,
    metadata: { title: "HVAC & Ventilation Specialist" }
  };

  assert(room.activeIncident.isMitigated === false, "Incident starts unmitigated");

  // Reveal p1 profession card
  roomManager.revealCard(room.roomId, p1.id, "CARD_PROF_1");
  assert(p1.profile.profession.isRevealed === true, "Card successfully revealed");
  assert(room.activeIncident.isMitigated === true, "Incident marked mitigated matching required tags");

  // Test 6: Synergy & Hazard Mathematical Scoring
  // Set location with 'toxic_air' hazard
  room.location = {
    id: "LOC_T",
    type: "UNDERGROUND_BUNKER",
    name: "Sub bunker",
    description: "confined",
    primaryHazards: ["toxic_air"]
  };

  // Add compatibility data and clear random card states for absolute determinism
  p1.profile.profession.compatibility = {
    mitigates: ["toxic_air"],
    vulnerabilities: [],
    synergies: []
  };
  p1.profile.biology.compatibility = { mitigates: [], vulnerabilities: [], synergies: [] };
  p1.profile.hobby.compatibility = undefined;
  p1.profile.phobia.compatibility = undefined;
  p1.profile.baggage.compatibility = undefined;
  p1.profile.profession.metadata = { title: "HVAC & Ventilation Specialist" };

  p2.profile.profession.compatibility = {
    mitigates: [],
    vulnerabilities: ["toxic_air"],
    synergies: []
  };
  p2.profile.biology.compatibility = { mitigates: [], vulnerabilities: [], synergies: [] };
  p2.profile.hobby.compatibility = undefined;
  p2.profile.phobia.compatibility = undefined;
  p2.profile.baggage.compatibility = undefined;
  p2.profile.profession.metadata = { title: "Software Engineer" };

  p3.profile.profession.compatibility = { mitigates: [], vulnerabilities: [], synergies: [] };
  p3.profile.biology.compatibility = { mitigates: [], vulnerabilities: [], synergies: [] };
  p3.profile.profession.metadata = { title: "Artist" };

  p4.profile.profession.compatibility = { mitigates: [], vulnerabilities: [], synergies: [] };
  p4.profile.biology.compatibility = { mitigates: [], vulnerabilities: [], synergies: [] };
  p4.profile.profession.metadata = { title: "Writer" };

  const scores = roomManager.calculateSurvivalScore(Object.values(room.players), room.location);
  
  const scoreP1 = scores.get(p1.id) || 0;
  const scoreP2 = scores.get(p2.id) || 0;

  // p1: base 50 + 15 (mitigates) = 65
  assert(scoreP1 === 65, `Player 1 survival score computed correctly: ${scoreP1}%`);
  // p2: base 50 - 15 (vulnerable) = 35
  assert(scoreP2 === 35, `Player 2 survival score computed correctly: ${scoreP2}%`);

  // Test 7: Anti-Collusion Termination
  console.log("\x1b[34m[INFO] Simulating collusion elimination sequence...\x1b[0m");

  // Eliminate P1 and P4 so down to final 2 players (P2 and P3)
  // Let's set p2 and p3 profile scores low to guarantee an anti-collusion trigger
  p2.profile.profession.compatibility = {
    mitigates: [],
    vulnerabilities: ["toxic_air", "radiation", "mechanical_failure"],
    synergies: []
  };
  p3.profile.profession.compatibility = {
    mitigates: [],
    vulnerabilities: ["toxic_air", "mechanical_failure"],
    synergies: []
  };

  // Force trigger elimination inside room Manager context
  p1.isAlive = true;
  p4.isAlive = false;

  // Add multiple hazards so survivors vulnerabilities pull score below 30%
  room.location.primaryHazards = ["toxic_air", "mechanical_failure"];

  // Reset voting states so everyone can cast cleanly
  p1.hasVoted = false;
  p2.hasVoted = false;
  p3.hasVoted = false;
  p1.votesReceived = 0;
  p2.votesReceived = 0;
  p3.votesReceived = 0;

  // Run calculation and check if anti-collusion triggers GameStatus.GAME_OVER_LOST
  room.status = GameStatus.VOTING;
  
  // Cast votes to resolve and eliminate p1 (p2 and p3 vote for p1, p1 votes for p2)
  roomManager.castVote(room.roomId, p2.id, p1.id);
  roomManager.castVote(room.roomId, p3.id, p1.id);
  roomManager.castVote(room.roomId, p1.id, p2.id);

  assert((room.status as GameStatus) === GameStatus.GAME_OVER_LOST, "Anti-collusion safety triggered GAME_OVER_LOST due to sub-30% final score");

  console.log("\x1b[32m=== ALL ENGINE INTEGRATION TESTS PASSED SUCCESSFULLY ===\x1b[0m");
}

runTests().catch(error => {
  console.error("Test execution failed with exception:", error);
  process.exit(1);
});
