from collections import deque

import UroborosClient.Gulliver.Comms as comm
import UroborosClient.Sombra.helpers as som

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
        if phrase.replace('.', '') in ['get mindstate', 'enable', 'disable']:
            return phrase
    elif module == 'gulliver':
        gulliverPrefixes = ['baritone', 'impact', 'paper', 'minecraft']
        for prefix in gulliverPrefixes:
            if phrase.startswith(prefix):
                return prefix, [rawP.replace(f'{prefix} ', '')]
    elif module == 's4d core module':
        if re.match(r'\b(add|remove) listener ([a-zA-Z0-9_-]+)\b', phrase):
            return phrase

    return None


def parse_command(command):
    command = command.removeprefix('system call. ')
    phrases = command.split('. ')
    tree = {'system call': []}

    l2 = {'start ap', 'stop ap', 's4d core module', 'select gulliver', 'select sombra', 'select ego', 's4d core module'}

    for phrase in phrases:
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

def show_success_effects(server, username):
    server.command(f'title {username} ' + 'times 20 40 20')
    server.command(f'title {username} ' + 'subtitle ["",{"text":"Algo acaba de suceder","italic":true,"color":"gold"},{"text":"...","color":"gold"}]')
    server.command(f'execute at {username} run particle minecraft:soul_fire_flame ~ ~ ~ 1 1 1 0.1 500')
    server.command(f'execute at {username} run playsound minecraft:block.beacon.activate voice {username}')
    server.command(f'execute at {username} run playsound minecraft:entity.firework_rocket.twinkle_far voice {username}')
    server.command(f'title {username} ' + 'title {"text":"Tus manos resplandecen","color":"gold"}')

def show_failure_effect(server, username):
    server.command(f'title {username} ' + 'times 20 40 20')
    server.command(f'title {username} ' + 'subtitle {"text":"¿Quizás hichiste algo mal?","italic":true,"color":"gray"}')
    server.command(f'execute at {username} run particle minecraft:ash ~ ~ ~ 1 1 1 0.1 500')
    server.command(f'execute at {username} run playsound minecraft:ambient.soul_sand_valley.additions ambient {username} ~ ~ ~ 100 0.75')
    server.command(f'title {username} ' + 'title {"text":"Un débil brillo emana de tus manos.","color":"gray"}')

def you_are_alone(server, username):
    server.command(f'title {username} actionbar ' + '{"text":"Pero no vino nadie...","italic":true,"color":"gray"}')


def assert_command(commandRes):
    errorHints = ['error', 'desconocido', 'incorrect', "can't", 'required', 'not']
    for hint in errorHints:
        if hint in commandRes:
            return False
    return True


def run_system_call(server, cmd, gameInfo, OAIClient):

    # COMMAND PARSE TREE EXAMPLE
    # [('select sombra', ['get mindstate']), ('select gulliver', [('baritone', ['goal Stone'])])]
    # [('select gulliver', [('paper', ['kill QuesoBadasDabas'])])]

    print(f'Received command tree: {cmd}')

    if cmd[0] == 'start ap':
        if not comm.any_is_awake():
            return comm.send_command('start')
        else:
            return False
    elif cmd[0] == 'stop ap':
        if comm.any_is_awake():
            return comm.send_command('stop')
        else:
            return False

    elif cmd[0] == 'select gulliver':
        gulliverCmd = cmd[1][0]
        if gulliverCmd[0] == 'baritone':
            return comm.send_command(gulliverCmd[1][0])
        elif gulliverCmd[0] == 'minecraft':
            if comm.any_is_awake():
                comm.send_command('chat /' + gulliverCmd[1][0])
                return True
            return False
        elif gulliverCmd[0] == 'paper':
            res = server.command(gulliverCmd[1][0])
            return assert_command(res.lower())

    elif cmd[0] == 'select sombra':
        if cmd[1][0] == 'get mindstate':
            if comm.any_is_awake():
                state = comm.get_any_internal_state()
                if state:
                    gameLinesBuffer = gameInfo['gameLinesBuffer']
                    completedTasks = gameInfo['completedTasks']
                    failedTasks = gameInfo['failedTasks']
                    promptString = 'Chat log:\n' + '\n'.join(gameLinesBuffer) + '\n' + state + '\n'
                    promptString += 'Tareas actualmente completadas: ' + ', '.join(completedTasks) + '\n'
                    promptString += 'Tareas fallidas que son muy complicadas: ' + ', '.join(failedTasks)

                    res = som.sombra_mind_state(promptString, OAIClient)

                    dumpHeader = 'tellraw @a ["",{"text":"===","bold":true,"color":"blue"},{"text":" SOMBRA MINDSTATE DUMP"},{"text":" ===","bold":true,"color":"blue"},{"text":"\\n "}]'
                    dumpFoot = 'tellraw @a ["",{"text":"=========================","bold":true,"color":"blue"},{"text":"\\n "}]'

                    server.command(dumpHeader)
                    for line in res.splitlines():
                        dumpLine = 'tellraw @a {"text":"{' + line + '} \\n"}'
                        server.command(dumpLine)
                    server.command(dumpFoot)
                    return True

        elif cmd[1][0] == 'enable':
            if gameInfo['sombraState']:
                return False
            else:
                gameInfo['sombraState'] = True
                return True
        elif cmd[1][0] == 'disable':
            if not gameInfo['sombraState']:
                return False
            else:
                gameInfo['sombraState'] = False
                return True

        return False

    elif cmd[0] == 'select ego':
        pass

    return False


