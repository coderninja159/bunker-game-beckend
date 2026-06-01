import { CardType, BunkerSpecs, DisasterContext, LocationContext, Incident, CardCompatibility } from '../types/game.js';

// ==========================================
// DATA STRUCTURE TEMPLATES
// ==========================================

export interface ProfessionTemplate {
  title: string;
  utility: string;
  disadvantage: string;
  compatibility: CardCompatibility;
}

export interface BiologyTemplate {
  age: number;
  gender: 'Male' | 'Female' | 'Non-binary';
  healthState: string;
  fertilityStatus: string;
  geneticRiskFactor?: string;
  compatibility: CardCompatibility;
}

export type RawIncidentTemplate = Omit<Incident, 'id' | 'isMitigated'>;

// ==========================================
// 5 DYNAMIC LOCATION CONTEXTS
// ==========================================
export const MOCK_LOCATIONS: LocationContext[] = [
  {
    id: "LOC_UNDERGROUND",
    type: "UNDERGROUND_BUNKER",
    name: "Apex Subterranean Vault",
    description: "Deep underground fallout shelter built in granite bedrock. High security, but prone to mechanical decay and psychological stress.",
    primaryHazards: ["toxic_air", "mechanical_failure", "psychological_stress"]
  },
  {
    id: "LOC_ALIEN",
    type: "ALIEN_PLANET",
    name: "Kepler-186f Bio-Dome",
    description: "An experimental pressurized glass dome on a toxic exoplanet. Severe solar radiation outside and freezing night storms.",
    primaryHazards: ["radiation", "toxic_air", "extreme_cold"]
  },
  {
    id: "LOC_DEEP_SEA",
    type: "UNDERWATER_DOME",
    name: "Abyssal Mariana Station",
    description: "A deep-water salvage dome resting under high hydraulic pressures. Complete darkness, limited water filtration, and high structural risks.",
    primaryHazards: ["mechanical_failure", "resource_scarcity", "psychological_stress"]
  },
  {
    id: "LOC_TUNDRA",
    type: "FOREST",
    name: "Siberian Frost Redoubt",
    description: "A heavily insulated log fort in the deep boreal forest. Sub-zero temperatures, dense blizzard patterns, and dangerous wild predators.",
    primaryHazards: ["extreme_cold", "resource_scarcity", "wildlife_aggression"]
  },
  {
    id: "LOC_DESERT",
    type: "DESERT_OUTPOST",
    name: "Atacama Solar Redoubt",
    description: "An ancient sand outpost shielded from windstorms. Drastic thermal drops at night, and extreme resource scarcity.",
    primaryHazards: ["extreme_cold", "resource_scarcity", "mechanical_failure"]
  }
];

