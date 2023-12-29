# 31.220.22.175:25565
from javascript import require, On, Once, RegExp
import re
mineflayer = require('mineflayer')
pathfinder = require('mineflayer-pathfinder')
iterators = require('prismarine-world').iterators
Vec3 = require('vec3').Vec3

RANGE_GOAL = 1
BOT_USERNAME = 'NIKTE_DEV'

bot = mineflayer.createBot({
    #'host': '31.220.22.175',
    'host': 'localhost',
    'port': 25565,
    'username': BOT_USERNAME
})

bot.loadPlugin(pathfinder.pathfinder)
print("Started mineflayer")

equipmentSlots = {
    # 'hand': 36,
    # 'secondaryHand': 45,
    'head': 5,
    'torso': 6,
    'legs': 7,
    'feet': 8
}


@Once(bot, 'spawn')
def handle(*args):
    print("I spawned 👋")
    # movements = pathfinder.Movements(bot)
    mcData = require('minecraft-data')(bot.version)
    lastNearby = getNearbyBlocks(bot)

    @On(bot, 'chat')
    def handleMsg(this, sender, message, *args):
        if sender and (sender != BOT_USERNAME):
            # if message.lower().startswith('system call!') and 'internal state' in message.lower():
            if 'state' in message.lower():
                biomeId = bot.blockAt(bot.entity.position.offset(0, -1, 0)).biome.id
                print(f'Bioma: {mcData.biomes[f"{biomeId}"].name}')
                print(f'Tiempo: {bot.time.timeOfDay}')
                nowNearby = getNearbyBlocks(bot)
                nonlocal lastNearby
                print(f'Bloques cercanos: {list(nowNearby)}')
                print(f'Bloques recientes: {list(lastNearby - nowNearby)}')
                print(f'Entidades cercanas (de mas cercanas a más lejanas): {getEntities(bot.entities)}')
                print(f'Vida: {bot.health}')
                print(f'Hambre: {bot.food}')
                print(f'Posición: {bot.entity.position.toString()}')
                botEquip, botInv = searchInventory(bot.inventory.slots)
                print(f'Equipamento: {", ".join(botEquip)}')
                print(f'Inventario ({len(botInv)}/36): {botInv}')
                # print(f'Tarea')
                lastNearby = nowNearby


def getNearbyBlocks(bot):
    nowPos = bot.entity.position
    world = bot.world
    nbBlocks = set()

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


def getEntities(nearbyEntities):
    nowPos = bot.entity.position
    entitiesArray = []
    for entityKey in nearbyEntities:
        if not entityKey:
            continue
        distance = nowPos.distanceTo(nearbyEntities[entityKey].position)
        name = bot.entities[entityKey].displayName or bot.entities[entityKey].username + ' (player)'

        entitiesArray.append((distance, name))
    entitiesArray.sort()

    return [ent[1] for ent in entitiesArray[1:]]


@On(bot, "end")
def handle(*args):
    print("Bot ended!", args)