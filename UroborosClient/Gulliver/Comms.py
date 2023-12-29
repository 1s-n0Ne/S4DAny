import requests


command_url = 'http://127.0.0.1:3000/Command'
awake_url = 'http://127.0.0.1:3000/AnyUp'
state_url = 'http://127.0.0.1:3000/GetInernal'


def getAnyInternalState():
    try:
        res = requests.get(state_url)
        if res.status_code == 200:
            return res.text
    except requests.exceptions.ConnectionError:
        with open('logs/sombralatest.log', 'a') as f:
            print('[Puppeteer] Could not connect to Puppeteer', file=f)
    return None


def anyIsAwake():
    try:
        res = requests.get(awake_url)
        if res.status_code == 200:
            return res.text == 'true'
    except requests.exceptions.ConnectionError:
        return False


def sendCommand(command):
    try:
        res = requests.post(url=command_url,
                            json={'command': command})
        if res.status_code == 200:
            return True

    except requests.exceptions.ConnectionError:
        return False