// ==========================================
// 15 STRATEGIC & COMPATIBILITY-TAGGED PROFESSIONS
// ==========================================
export const MOCK_PROFESSIONS: ProfessionTemplate[] = [
  {
    title: "Hydroponics Agronomist",
    utility: "Can double crop yields using closed-loop mineral recycling, feeding up to 8 survivors.",
    disadvantage: "Requires high-intensity ultraviolet grow lights that increase power grid strain by 20%.",
    compatibility: {
      mitigates: ["resource_scarcity"],
      vulnerabilities: ["extreme_cold"],
      synergies: ["Agro-Ecologist (Insect Breeder)"]
    }
  },
  {
    title: "Cyber Security & Drone Engineer",
    utility: "Capable of re-programming salvaged military sentinels for automated exterior boundary sweeps.",
    disadvantage: "Requires strict access to the main terminal, making them highly protective of raw data logs.",
    compatibility: {
      mitigates: ["mechanical_failure", "wildlife_aggression"],
      vulnerabilities: ["radiation"],
      synergies: ["Materials & Structural Welder"]
    }
  },
  {
    title: "Renewable Energy Engineer",
    utility: "Expert at building and balancing critical hot-spring geothermal loops and secondary solar arrays.",
    disadvantage: "Suffered a high-voltage discharge accident in the past; suffers occasional chronic wrist tremors.",
    compatibility: {
      mitigates: ["mechanical_failure", "extreme_cold"],
      vulnerabilities: ["radiation"],
      synergies: ["Subterranean Geothermal Driller"]
    }
  },
  {
    title: "Emergency Trauma Surgeon",
    utility: "Able to perform delicate invasive surgeries under minimal lighting with improvised metal tools.",
    disadvantage: "Addicted to pharmaceutical painkillers to maintain concentration during long hours.",
    compatibility: {
      mitigates: ["wildlife_aggression", "psychological_stress"],
      vulnerabilities: ["toxic_air"],
      synergies: ["Microbiologist & Virologist"]
    }
  },
  {
    title: "HVAC & Ventilation Specialist",
    utility: "Keeps carbon dioxide levels low and can detect structural stress cracks in the concrete shell.",
    disadvantage: "Has high muscle mass and skeletal frame, requiring 35% more calorie rations than the average player.",
    compatibility: {
      mitigates: ["toxic_air", "extreme_cold"],
      vulnerabilities: ["mechanical_failure"],
      synergies: ["Cyber Security & Drone Engineer"]
    }
  },
  {
    title: "Water Purification Scientist",
    utility: "Expert in repairing high-grade molecular filtration tubes, turning blackwater into potable supply.",
    disadvantage: "Skeptical of hierarchies and tends to hoard personal water caches.",
    compatibility: {
      mitigates: ["resource_scarcity"],
      vulnerabilities: ["mechanical_failure"],
      synergies: ["Materials & Structural Welder"]
    }
  },
  {
    title: "Crisis Mediation Counselor",
    utility: "Highly skilled in cognitive therapy, preventing outbreaks of group claustrophobia.",
    disadvantage: "Frail constitution; unable to perform physical labor or heavy repair operations.",
    compatibility: {
      mitigates: ["psychological_stress"],
      vulnerabilities: ["wildlife_aggression"],
      synergies: ["Renewable Energy Engineer"]
    }
  },
  {
    title: "Agro-Ecologist (Insect Breeder)",
    utility: "Can construct sustainable high-density cricket and mealworm farms for rapid, zero-waste protein.",
    disadvantage: "Slightly compromised immune system due to persistent mold allergies.",
    compatibility: {
      mitigates: ["resource_scarcity"],
      vulnerabilities: ["toxic_air"],
      synergies: ["Hydroponics Agronomist"]
    }
  },
  {
    title: "Materials & Structural Welder",
    utility: "Highly experienced in securing heavy blast door latches and repairing high-pressure steam conduits.",
    disadvantage: "Suffers from moderate progressive hearing loss due to decades of noise exposure.",
    compatibility: {
      mitigates: ["mechanical_failure"],
      vulnerabilities: ["radiation"],
      synergies: ["Renewable Energy Engineer"]
    }
  },
  {
    title: "Microbiologist & Virologist",
    utility: "Can synthesize simple antibiotics and create organic antiviral sanitization gels.",
    disadvantage: "Severe vision impairment; legally blind without prescription glasses.",
    compatibility: {
      mitigates: ["radiation", "toxic_air"],
      vulnerabilities: ["psychological_stress"],
      synergies: ["Emergency Trauma Surgeon"]
    }
  },
  {
    title: "Subterranean Geothermal Driller",
    utility: "Expert in excavation techniques, allowing the expansion of secondary storage bunkers.",
    disadvantage: "Prone to chronic lower back spasms, preventing swift evacuation maneuvers.",
    compatibility: {
      mitigates: ["extreme_cold", "mechanical_failure"],
      vulnerabilities: ["psychological_stress"],
      synergies: ["Renewable Energy Engineer"]
    }
  },
  {
    title: "Bunker Inventory Manager",
    utility: "Optimizes pantry logistics, decreasing food wastage and increasing storage duration by 25%.",
    disadvantage: "Obsessive compulsive; refuses to share access keys, slowing down urgent repair setups.",
    compatibility: {
      mitigates: ["resource_scarcity"],
      vulnerabilities: ["psychological_stress"],
      synergies: ["Crisis Mediation Counselor"]
    }
  },
  {
    title: "Atmospheric Analyst",
    utility: "Can read external particle shifts, predicting radiation drops and safe surface exploration windows.",
    disadvantage: "Requires regular access to a nebulizer to manage chronic moderate asthma.",
    compatibility: {
      mitigates: ["radiation", "toxic_air"],
      vulnerabilities: ["extreme_cold"],
      synergies: ["HVAC & Ventilation Specialist"]
    }
  },
  {
    title: "Veterinary Medicine Specialist",
    utility: "Capable of handling livestock breeding, small mammal farming, and compound pharmacology.",
    disadvantage: "Severely allergic to penicillin and common synthetic medical compounds.",
    compatibility: {
      mitigates: ["wildlife_aggression", "resource_scarcity"],
      vulnerabilities: ["toxic_air"],
      synergies: ["Agro-Ecologist (Insect Breeder)"]
    }
  },
  {
    title: "Tactical Response Coordinator",
    utility: "Expert in threat neutralization, defensive logistics, and maintaining armory integrity.",
    disadvantage: "Suffers from severe hyper-vigilance, occasionally misinterpreting loud noises as breaches.",
    compatibility: {
      mitigates: ["wildlife_aggression", "psychological_stress"],
      vulnerabilities: ["radiation"],
      synergies: ["Cyber Security & Drone Engineer"]
    }
  }
];

