import re

def parsel3 (module, phrase):
    if module == 'ego':
        if phrase == 'trigger response':
            return phrase
        if re.match(r"get (\w+) perception", phrase):
            return phrase
    elif module == 'sombra':
        if phrase == 'get mindstate':
            return phrase
    elif module == 'gulliver':
        gulliverPrefixes = ['baritone', 'impact', 'paper', 'minecraft']
        for prefix in gulliverPrefixes:
            if phrase.startswith(prefix):
                return prefix,[phrase.replace(f'{prefix} ','')]

    return None

def parseCommand(command):
    command.removeprefix('system call. ')
    phrases = command.split('. ')
    tree = {'system call': []}

    l2 = {'start ap', 'stop ap', 's4d core module', 'select gulliver', 'select sombra', 'select ego', 's4d core module'}

    for phrase in phrases:
        # print(phrase)
        phrase = phrase.replace('.', '')
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
                nextL = parsel3(l1cmd[0].replace('select ', ''), phrase)
                if nextL:
                    tree['system call'][i][1].append(nextL)

    return tree


testcommand = "system call. strt ap. select ego select sombra. get LordAngel11 perception. get mindstate. stop ap."
#testcommand = "system call. start ap."
# testcommand = "system call. select gulliver. impact set target LordAngel11."
# testcommand = ""
cmdlist = parseCommand(testcommand)['system call']

for cmd in cmdlist:
    print(cmd)

print(parseCommand(testcommand))