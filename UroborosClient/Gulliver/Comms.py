import asyncio
import threading
from typing import Optional
from .CommsWebSocket import PuppeteerWebSocketClient

# Global references
_loop: Optional[asyncio.AbstractEventLoop] = None
_thread: Optional[threading.Thread] = None
_client: Optional[PuppeteerWebSocketClient] = None
_connected = threading.Event()


def _run_event_loop(loop):
    """Run the event loop in a separate thread"""
    asyncio.set_event_loop(loop)
    loop.run_forever()


def initialize_puppeteer_connection():
    """Initialize the WebSocket connection to Puppeteer - call this at startup"""
    global _loop, _thread, _client

    try:
        # Create event loop
        _loop = asyncio.new_event_loop()
        _thread = threading.Thread(target=_run_event_loop, args=(_loop,), daemon=True)
        _thread.start()

        # Small delay to ensure loop is running
        import time
        time.sleep(0.1)

        # Create and connect client
        _client = PuppeteerWebSocketClient()
        future = asyncio.run_coroutine_threadsafe(_client.connect(), _loop)
        future.result(timeout=5)  # This will raise if connection fails

        # Verify connection is working by sending a ping
        test_future = asyncio.run_coroutine_threadsafe(_client.get_bot_status(), _loop)
        test_future.result(timeout=2)

        _connected.set()
        return True

    except Exception as e:
        _connected.clear()
        error_msg = str(e) if str(e) else type(e).__name__
        print(f'[Puppeteer WebSocket] Failed to connect: {error_msg}')

        # Clean up on failure
        if _client:
            _client = None
        if _loop:
            _loop.call_soon_threadsafe(_loop.stop)
        if _thread:
            _thread.join(timeout=1)
        _loop = None
        _thread = None

        return False


def _ensure_connection():
    """Check if we have a connection to Puppeteer"""
    if not _connected.is_set():
        raise Exception("Not connected to Puppeteer WebSocket")


def get_any_internal_state():
    """Get the internal state of the bot"""
    try:
        _ensure_connection()

        # Get bot status via WebSocket
        future = asyncio.run_coroutine_threadsafe(_client.get_bot_status(), _loop)
        status = future.result(timeout=5)

        if status and status.get('ready') and 'internalState' in status:
            return status['internalState']

    except:
        print('[Puppeteer] Could not connect to Puppeteer')

    return None


def any_is_awake():
    """Check if the bot is ready"""
    try:
        _ensure_connection()

        # Get bot status via WebSocket
        future = asyncio.run_coroutine_threadsafe(_client.get_bot_status(), _loop)
        status = future.result(timeout=5)

        return status.get('ready', False) if status else False

    except:
        return False


def send_command(command):
    """Send a command to the bot"""
    try:
        _ensure_connection()

        # Send command via WebSocket
        future = asyncio.run_coroutine_threadsafe(_client.send_command(command), _loop)
        return future.result(timeout=5)

    except:
        return False


def get_completed_tasks():
    """Get completed tasks from WebSocket client"""
    if _client:
        return list(_client.completed_tasks)
    return []


def get_failed_tasks():
    """Get failed tasks from WebSocket client"""
    if _client:
        return list(_client.failed_tasks)
    return []


def cleanup_puppeteer_connection():
    """Clean up the WebSocket connection - call this at shutdown"""
    global _client, _loop, _thread

    if _client and _loop:
        future = asyncio.run_coroutine_threadsafe(_client.close(), _loop)
        try:
            future.result(timeout=2)
        except:
            pass

    if _loop:
        _loop.call_soon_threadsafe(_loop.stop)

    if _thread:
        _thread.join(timeout=2)

    _client = None
    _loop = None
    _thread = None
    _connected.clear()