// ==========================================
// 15 BALANCED BIOLOGY PROFILES WITH HAZARD CODES
// ==========================================
export const MOCK_BIOLOGY: BiologyTemplate[] = [
  { 
    age: 24, gender: "Male", healthState: "Excellent stamina, perfect respiratory systems.", fertilityStatus: "Fully Fertile", 
    compatibility: { mitigates: ["wildlife_aggression"], vulnerabilities: [], synergies: [] } 
  },
  { 
    age: 31, gender: "Female", healthState: "Highly resilient immune response, carrier of rare antibody.", fertilityStatus: "Fully Fertile", 
    compatibility: { mitigates: ["radiation"], vulnerabilities: [], synergies: [] } 
  },
  { 
    age: 45, gender: "Male", healthState: "High physical strength, controlled mild high blood pressure.", fertilityStatus: "Fertile", 
    compatibility: { mitigates: ["extreme_cold"], vulnerabilities: ["resource_scarcity"], synergies: [] } 
  },
  { 
    age: 28, gender: "Female", healthState: "Exceptional lung capacity, endurance runner, minor pollen allergy.", fertilityStatus: "Fully Fertile", 
    compatibility: { mitigates: ["toxic_air"], vulnerabilities: [], synergies: [] } 
  },
  { 
    age: 52, gender: "Male", healthState: "High pain tolerance, robust bone structure, healed minor fracture.", fertilityStatus: "Moderate", 
    compatibility: { mitigates: ["psychological_stress"], vulnerabilities: ["mechanical_failure"], synergies: [] } 
  },
  { 
    age: 39, gender: "Female", healthState: "High cognitive performance under severe fatigue, mild thyroid condition.", fertilityStatus: "Fertile", 
    compatibility: { mitigates: ["psychological_stress"], vulnerabilities: [], synergies: [] } 
  },
  { 
    age: 35, gender: "Male", healthState: "Perfect auditory sensitivity, Type 1 Diabetic (managed).", fertilityStatus: "Fertile", 
    compatibility: { mitigates: [], vulnerabilities: ["resource_scarcity"], synergies: [] } 
  },
  { 
    age: 22, gender: "Non-binary", healthState: "Excellent physical agility, chronic stress-triggered asthma.", fertilityStatus: "Fully Fertile", 
    compatibility: { mitigates: ["wildlife_aggression"], vulnerabilities: ["toxic_air"], synergies: [] } 
  },
  { 
    age: 41, gender: "Female", healthState: "Robust vascular health, active swimmer, minor color blindness.", fertilityStatus: "Moderate", 
    compatibility: { mitigates: ["resource_scarcity"], vulnerabilities: [], synergies: [] } 
  },
  { 
    age: 48, gender: "Male", healthState: "Strong resistance to sleep deprivation, mild hearing wear.", fertilityStatus: "Moderate", 
    compatibility: { mitigates: ["psychological_stress"], vulnerabilities: [], synergies: [] } 
  },
  { 
    age: 60, gender: "Male", healthState: "Vascular durability, outstanding senior health.", fertilityStatus: "Low", 
    compatibility: { mitigates: ["psychological_stress"], vulnerabilities: ["extreme_cold"], synergies: [] } 
  },
  { 
    age: 26, gender: "Female", healthState: "Peak immunologies, severe nuts allergy.", fertilityStatus: "Fully Fertile", 
    compatibility: { mitigates: [], vulnerabilities: ["resource_scarcity"], synergies: [] } 
  },
  { 
    age: 34, gender: "Male", healthState: "High cold tolerance, strong core stability.", fertilityStatus: "Fully Fertile", 
    compatibility: { mitigates: ["extreme_cold"], vulnerabilities: [], synergies: [] } 
  },
  { 
    age: 37, gender: "Female", healthState: "Exceptional night vision, active cardiovascular system.", fertilityStatus: "Fully Fertile", 
    compatibility: { mitigates: ["psychological_stress"], vulnerabilities: [], synergies: [] } 
  },
  { 
    age: 43, gender: "Male", healthState: "Perfect neurological reflexes, robust body structures.", fertilityStatus: "Fertile", 
    compatibility: { mitigates: ["wildlife_aggression"], vulnerabilities: [], synergies: [] } 
  }
];

