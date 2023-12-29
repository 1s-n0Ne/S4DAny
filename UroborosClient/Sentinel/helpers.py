import sys
import getopt
import S4D_Any.Gulliver.Comms as comm
import S4D_Any.Sombra.helpers as som

import re


def parsel3(module, phrase):
    rawP = phrase
    phrase = phrase.lower()

    if module == 'ego':
        if phrase == 'trigger response':
            return phrase
        if re.match(r"get (\w+) perception", phrase):
            return phrase
    elif module == 'sombra':
        if phrase.lower() == 'get mindstate':
            return phrase.lower()
    elif module == 'gulliver':
        gulliverPrefixes = ['baritone', 'impact', 'paper', 'minecraft']
        for prefix in gulliverPrefixes:
            if phrase.startswith(prefix):
                return prefix, [rawP.replace(f'{prefix} ', '')]
    elif module == 's4d core module':
        if re.match(r'\b(add|remove) listener ([a-zA-Z0-9_-]+)\b', phrase):
            return phrase

    return None


def parseCommand(command):
    command = command.removeprefix('system call. ')
    phrases = command.split('. ')
    tree = {'system call': []}

    l2 = {'start ap', 'stop ap', 's4d core module', 'select gulliver', 'select sombra', 'select ego', 's4d core module'}

    for phrase in phrases:
        # print(phrase)
        rawPhrase = phrase
        phrase = phrase.replace('.', '').lower()

        if phrase in l2:
            tree['system call'].append((phrase, []))
            continue
        if 'select' in phrase:
            phrase = phrase.replace('select ', '')
            modules = phrase.split(' ')
            for module in modules:
                tree['system call'].append((f'select {module}', []))
            continue

        for i, l1cmd in enumerate(tree['system call']):
            if l1cmd[0] in l2:
                nextL = parsel3(l1cmd[0].replace('select ', ''), rawPhrase)
                if nextL:
                    tree['system call'][i][1].append(nextL)

    return tree


def passCommandToMinecraft(server, command):
    server.stdin.write(bytes(command + '\r\n', 'ascii'))
    server.stdin.flush()


def showSuccessEffects(server, username):
    passCommandToMinecraft(server, f'title {username} ' + 'times 20 40 20')
    passCommandToMinecraft(server, f'title {username} ' + 'subtitle ["",{"text":"Algo acaba de suceder","italic":true,"color":"gold"},{"text":"...","color":"gold"}]')
    passCommandToMinecraft(server, f'execute at {username} run particle minecraft:soul_fire_flame ~ ~ ~ 1 1 1 0.1 500')
    passCommandToMinecraft(server, f'execute at {username} run playsound minecraft:block.beacon.activate voice {username}')
    passCommandToMinecraft(server, f'execute at {username} run playsound minecraft:entity.firework_rocket.twinkle_far voice {username}')
    passCommandToMinecraft(server, f'title {username} ' + 'title {"text":"Tus manos resplandecen","color":"gold"}')


def showFailureEffect(server, username):
    passCommandToMinecraft(server, f'title {username} ' + 'times 20 40 20')
    passCommandToMinecraft(server, f'title {username} ' + 'subtitle {"text":"Quizas hichiste algo mal?","italic":true,"color":"gray"}')
    passCommandToMinecraft(server, f'execute at {username} run particle minecraft:ash ~ ~ ~ 1 1 1 0.1 500')
    passCommandToMinecraft(server, f'execute at {username} run  playsound minecraft:ambient.cave ambient {username} ~ ~ ~ 0.1 0.5')
    passCommandToMinecraft(server, f'title {username} ' + 'title {"text":"Un debil brillo emana de tus manos.","color":"gray"}')


