import asyncio
import json
import websockets
import uuid
from typing import Dict, Optional
from collections import deque


class PuppeteerWebSocketClient:
    def __init__(self, uri: str = "ws://localhost:8080"):
        self.uri = uri
        self.websocket: Optional[websockets.WebSocketClientProtocol] = None
        self.is_connected = False
        self.pending_commands: Dict[str, dict] = {}
        self.message_queue = asyncio.Queue()
        self.response_futures: Dict[str, asyncio.Future] = {}

        # Task tracking (same as in gameInfo)
        self.completed_tasks = deque(maxlen=10)
        self.failed_tasks = deque(maxlen=15)

    async def connect(self):
        """Establish WebSocket connection to Puppeteer"""
        self.websocket = await websockets.connect(self.uri)
        self.is_connected = True

        # Start message handlers in background
        asyncio.create_task(self._receive_messages())
        asyncio.create_task(self._send_messages())

        # Give a moment for the connection to stabilize
        await asyncio.sleep(0.1)

    async def _receive_messages(self):
        """Handle incoming messages from Puppeteer"""
        try:
            async for message in self.websocket:
                data = json.loads(message)
                await self._handle_message(data)
        except websockets.exceptions.ConnectionClosed:
            self.is_connected = False
        except Exception as e:
            self.is_connected = False
            raise

    async def _send_messages(self):
        """Send queued messages to Puppeteer"""
        while self.is_connected:
            message = await self.message_queue.get()
            await self.websocket.send(json.dumps(message))

    async def _handle_message(self, data: dict):
        """Process messages from Puppeteer"""
        msg_type = data.get('type')
        message_id = data.get('messageId')

        # Handle task lifecycle events
        if msg_type == 'task_completed':
            task = data.get('task', {})
            task_name = task.get('name', 'Unknown')
            # Convert task name format: "mine: stone x64" -> "mine stone 64"
            task_string = task_name.replace(':', '').replace(' x', ' ').lower()
            self.completed_tasks.append(task_string)

        elif msg_type == 'task_failed':
            task = data.get('task', {})
            task_name = task.get('name', 'Unknown')
            task_string = task_name.replace(':', '').replace(' x', ' ').lower()
            self.failed_tasks.append(task_string)

        # Handle response messages
        elif msg_type == 'bot_status_response' and message_id in self.response_futures:
            self.response_futures[message_id].set_result(data.get('status'))

    async def send_command(self, command: str) -> bool:
        """Send a command to Puppeteer"""
        if not self.is_connected:
            return False

        message_id = str(uuid.uuid4())
        message = {
            'type': 'command',
            'id': message_id,
            'command': command
        }

        await self.message_queue.put(message)
        return True

    async def get_bot_status(self) -> dict:
        """Request bot status from Puppeteer"""
        if not self.is_connected:
            return None

        message_id = str(uuid.uuid4())
        message = {
            'type': 'bot_status',
            'id': message_id
        }

        # Create future for response
        future = asyncio.Future()
        self.response_futures[message_id] = future

        await self.message_queue.put(message)

        # Wait for response
        try:
            result = await asyncio.wait_for(future, timeout=5.0)
            return result
        except asyncio.TimeoutError:
            self.response_futures.pop(message_id, None)
            return None

    async def close(self):
        """Close the WebSocket connection"""
        if self.websocket:
            await self.websocket.close()
            self.is_connected = False