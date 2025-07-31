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
    'TheAdminstrator',
    'Diegloria',
    'Xerachu',
    'Joseph8123',
    'n0Ne5060'
]


def guardian(server, logLines):
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