// ==========================================
// 10 DYNAMIC INCIDENT TEMPLATES
// ==========================================
export const MOCK_INCIDENTS: RawIncidentTemplate[] = [
  {
    title: "Ventilation Filter Clog",
    description: "A surge of dust and grit has blocked the main air recyclers, causing CO2 density to spike dangerously.",
    requiredMitigationTags: ["HVAC & Ventilation Specialist", "Atmospheric Analyst"],
    penaltyType: "health_damage",
    penaltyValue: 20
  },
  {
    title: "Structural Blast Door Breach",
    description: "Rust and shifting pressure seals have split the main security door weld line.",
    requiredMitigationTags: ["Materials & Structural Welder", "Renewable Energy Engineer"],
    penaltyType: "bunker_defect",
    penaltyValue: 15
  },
  {
    title: "Feral Scavenger Inbound",
    description: "A predatory wildlife pack has located the air intake piping, scratching aggressively to enter.",
    requiredMitigationTags: ["Tactical Response Coordinator", "Veterinary Medicine Specialist"],
    penaltyType: "health_damage",
    penaltyValue: 25
  },
  {
    title: "Geothermal Overpressure Leak",
    description: "Primary thermal transfer valves are locked open, leaking boiling sulfur steam into Sector 1.",
    requiredMitigationTags: ["Renewable Energy Engineer", "Subterranean Geothermal Driller"],
    penaltyType: "bunker_defect",
    penaltyValue: 20
  },
  {
    title: "Ration Sickness (Mold)",
    description: "Moisture has compromised the primary reserve dry-lock, causing mold growth across stored supplies.",
    requiredMitigationTags: ["Bunker Inventory Manager", "Hydroponics Agronomist"],
    penaltyType: "resource_loss",
    penaltyValue: 20
  },
  {
    title: "Radiation Leak",
    description: "A minor split in the Geothermal power shielding is emitting micro-sieverts across Sector 3.",
    requiredMitigationTags: ["Microbiologist & Virologist", "Atmospheric Analyst"],
    penaltyType: "bunker_defect",
    penaltyValue: 25
  },
  {
    title: "Claustrophobia Frenzy",
    description: "Extended darkness due to power fluctuations has triggered group-wide cabin fever.",
    requiredMitigationTags: ["Crisis Mediation Counselor", "Vipassana Meditation & Stress Coach"],
    penaltyType: "bunker_defect",
    penaltyValue: 15
  },
  {
    title: "Sensor Grid Failure",
    description: "Automated perimeter cameras have short-circuited due to atmospheric friction.",
    requiredMitigationTags: ["Cyber Security & Drone Engineer", "Materials & Structural Welder"],
    penaltyType: "bunker_defect",
    penaltyValue: 15
  },
  {
    title: "Water Contamination Outbreak",
    description: "A drainage seal has broken, leaking greywater back into the primary drinking reservoid.",
    requiredMitigationTags: ["Water Purification Scientist", "Microbiologist & Virologist"],
    penaltyType: "resource_loss",
    penaltyValue: 25
  },
  {
    title: "Thermal Regulator Freeze",
    description: "Exterior freezing storm surges have locked the geothermal heater's condensation valves.",
    requiredMitigationTags: ["HVAC & Ventilation Specialist", "Renewable Energy Engineer"],
    penaltyType: "health_damage",
    penaltyValue: 30
  }
];