def antinomy(gameInfo, OAIClient):
    awake = comm.any_is_awake()
    if awake:
        state = comm.get_any_internal_state()
        if state:
            # Update task lists from WebSocket client
            gameInfo['completedTasks'] = deque(comm.get_completed_tasks(), maxlen=10)
            gameInfo['failedTasks'] = deque(comm.get_failed_tasks(), maxlen=15)

            gameLinesBuffer = gameInfo['gameLinesBuffer']
            completedTasks = gameInfo['completedTasks']
            failedTasks = gameInfo['failedTasks']

            promptString = 'Chat log:\n' + '\n'.join(gameLinesBuffer) + '\n' + state + '\n'
            promptString += 'Tareas actualmente completadas: ' + ', '.join(completedTasks) + '\n'
            promptString += 'Tareas fallidas que son muy complicadas: ' + ', '.join(failedTasks)

            mind, instructions = som.executive_function(promptString, OAIClient)

            taskSect = mind.find('Tarea:')
            taskString = mind[taskSect + 6:].removeprefix(' ').replace('.', '').lower()

            print('====== [ANTINOMY CALL STATE] ======')

            print('[Puppeteer] Internal State:')
            print(promptString)
            print('')

            print('[Sombra] MindState:')
            print(mind)
            print('')

            print('[Gulliver] Instructions:')
            print(instructions)
            print('')

            try:
                commands = eval(instructions)
                if len(commands) > 0:
                    for command in commands:
                        if command == 'chat':
                            egoPrompt = 'Chat log:\n' + '\n'.join(gameLinesBuffer) + '\n' + mind
                            anyChat = som.call_ego(egoPrompt, OAIClient)
                            anyChat = anyChat.removeprefix('Chat: ')

                            print('[Ego] Voice:')
                            print(anyChat)
                            comm.send_command('chat ' + anyChat)
                        else:
                            comm.send_command(command)
            except SyntaxError:
                gameInfo['failedTasks'].append(taskString)


def parse_commands(server, logLines, listeners, gameInfo, OAIClient):
    if len(logLines) == 0 or 'system call' not in logLines[-1].lower():
        return
    # Perform the search
    match = re.match(r"^<([^>]+)>\s*(.+)$", logLines[-1])
    username = match.group(1)
    msg = match.group(2)

    if username not in listeners:
        you_are_alone(server, username)
        return

    try:
        cmdList = parse_command(msg)['system call']
        #print(cmdList)

        if len(cmdList) == 0:
            show_failure_effect(server, username)
        for cmd in cmdList:
            res = run_system_call(server, cmd, gameInfo, OAIClient)
            if res:
                show_success_effects(server, username)
            else:
                show_failure_effect(server, username)

    except Exception as e:
        show_failure_effect(server, username)