def runSystemCall(server, cmd, gameInfo, OAIClient):
    # [('select sombra', ['get mindstate']), ('select gulliver', [('baritone', ['goal Stone'])])]
    # [('select gulliver', [('paper', ['kill QuesoBadasDabas'])])]
    # print(cmd)
    if cmd[0] == 'start ap':
        if not comm.anyIsAwake():
            return comm.sendCommand('start')
        else:
            return False
    elif cmd[0] == 'stop ap':
        if comm.anyIsAwake():
            return comm.sendCommand('stop')
        else:
            return False

    elif cmd[0] == 'select gulliver':
        gulliverCmd = cmd[1][0]
        if gulliverCmd[0] == 'baritone':
            return comm.sendCommand(gulliverCmd[1][0])
        elif gulliverCmd[0] == 'minecraft':
            if comm.anyIsAwake():
                comm.sendCommand('chat /'+gulliverCmd[1][0])
                return True
            return False
        elif gulliverCmd[0] == 'paper':
            passCommandToMinecraft(server, gulliverCmd[1][0])
            return True

    elif cmd[0] == 'select sombra':
        if cmd[1][0] == 'get mindstate':
            if comm.anyIsAwake():
                state = comm.getAnyInternalState()
                if state:
                    gameLinesBuffer = gameInfo['gameLinesBuffer']
                    completedTasks = gameInfo['completedTasks']
                    failedTasks = gameInfo['failedTasks']
                    promptString = 'Chat log:\n' + '\n'.join(gameLinesBuffer) + '\n' + state + '\n'
                    promptString += 'Tareas actualmente completadas: ' + ', '.join(completedTasks) + '\n'
                    promptString += 'Tareas fallidas que son muy complicadas: ' + ', '.join(failedTasks)

                    res = som.sombraMindState(promptString, OAIClient)
                    for resLine in res.splitlines():
                        comm.sendCommand('chat '+resLine)

                    return True
        return False

    elif cmd[0] == 'select ego':
        pass

    return False


def antinomy(gameInfo, OAIClient):
    if comm.anyIsAwake():
        state = comm.getAnyInternalState()
        if state:
            gameLinesBuffer = gameInfo['gameLinesBuffer']
            completedTasks = gameInfo['completedTasks']
            failedTasks = gameInfo['failedTasks']

            promptString = 'Chat log:\n' + '\n'.join(gameLinesBuffer) + '\n' + state + '\n'
            promptString += 'Tareas actualmente completadas: ' + ', '.join(completedTasks) + '\n'
            promptString += 'Tareas fallidas que son muy complicadas: ' + ', '.join(failedTasks)
            
            mind, instructions = som.executiveFunction(promptString, OAIClient)

            taskSect = mind.find('Tarea:')
            taskString = mind[taskSect + 6:].removeprefix(' ').replace('.', '').lower()

            with open('logs/sombralatest.log', 'a') as f:
                print('====== [ANTINOMY CALL STATE] ======', file=f, flush=True)

                print('[Puppeteer] Internal State:', file=f, flush=True)
                print(promptString, file=f, flush=True)
                print('', file=f, flush=True)

                print('[Sombra] MindState:', file=f, flush=True)
                print(mind, file=f, flush=True)
                print('', file=f, flush=True)

                print('[Gulliver] Instructions:', file=f, flush=True)
                print(instructions, file=f, flush=True)
                print('', file=f, flush=True)

                try:
                    commands = eval(instructions)
                    if len(commands) > 0:
                        for command in commands:
                            if command == 'chat':
                                egoPrompt = 'Chat log:\n' + '\n'.join(gameLinesBuffer) + '\n' + mind
                                anyChat = som.callEgo(egoPrompt, OAIClient)
                                anyChat = anyChat.removeprefix('Chat: ')

                                print('[Ego] Voice:', file=f, flush=True)
                                print(anyChat, file=f, flush=True)
                                comm.sendCommand('chat ' + anyChat)
                            else:
                                comm.sendCommand(command)
                        gameInfo['completedTasks'].append(taskString)
                except SyntaxError:
                    gameInfo['failedTasks'].append(taskString)

    return gameInfo


def parseCommands(server, logLines, listeners, gameInfo, OAIClient):
    if len(logLines) == 0 or 'system call' not in logLines[-1].lower():
        return
    # Perform the search
    match = re.match(r"^<([^>]+)>\s*(.+)$", logLines[-1])
    username = match.group(1)
    msg = match.group(2)

    if username not in listeners:
        return

    try:
        cmdList = parseCommand(msg)['system call']
        if len(cmdList) == 0:
            showFailureEffect(server, username)
        for cmd in cmdList:
            res = runSystemCall(server, cmd, gameInfo, OAIClient)
            if res:
                showSuccessEffects(server, username)
            else:
                showFailureEffect(server, username)

    except Exception as e:
        showFailureEffect(server, username)
