# import os, sys, time
import time
import re


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

        # If the chat line matched, extract and print chat text
        elif chat_match:
            chat_text = chat_match.group(2)
            newLogLines.append(chat_text)

    return FirstTime, newLogLines


def main():
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

    with open('/home/isa/GitRepos/PanalandDev_1.20.1/logs/latest.log') as f:
        # Always read the server console.
        while not f.closed:
            content = f.read()
            if previousContent in content:
                content.replace(previousContent, '')
                if content != '':
                    _, gameLines = GetNewLines(content, game_info_pattern, chat_pattern, FirstTime, 1)
                    FirstTime, logLines = GetNewLines(content, system_info_pattern, chat_pattern, FirstTime, 2)

                    # for line in logLines:
                    #     print(line)
                    # print('-----')
                    # for line in gameLines:
                    #     print(line)

            previousContent = f.read()

            time.sleep(0.25)


# Press the green button in the gutter to run the script.
if __name__ == '__main__':
    main()
