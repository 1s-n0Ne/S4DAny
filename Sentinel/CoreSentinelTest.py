import time
from javascript import require, On, Once
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


def getNearbyBlocks(bot):
    nowPos = bot.entity.position
    world = bot.world
    nbBlocks = set()

    iterators = require('prismarine-world').iterators
    itera = iterators.OctahedronIterator(nowPos, 5)

    n = itera.next()
    while n:
        scanB = world.getBlock(n)
        if scanB and bot.canSeeBlock(scanB):
            nbBlocks.add(scanB.displayName)
        n = itera.next()

    nbBlocks.remove('Air')
    return nbBlocks


def searchInventory(inventorySlots):
    equipmentSlots = {
        # 'hand': 36,
        # 'secondaryHand': 45,
        'head': 5,
        'torso': 6,
        'legs': 7,
        'feet': 8
    }

    equipment = []
    inventory = {}
    for item in inventorySlots:
        if item:
            if item.slot in equipmentSlots.values():
                equipment.append(item.name)
            else:
                if item.name not in inventory:
                    inventory[item.name] = item.count
                else:
                    inventory[item.name] += item.count

    return equipment, inventory


def getEntities(bot):
    nowPos = bot.entity.position
    entitiesArray = []
    for entityKey in bot.entities:
        if not entityKey:
            continue
        distance = nowPos.distanceTo(bot.entities[entityKey].position)
        name = bot.entities[entityKey].displayName or bot.entities[entityKey].username + ' (player)'

        entitiesArray.append((distance, name))
    entitiesArray.sort()

    return [ent[1] for ent in entitiesArray[1:]]


def GulliverPuppeteer(mineflayerModule, bot_options, modules):
    bot = mineflayerModule.createBot(bot_options)

    bot.loadPlugin(modules[0].pathfinder)
    print("Started mineflayer")

    @Once(bot, 'spawn')
    def handle(*args):
        print("I spawned 👋")
        # movements = pathfinder.Movements(bot)
        mcData = require('minecraft-data')(bot.version)
        lastNearby = getNearbyBlocks(bot)

        @On(bot, 'chat')
        def handleMsg(this, sender, message, *args):
            if sender and (sender != bot_options['username']):
                if 'state' in message.lower():
                    biomeId = bot.blockAt(bot.entity.position.offset(0, -1, 0)).biome.id
                    print(f'Bioma: {mcData.biomes[f"{biomeId}"].name}')
                    print(f'Tiempo: {bot.time.timeOfDay}')
                    nowNearby = getNearbyBlocks(bot)
                    nonlocal lastNearby
                    print(f'Bloques cercanos: {list(nowNearby)}')
                    print(f'Bloques recientes: {list(lastNearby - nowNearby)}')
                    print(f'Entidades cercanas (de mas cercanas a más lejanas): {getEntities(bot)}')
                    print(f'Vida: {bot.health}')
                    print(f'Hambre: {bot.food}')
                    print(f'Posición: {bot.entity.position.toString()}')
                    botEquip, botInv = searchInventory(bot.inventory.slots)
                    print(f'Equipamento: {", ".join(botEquip)}')
                    print(f'Inventario ({len(botInv)}/36): {botInv}')
                    # print(f'Tarea')
                    lastNearby = nowNearby

    return bot


# Define a variable to hold the bot instance
bot_instance = None


def main():
    BOT_USERNAME = 'N1kt3'

    # Set up the Mineflayer bot creation configurations
    bot_options = {
        'host': 'localhost',  # Adjust as needed
        'port': 25565,  # Adjust as needed, default Minecraft port is 25565
        'username': BOT_USERNAME,
        # 'password': ''  # Only if needed for online servers
    }

    mineflayer = require('mineflayer')
    pathfinder = require('mineflayer-pathfinder')
    # Apply additional requires if needed, such as `pathfinder` or others

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

                    # --------------------
                    # Bot logic block
                    for line in gameLines:
                        print(line)
                        global bot_instance
                        if 'activate ap' in line.lower() and bot_instance is None:
                            # Code to spawn a new bot
                            # bot_instance = mineflayer.createBot({
                            #     # 'host': '31.220.22.175',
                            #     'host': 'localhost',
                            #     'port': 25565,
                            #     'username': BOT_USERNAME
                            # })
                            # bot_instance.loadPlugin(pathfinder.pathfinder)

                            bot_instance = GulliverPuppeteer(mineflayer, bot_options, [pathfinder])

                        elif 'ap stop' in line.lower() and bot_instance is not None:
                            # Code to log out the bot
                            bot_instance.quit()
                            bot_instance.removeAllListeners('chat')
                            bot_instance = None

                            print(f'Bot {BOT_USERNAME} has been logged out.')
                    # --------------------

            previousContent = f.read()
            time.sleep(0.25)


if __name__ == '__main__':
    main()
