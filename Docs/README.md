# S4D Any

S4D Any is an advanced Minecraft bot system that combines **mineflayer** automation with **OpenAI's or Anthropic's LLMs** to create an embodied AI agent capable of autonomous decision-making, social interaction, and complex task execution in Minecraft multiplayer environments.

## Architecture

The system consists of two main components:

### 🎭 **Puppeteer** (Node.js/JavaScript)
The core Minecraft bot controller built on mineflayer.

### 🧠 **UroborosClient** (Python)
The AI decision-making system that processes game state and generates intelligent responses.

![](AnyArquitecture.png)

## 🚀 Features

### 🤖 **Autonomous Gameplay**
- **Mining & Resource Gathering**: Intelligently mines blocks and collects resources
- **Building & Placement**: Places and breaks blocks with spatial awareness
- **Combat**: Equipped with PvP capabilities, armor management, and tactical retreat

### 🧭 **Navigation & Movement**
- **Smart Pathfinding**: Uses mineflayer-pathfinder for efficient navigation
- **Collision Avoidance**: Handles complex terrain and obstacles

### 🎯 **AI Decision Making**
- VOYAGER like architecture for decision-making.
- **Context Awareness**: Understands game state, inventory, and environment

### 👥 **Social Features**
- **Natural Conversations**: Responds in character as "Any Cemar"
- **Multi-player Awareness**: Tracks nearby players and entities
- **Dynamic Responses**: Adapts behavior based on chat context and game events

### ⚙️ **Advanced Systems**
- **Task Queue**: Sequential command processing with error handling
- **State Management**: Comprehensive bot state tracking and persistence

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone https://github.com/1s-n0Ne/S4DAny
cd S4DAny
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
# Set your LLM API key
export OPENAI_API_KEY="your-api-key-here"
export ANTHROPIC_API_KEY="your-api-key-here"
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

### **Sombra**
Analyzes game state and determines optimal next actions based on:
- Current inventory and equipment
- Environmental context and nearby blocks
- Chat interactions and social dynamics
- Completed and failed task history

### **Gulliver**
Translates high-level goals into specific Minecraft commands:
- Converts natural language objectives to executable commands
- Handles complex multi-step operations
- Manages resource requirements and dependencies

### **Ego**
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