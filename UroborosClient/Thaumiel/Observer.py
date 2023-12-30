import re
# Test box -816 70 2307

PLAYER_WHITELIST = [
    '1s_n0Ne',
    'isytis200',
    'AiMisao',
    'Ayotl_uwu',
    'MetalDarken09',
    'CarlosFachero',
    'Shaoran2020',
    'QuesoBadasDabas',
    'Deltax10',
    'LordAngel1124',
    'TheAdminstrator'
]


def BelugaKey(server, logLines, gameInfo):
    if not gameInfo['enmaCaptured'] or len(logLines) < 1:
        return

    match = re.match(r"^<([^>]+)>\s*(.+)$", logLines[-1])

    if not match:
        return

    username = match.group(1)
    msg = match.group(2)

    if username == 'AiMisao' and 'beluga' in msg.lower():
        gameInfo['enmaCaptured'] = False
        releaseMessage = 'tellraw @a ["",{"text":"[UROBOROS","color":"green"},{"text":" -","color":"green"},{"text":" Thaumiel","color":"red"},{"text":" Vb0.01","italic":true,"color":"gray"},{"text":"]","color":"green"},{"text":" WARNING","bold":true,"color":"dark_red"},{"text":" Releasing anomaly "},{"text":"'+username+'","underlined":true,"color":"yellow"}]'
        server.command(releaseMessage)
        # server.command('tp 1s_n0Ne -875 69 2311')
        server.command('tp AiMisao 1187 121 1294')


def Guardian(server, logLines):
    for line in logLines:
        pattern = r"^(.*?) ha vuelto al vicio\.$"

        global PLAYER_WHITELIST
        match = re.search(pattern, line)
        if match:
            username = match.group(1)
            print(username)

            anomalyAlert = 'tellraw @a ["",{"text":"[UROBOROS","color":"green"},{"text":" -","color":"green"},{"text":" Thaumiel","color":"red"},{"text":" Vb0.01","italic":true,"color":"gray"},{"text":"]","color":"green"},{"text":" "},{"text":"Anomaly detected!","bold":true,"underlined":true,"color":"red","hoverEvent":{"action":"show_text","contents":"Detection: '+username+'"}}]'
            if username not in PLAYER_WHITELIST:
                res = server.command(anomalyAlert)
                print(res)

