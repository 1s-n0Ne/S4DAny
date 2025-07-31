import requests

command_url = 'http://127.0.0.1:3000/Command'
awake_url = 'http://127.0.0.1:3000/AnyUp'
state_url = 'http://127.0.0.1:3000/GetInernal'

def get_any_internal_state():
    try:
        res = requests.get(state_url)
        if res.status_code == 200:
            return res.text
    except requests.exceptions.ConnectionError:
            print('[Puppeteer] Could not connect to Puppeteer')
    return None


def any_is_awake():
    try:
        res = requests.get(awake_url)
        if res.status_code == 200:
            return res.text == 'true'
    except requests.exceptions.ConnectionError:
        return False


def send_command(command):
    try:
        res = requests.post(url=command_url,
                            json={'command': command})
        if res.status_code == 200:
            return True

    except requests.exceptions.ConnectionError:
        return False
