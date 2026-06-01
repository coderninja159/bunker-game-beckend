# Bunker Multiplayer Game - Backend Engine

Real-time game engine backend for the Bunker Multiplayer Game, built using Node.js, TypeScript, Express, and Socket.io.

## Features

- **Real-Time Multiplayer Synchronization**: Low-latency communication utilizing WebSockets (Socket.io).
- **Core Game Engine**: Manages multiplayer room creation, joining, and real-time state synchronization.
- **Robust Health Monitoring**: Dedicated `/health` checking endpoint.
- **Dockerized Environment**: Ready-to-go containerization configurations.

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **WebSockets**: Socket.io
- **Containerization**: Docker

## Getting Started

### Prerequisites

Make sure you have Node.js (v18+) and npm installed.

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Project

- **Development Mode**:
  ```bash
  npm run dev
  ```
- **Production Build**:
  ```bash
  npm run build
  npm start
  ```
