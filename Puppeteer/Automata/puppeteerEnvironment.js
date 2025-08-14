const { OctahedronIterator } = require('prismarine-world').iterators
const config = require('../Intrisics/puppeteerConfig')
const state = require('../Intrisics/puppeteerState')

function getDifference(setA, setB) {
    return new Set(
        [...setA].filter(element => !setB.has(element))
    )
}

function slotsToDict(items, filterF) {
    let filteredItems = items.filter(filterF)
    let itemsDict = {}
    for (let i in filteredItems) {
        const a = filteredItems[i]
        if (!(a.name in itemsDict)) {
            itemsDict[a.name] = 0
        }
        itemsDict[a.name] += a.count
    }
    return itemsDict
}


function getSortedEntities(bot) {
    let nearbyEntities = bot.entities
    const nowPos = bot.entity.position

    let entArr = []

    for (let ek in nearbyEntities) {
        let ent = {
            distance : nowPos.distanceTo(nearbyEntities[ek].position),
            name : nearbyEntities[ek]?.name !== 'player' ? nearbyEntities[ek].name : (nearbyEntities[ek]?.username + ' (player)')
        }
        if (ent.name !== (config.BOT_USERNAME + ' (player)')) {
            entArr.push(ent)
        }
    }

    entArr.sort((a,b) => a.distance - b.distance)
    entArr.forEach((item, index, arr) => arr[index] = item.name)

    return entArr
}

function getNearbyBlocks(bot) {
    const nowPos = bot.entity.position
    const octIterator = new OctahedronIterator(nowPos,32)

    let nbBlocks = new Set(String())

    let n = octIterator.next()
    while (n) {
        let scanB = bot.world.getBlock(n)
        if (scanB && bot.canSeeBlock(scanB)) {
            nbBlocks.add(scanB.name)
        }
        n = octIterator.next()
    }

    nbBlocks.delete('air')
    return nbBlocks
}

function getInternalState (bot) {
    let stateString = ''
    const biomeId = bot.blockAt(bot.entity.position.offset(0,-1,0)).biome.id
    stateString += `Bioma: ${state.mcData.biomes[biomeId.toString()].name}\n`
    stateString += `Tiempo: ${bot.time.timeOfDay} \n`
    const nowNearby = getNearbyBlocks(bot)
    stateString += `Bloques cercanos: [${Array.from(nowNearby)}]\n`
    stateString += `Bloques recientes: [${Array.from(getDifference(state.lastNearby, nowNearby))}]\n`
    stateString += `Entidades cercanas (de mas cercanas a más lejanas): [${getSortedEntities(bot)}]\n`
    stateString += `Vida: ${bot.health}\n`
    stateString += `Hambre: ${bot.food}\n`
    stateString += `Posición: ${bot.entity.position.toString()}\n`

    const equipmentSlots = [5,6,7,8]
    const inv = slotsToDict(bot.inventory.slots, val => val && !equipmentSlots.includes(val?.slot))
    const equip = slotsToDict(bot.inventory.slots, val => val && equipmentSlots.includes(val?.slot))
    let equipArray = [...Object.keys(equip)];
    stateString += `Equipamento: [${equipArray}]\n`
    stateString += `Inventario: ${JSON.stringify(inv)}`
    state.lastNearby = nowNearby

    return stateString
}

module.exports = {
    getInternalState
}