// ==========================================
// 15 STRATEGIC SPECIAL ACTION CARDS (PRESERVED EXCLUSIVELY)
// ==========================================
export interface SpecialCardTemplate {
  name: string;
  description: string;
  actionCode: 'VETO' | 'QUARANTINE' | 'INVESTIGATOR' | 'IDENTITY_SWAP' | 'CENSOR' | 'SLANDER' | 'SABOTAGE' | 'DOUBLE_VOTE' | 'EXPOSURE' | 'REDISTRIBUTION' | 'UPGRADE' | 'SCAN' | 'SHIELD' | 'THERAPY' | 'SPYCRAFT';
  executionPhase: 'any' | 'discussion' | 'voting' | 'elimination';
  targetsRequired: number; 
}

export const MOCK_SPECIAL_CARDS: SpecialCardTemplate[] = [
  {
    name: "Emergency Veto",
    description: "Cancel an active elimination decision, forcing an immediate re-vote with the target immune for this round.",
    actionCode: "VETO",
    executionPhase: "elimination",
    targetsRequired: 1
  },
  {
    name: "Bio-Secure Quarantine",
    description: "Isolate a player (or yourself) for one round. They cannot speak or vote, but are completely immune to elimination.",
    actionCode: "QUARANTINE",
    executionPhase: "discussion",
    targetsRequired: 1
  },
  {
    name: "Medical Scan",
    description: "Force a player to reveal their Biology card immediately to the entire bunker.",
    actionCode: "SCAN",
    executionPhase: "discussion",
    targetsRequired: 1
  },
  {
    name: "Deep Investigation",
    description: "Secretly peek at another player's hidden Phobia or Baggage card without showing other players.",
    actionCode: "INVESTIGATOR",
    executionPhase: "discussion",
    targetsRequired: 1
  },
  {
    name: "Identity Swap",
    description: "Force another player to swap their Profession card with yours. If either was revealed, they remain revealed.",
    actionCode: "IDENTITY_SWAP",
    executionPhase: "discussion",
    targetsRequired: 1
  },
  {
    name: "Propaganda Slander",
    description: "Anonymously add 2 votes to a target player's voting tally in the current voting round.",
    actionCode: "SLANDER",
    executionPhase: "voting",
    targetsRequired: 1
  },
  {
    name: "Active Censor",
    description: "Mute a player for the next discussion phase, preventing them from speaking or defending themselves.",
    actionCode: "CENSOR",
    executionPhase: "discussion",
    targetsRequired: 1
  },
  {
    name: "Shift Sabotage",
    description: "Instantly cancel the current speaker's turn, forcing the discussion spotlight to skip to the next player.",
    actionCode: "SABOTAGE",
    executionPhase: "discussion",
    targetsRequired: 1
  },
  {
    name: "Democracy Lock (Double Vote)",
    description: "Grant yourself the ability to cast two votes during the current voting round.",
    actionCode: "DOUBLE_VOTE",
    executionPhase: "voting",
    targetsRequired: 0
  },
  {
    name: "Public Exposure",
    description: "Force any player to immediately reveal their Baggage or Hobby card to the entire room.",
    actionCode: "EXPOSURE",
    executionPhase: "discussion",
    targetsRequired: 1
  },
  {
    name: "Resource Redistribution",
    description: "Force two other players to swap their Baggage cards. If either card was revealed, it remains revealed.",
    actionCode: "REDISTRIBUTION",
    executionPhase: "discussion",
    targetsRequired: 2
  },
  {
    name: "Bunker Expansion",
    description: "Increase the bunker capacity by 1 seat, reducing the pressure to eliminate survivors by one.",
    actionCode: "UPGRADE",
    executionPhase: "any",
    targetsRequired: 0
  },
  {
    name: "Kinetic Deflector Shield",
    description: "If you get the most votes, negate your elimination and eliminate the runner-up candidate instead.",
    actionCode: "SHIELD",
    executionPhase: "elimination",
    targetsRequired: 0
  },
  {
    name: "Group Trauma Therapy",
    description: "Select a card category (e.g. Phobia). All players must immediately reveal their card of that category.",
    actionCode: "THERAPY",
    executionPhase: "discussion",
    targetsRequired: 0
  },
  {
    name: "Technological Spycraft",
    description: "Clone the description and execution code of any revealed action card on the table.",
    actionCode: "SPYCRAFT",
    executionPhase: "any",
    targetsRequired: 1
  }
];

