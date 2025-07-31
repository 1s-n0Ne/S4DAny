import time
import re
import os
import sys

cwd = os.getcwd()
sys.path.append(cwd + '/..')

import traceback
from openai import OpenAI

from collections import deque

from Sentinel.helpers import parse_commands, antinomy
import datetime
from mcrcon import MCRcon


def filter_any(content: str, info_pattern, chat_pattern, FirstTime):
    anyFilteredLines = []

    for line in content.splitlines():
        info_match = info_pattern.match(line)
        chat_match = chat_pattern.match(line)

        # If the info line matched, extract and print some info
        if info_match:
            some_info = info_match.group(1)
            if not FirstTime and 'N1kt3' not in some_info:
                anyFilteredLines.append(some_info)
            if FirstTime is True and 'Timings Reset' in some_info:
                FirstTime = False

        # If the chat line matched, extract and print chat text
        elif chat_match:
            chat_text = chat_match.group(2)

            # Parse chat even further
            breakChatMatch = re.match(r"^<([^>]+)>\s*(.+)$", chat_text)
            username = breakChatMatch.group(1)

            if 'N1kt3' not in username:
                anyFilteredLines.append(chat_text)

    return anyFilteredLines


def can_make_api_call(api_calls_registry, CALLS_WINDOW, MAX_CALLS_PER_MINUTE):
    # Check if we can make an API call based on current timestamp and past calls
    now = datetime.datetime.now()
    while api_calls_registry and api_calls_registry[0] < now - CALLS_WINDOW:
        api_calls_registry.popleft()  # Remove expired API calls

    if len(api_calls_registry) < MAX_CALLS_PER_MINUTE:
        api_calls_registry.append(now)
        return True
    else:
        return False


def get_new_lines(content: str, info_pattern, chat_pattern, FirstTime, extractGroup):
    newLogLines = []

    for line in content.splitlines():
        info_match = info_pattern.match(line)
        chat_match = chat_pattern.match(line)

        # If the info line matched, extract and print some info
        if info_match:
            some_info = info_match.group(extractGroup)
            if not FirstTime:
                newLogLines.append(some_info)
            if FirstTime is True and 'Timings Reset' in some_info:
                FirstTime = False
                # some_info = 'S4D Any Chat Log ready!'

        # If the chat line matched, extract and print chat text
        elif chat_match:
            chat_text = chat_match.group(2)
            newLogLines.append(chat_text)

    return FirstTime, newLogLines


def main():
    system_info_pattern = re.compile(
        r'^\[\d{2}:\d{2}:\d{2}] \[Server thread/INFO]: (?:\[(Not Secure)] )?(.*)$',
        re.MULTILINE)
    game_info_pattern = re.compile(
        r'^\[\d{2}:\d{2}:\d{2}] \[Server thread/INFO]: (?!.*[()/\\:])(.*)$',
        re.MULTILINE)
    chat_pattern = re.compile(
        r'^\[\d{2}:\d{2}:\d{2}] \[Async Chat Thread - #\d+/INFO]: (?:\[(Not Secure)] )?(<[^>]+> .*)$',
        re.MULTILINE)

    FirstTime = False

    gameInfo = {
        'logLinesBuffer': deque(maxlen=20),
        'gameLinesBuffer': deque(maxlen=20),
        'completedTasks': deque(maxlen=10),
        'failedTasks': deque(maxlen=15),
        'sombraState': False,
        'enmaCaptured': True
    }

    listeners = ['TheAdminstrator']

    # Rates
    MAX_CALLS_PER_MINUTE = 5
    CALLS_WINDOW = datetime.timedelta(minutes=1)

    # Initialize the calls registry
    api_calls_registry = deque(maxlen=MAX_CALLS_PER_MINUTE)

    print('Starting OpenAI backend')
    OAIClient = OpenAI()
    print('Backend started!')

    print('Starting RCON connection')
    severRCON = MCRcon('localhost', os.environ['RCON_PASSWORD'])
    severRCON.connect()
    severRCON.timeout = 100
    print('RCON connected')
    with open('../Server/logs/latest.log') as f:
        # Always read the server console.
        previousContent = f.read()

        while True:
            content = f.read()

            if previousContent in content:
                content.replace(previousContent, '')

                # New lines in the console
                if content != '':
                    anyFiltered = filter_any(content,
                                             game_info_pattern,
                                             chat_pattern,
                                             FirstTime)

                    _, gameLines = get_new_lines(content,
                                                 game_info_pattern,
                                                 chat_pattern,
                                                 FirstTime,
                                                 1)
                    FirstTime, logLines = get_new_lines(content,
                                                        system_info_pattern,
                                                        chat_pattern,
                                                        FirstTime,
                                                        2)

                    gameInfo['gameLinesBuffer'].extend(gameLines)
                    gameInfo['logLinesBuffer'].extend(logLines)

                    try:
                        parse_commands(severRCON, gameLines, listeners, gameInfo, OAIClient)
                    except Exception:
                        traceback.print_exc()

                    if len(anyFiltered) > 0 and can_make_api_call(api_calls_registry,
                                                                  CALLS_WINDOW,
                                                                  MAX_CALLS_PER_MINUTE):
                        antinomy(gameInfo, OAIClient)

            previousContent = f.read()
            time.sleep(0.25)


if __name__ == '__main__':
    main()
