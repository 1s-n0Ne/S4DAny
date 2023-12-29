import time
import re
import threading
from openai import OpenAI

import sys
print(sys.path)

from collections import deque
import subprocess

from Sentinel.helpers import parseCommands, passCommandToMinecraft, antinomy
import datetime
# KEY = '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'


def FilterAny(content: str, info_pattern, chat_pattern, FirstTime):
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
                # some_info = 'S4D Any Chat Log ready!'

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


def GetNewLines(content: str, info_pattern, chat_pattern, FirstTime, extractGroup):
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


def handleServer(server):
    while True:
        command = input('')
        if command:
            passCommandToMinecraft(server, command)
            if command == 'stop':
                return


def main():
    server = subprocess.Popen('./Sentinel/start.sh', stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
    inputThread = threading.Thread(target=handleServer, args=(server,), daemon=True)

    print('Opening server...')
    time.sleep(5)
    inputThread.start()
    print('Server Ready!')

    previousContent = ''

    system_info_pattern = re.compile(
        r'^\[\d{2}:\d{2}:\d{2}] \[Server thread/INFO]: (?:\[(Not Secure)] )?(.*)$',
        re.MULTILINE)
    game_info_pattern = re.compile(
        r'^\[\d{2}:\d{2}:\d{2}] \[Server thread/INFO]: (?!.*[()/\\:])(.*)$',
        re.MULTILINE)
    chat_pattern = re.compile(
        r'^\[\d{2}:\d{2}:\d{2}] \[Async Chat Thread - #\d+/INFO]: (?:\[(Not Secure)] )?(<[^>]+> .*)$',
        re.MULTILINE)

    FirstTime = True
    gameLinesBuffer = deque(maxlen=20)
    logLinesBuffer = deque(maxlen=20)

    completedTasks = deque(maxlen=10)
    failedTasks = deque(maxlen=15)

    listeners = ['1s_n0Ne', 'TheAdminstrator', 'Deltax10', 'QuesoBadasDabas', 'LordAngel1124']

    # Rates
    MAX_CALLS_PER_MINUTE = 10
    CALLS_WINDOW = datetime.timedelta(minutes=1)

    # Initialize the calls registry
    api_calls_registry = deque(maxlen=MAX_CALLS_PER_MINUTE)

    print('Starting OpenAI backend')
    OAIClient = OpenAI()
    print('Backend started!')

    print('Starting Sombra log file.')
    with open('logs/sombralatest.log', 'w+') as f:
        f.write('')
    print('Starting log started.')

    with open('/home/isa/GitRepos/PanalandDev_1.20.1/logs/latest.log') as f:
        # Always read the server console.
        while server.poll() is None:
            content = f.read()
            if previousContent in content:
                content.replace(previousContent, '')

                # New lines in the console
                if content != '':
                    print('\r', end='')
                    print(content, end='')
                    print('> ', end='')

                    anyFiltered = FilterAny(content, game_info_pattern, chat_pattern, FirstTime)
                    _, gameLines = GetNewLines(content, game_info_pattern, chat_pattern, FirstTime, 1)
                    FirstTime, logLines = GetNewLines(content, system_info_pattern, chat_pattern, FirstTime, 2)

                    gameLinesBuffer.extend(gameLines)
                    logLinesBuffer.extend(logLines)

                    gameInfo = {
                        'gameLinesBuffer': gameLinesBuffer,
                        'completedTasks': completedTasks,
                        'failedTasks': failedTasks
                    }

                    parseCommands(server, gameLines, listeners, gameInfo, OAIClient)

                    if len(anyFiltered) > 0 and can_make_api_call(api_calls_registry, CALLS_WINDOW, MAX_CALLS_PER_MINUTE):
                        gameInfo = antinomy(gameInfo, OAIClient)
                        completedTasks = gameInfo['completedTasks']
                        failedTasks = gameInfo['failedTasks']

            previousContent = f.read()
            time.sleep(0.25)


if __name__ == '__main__':
    main()