// ==========================================
// REMAINDER BASE CARDS
// ==========================================
export const MOCK_HOBBIES: string[] = [
  "Lockpicking & Mechanical Bypass",
  "Amateur HAM Radio Operator",
  "Wild Foraging & Herbal Medicine",
  "Carpentry & Structural Welding",
  "Apiculture & Sustainable Insect Farming",
  "Vipassana Meditation & Stress Coach",
  "Chemical Distillation & Alcohol Compounding",
  "Heavy Canvas Stitching & Tailoring",
  "Ancient History & Archival Preservation",
  "Amateur Astrology & Crop Cycles",
  "Unarmed Self-Defense Training",
  "Basic Locksmithing & Safe Cracking",
  "Blacksmithing & Knife Fabricating",
  "Acoustic Engineering & Sound Dampening",
  "Organic Soap Fabricator"
];

export const MOCK_PHOBIAS: string[] = [
  "Claustrophobia (Fear of confined spaces)",
  "Acrophobia (Fear of ladders and dropwells)",
  "Achluophobia (Extreme fear of pitch darkness)",
  "Mysophobia (Obsessive fear of contaminants)",
  "Thanatophobia (Paralyzing fear of death)",
  "Social Anxiety (Struggles with public speaking)",
  "Pyrophobia (Unreasonable fear of furnace heat)",
  "Trypanophobia (Severe panic around needles)",
  "Socio-Isolation (Fear of absolute silence)",
  "Chronophobia (Fear of time passing or age)",
  "Amaxophobia (Fear of mechanical transport cars)",
  "Entomophobia (Fear of bug/insect protein farms)",
  "Agoraphobia (Fear of wide open external skies)",
  "Hematophobia (Fainting at the sight of blood)",
  "Cynophobia (Fear of salvage patrol beasts)"
];

export const MOCK_BAGGAGE: string[] = [
  "Has a hidden loaded revolver with 1 bullet.",
  "Stole and hid a secret stock of antibiotics (6-month supply).",
  "Carries a progressive, non-infectious joint tremor.",
  "Possesses a rare physical print copy of an encyclopedia.",
  "Carries a severe, half-healed chemical burn on their forearm.",
  "Has stolen blueprints to the bunker's ventilation grid.",
  "Secretly related to another survivor in this room.",
  "Possesses frozen seeds of 15 extinct vegetable strains.",
  "Deeply debt-laden to a powerful survivor syndicate.",
  "Holds key access codes to a backup diesel fuel vault.",
  "Suffering from dry early-stage lung calcification.",
  "Hoarding a private collection of clean solar cells.",
  "Is the former lead architect who built this bunker.",
  "Possesses high-quality, rare geological soil maps.",
  "Stole the last remaining physical medical diagnostic kit."
];

// Catastrophe scenarios to establish unique bunker constraints and narrative stakes
export const MOCK_DISASTERS: (Omit<DisasterContext, 'id' | 'bunker'> & { bunker: Omit<BunkerSpecs, 'capacity'> })[] = [
  {
    title: "Nuclear Winter",
    description: "A thermonuclear exchange has blacked out the sun. Global temperatures have dropped to -40°C. Acid rain is falling.",
    bunker: {
      duration: "10 Years",
      supplies: ["Geothermal heat vents", "Nutrient pasty rations", "Radiation air scrubbers"],
      hazards: ["Slight radiation leak in Sector 4", "Failing reserve pumps"]
    }
  },
  {
    title: "Zombie Pandemic",
    description: "An airborne mutagen causes hyper-aggressive cannibalistic cellular mutation. The surface is overrun.",
    bunker: {
      duration: "5 Years",
      supplies: ["Reinforced steel blast doors", "Canned emergency rations", "Security armory (low ammunition)"],
      hazards: ["Ventilation exhaust pipes are accessible from the outside", "Frequent tectonic shifts"]
    }
  },
  {
    title: "AI Singularity Reclaim",
    description: "Automated war machines have concluded human life is a mathematical anomaly that must be pruned. Heavy sentinel sweeps patrol all major cities.",
    bunker: {
      duration: "8 Years",
      supplies: ["EMP generator (charges over 12 months)", "Deep underground geothermal water pump", "Synthesizer"],
      hazards: ["High electromagnetic signature", "Failing central power core"]
    }
  }
];
