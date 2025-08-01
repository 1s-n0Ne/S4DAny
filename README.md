# S4D Any

Project ANY is an advanced Minecraft bot system that combines **mineflayer** automation with **OpenAI's GPT models** to create an embodied AI agent capable of autonomous decision-making, social interaction, and complex task execution in Minecraft multiplayer environments.
Nothing broke?

## Architecture

The system consists of two main components:

### 🎭 **Puppeteer** (Node.js/JavaScript)
The core Minecraft bot controller built on mineflayer.

### 🧠 **UroborosClient** (Python)
The AI decision-making system that processes game state and generates intelligent responses.

```
┌─────────────────┐    REST API    ┌─────────────────┐
│   UroborosClient│◄──────────────►│    Puppeteer    │
│   (Python AI)   │                │  (JS Minecraft) │
└─────────────────┘                └─────────────────┘
        │                                   │
        │                                   │
    ┌───▼───┐                          ┌────▼────┐
    │OpenAI │                          │Minecraft│
    │  API  │                          │ Server  │
    └───────┘                          └─────────┘
```

## 🚀 Features

### 🤖 **Autonomous Gameplay**
- **Mining & Resource Gathering**: Intelligently mines blocks and collects resources
- **Crafting**: Supports both 2x2 inventory crafting and crafting table recipes
- **Building & Placement**: Places and breaks blocks with spatial awareness
- **Combat**: Equipped with PvP capabilities, armor management, and tactical retreat
- **Exploration**: Random exploration with pathfinding and obstacle avoidance

### 🧭 **Navigation & Movement**
- **Smart Pathfinding**: Uses mineflayer-pathfinder for efficient navigation
- **Following**: Can follow players with intelligent stop conditions
- **Goal-oriented Movement**: Navigate to coordinates or specific block types
- **Collision Avoidance**: Handles complex terrain and obstacles

### 🎯 **AI Decision Making**
- **Sombra**: Strategic mind-state analysis and task planning
- **Gulliver**: Command execution and action planning  
- **Ego**: Natural language personality and chat responses
- **Context Awareness**: Understands game state, inventory, and environment

### 👥 **Social Features**
- **Natural Conversations**: Responds in character as "Any Cemar"
- **Multi-player Awareness**: Tracks nearby players and entities
- **Dynamic Responses**: Adapts behavior based on chat context and game events
- **Permission System**: Secure command authorization for trusted users

### ⚙️ **Advanced Systems**
- **Task Queue**: Sequential command processing with error handling
- **State Management**: Comprehensive bot state tracking and persistence
- **Auto-armor**: Intelligent equipment management and upgrades
- **Auto-eat**: Automatic hunger management
- **Logging**: Minecraft-style logging with archival system

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-repo/project-any.git
cd project-any
```

2. **Setup Puppeteer**
```bash
cd Puppeteer
npm install
```

3. **Setup UroborosClient**
```bash
cd UroborosClient
pip install -r requirements.txt
```

4. **Configure environment**
```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Set RCON password for server communication
export RCON_PASSWORD="your-rcon-password"
```

## 🎮 Usage

### Starting the Bot

1. **Start Puppeteer** (in one terminal):
```bash
cd Puppeteer
node main.js
```

2. **Start UroborosClient** (in another terminal):
```bash
cd UroborosClient
python main.py
```

3. **Control puppeteer** via commands or web interface:
```bash
# Via console
Bot> start

# Via REST API
curl -X POST http://localhost:3000/Command -H "Content-Type: application/json" -d '{"command": "start"}'
```

### Basic Commands (🎭 **Puppeteer**)

#### **Movement & Navigation**
```bash
goto 100 64 -200          # Go to coordinates
goto crafting_table       # Find and go to nearest crafting table
follow PlayerName          # Follow a player
randomwalk 20 50          # Random exploration (20-50 blocks)
```

#### **Resource Management**
```bash
mine stone 64             # Mine 64 stone blocks
mine iron_ore coal_ore 10 # Mine 10 of either ore type
craft iron_pickaxe 1      # Craft an iron pickaxe
craftsmall stick 4        # Craft 4 sticks using 2x2 grid
```

#### **Building & Interaction**
```bash
place torch 100 65 -200   # Place torch at coordinates
placenear chest           # Place chest near bot
break 100 64 -200         # Break block at coordinates
hunt zombie 5             # Hunt up to 5 zombies
```

#### **System Control**
```bash
start                     # Connect to Minecraft server
stop                      # Disconnect from server
queue status              # Check task queue status
queue clear               # Clear all pending tasks
```

### System Calls for Puppeteer

The bot responds to special "system call" commands in Minecraft chat:

```
<Player> system call. select sombra. get mindstate.
<Player> system call. select gulliver. baritone goto 100 64 -200.
<Player> system call. start ap.
```

## 🎭 AI Personas

### **Sombra** - The Strategic Mind
Analyzes game state and determines optimal next actions based on:
- Current inventory and equipment
- Environmental context and nearby blocks
- Chat interactions and social dynamics
- Completed and failed task history

### **Gulliver** - The Executor
Translates high-level goals into specific Minecraft commands:
- Converts natural language objectives to executable commands
- Handles complex multi-step operations
- Manages resource requirements and dependencies

### **Ego** - The Personality
Manages social interactions as "Any Cemar":
- Responds to chat messages in character
- Maintains conversational flow and humor
- Balances helpful assistance with authentic personality

## 🔧 Configuration

### Bot Settings (`puppeteerConfig.js`)
```javascript
{
  BOT_USERNAME: 'N1kt3',
  BOT_OPTIONS: {
    host: 'localhost',
    port: 25565,
    auth: 'offline'
  },
  ...
}
```