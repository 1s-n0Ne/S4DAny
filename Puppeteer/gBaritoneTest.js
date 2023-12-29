const mineflayer = require('mineflayer')
const pathfinder = require('mineflayer-pathfinder').pathfinder
const Movements = require('mineflayer-pathfinder').Movements
const collector = require('mineflayer-collectblock').plugin
const { GoalLookAtBlock,GoalNear } = require('mineflayer-pathfinder').goals
const toolPlugin = require('mineflayer-tool').plugin;
// const Vec3 = require('vec3').Vec3
const { OctahedronIterator } = require('prismarine-world').iterators
const pvp = require('mineflayer-pvp').plugin
const autoeat = require('mineflayer-auto-eat').plugin
const armorManager = require("mineflayer-armor-manager");

const express = require('express')
const bodyParser = require('body-parser')

const app = express()
const port = 3000

app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.get('/AnyUp', (req, res) => {
    res.send(ANY_READY)
})

app.get('/GetInernal',(req, res) => {
    try {
        res.send(getInternalState())
    } catch(e) {
        console.log(e)
        res.status(500).send('Any is not ready')
    }
})

app.post('/Command', async (req, res) => {
    console.log('Recieved command: ' + req.body?.command)
    let args = req.body?.command.split(' ')

    if (args[0] === 'start') {
        if (!ANY_READY) {
            ANY_SHOULD_LOG_IN = true
            initBot()
        }
    }
    if (args[0] === 'stop') {
        if (ANY_READY) {
            ANY_SHOULD_LOG_IN = false
            setTimeout(() => {
                bot.quit()
            })
        }
    }

    if (ANY_READY) {
        if (args[0] === 'chat') {
            args.splice(0,1)
            bot.chat(args.join(' '))
        }
        if (args[0] === 'goto') {
            const x = parseFloat(args[1].replace(",","."))
            const y = parseFloat(args[2].replace(",","."))
            const z = parseFloat(args[3].replace(",","."))
            botGoto(x, y, z)
        }
        if (args[0] === 'goal') {
            gotoBlock(args[1])
        }
        if (args[0] === 'follow') {
            followPlayer(args[1])
        }
        if (args[0] === 'randomwalk') {
            botBusy = true
            while (!await randomExplorer(16,32)) { /* empty */ }
            botBusy = false
        }
        if (args[0] === 'mine') {
            botBusy = true
            let items = []
            for (let i = 1; i < args.length-1; i++) items.push(args[i])
            await mine(items, args.at(-1))
            botBusy = false
        }
        if (args[0] === 'state') {
            let nowString = getInternalState()
            console.log(nowString)
        }
        if (args[0] === 'hunt') {
            botBusy = true
            await huntMob(args[1])
            botBusy = false
        }
    }

    res.send('Command recieved!')
})

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

let ANY_READY = false
let ANY_SHOULD_LOG_IN = false

const BOT_USERNAME = 'N1kt3'
const bot_options = {
    host : 'localhost',
    port : 25565,
    username : BOT_USERNAME,
    auth : 'offline',
    logErrors: false
}

let bot
let mcData, movements
let botBusy = false
let lastNearby = new Set(String())

const initBot = () => {
    bot = mineflayer.createBot(bot_options)
    bot.loadPlugin(pathfinder)
    bot.loadPlugin(toolPlugin)
    bot.loadPlugin(collector)
    bot.loadPlugin(pvp)
    bot.loadPlugin(autoeat)
    bot.loadPlugin(armorManager)

    bot.on('login', () => {
        let botSocket = bot._client.socket;
        console.log(`Logged in at socket ${botSocket}`)
    })

    bot.on('end', () => {
        ANY_READY = false
        botBusy = false
        console.log('Disconnected!!!')
        if (ANY_SHOULD_LOG_IN) {
            setTimeout(initBot, 15000)
        }
    })

    bot.on('error', (err) => {
        ANY_READY = false
        botBusy = false
        if (err.code === 'ECONNREFUSED') {
            console.log('Connection Refused!!!')
        }
    })

    bot.once('spawn', () => {
        mcData = require('minecraft-data')(bot.version)
        movements = new Movements(bot)
        movements.allow1by1towers = false
        movements.canOpenDoors = true

        bot.tool.equipForBlock = bot.tool.equipForBlock.bind(bot.tool);
        bot.autoEat.options.startAt = 17

        ANY_READY = true
        setTimeout(() => {
            lastNearby = getNearbyBlocks()
        }, 500)
    })

    bot.on('physicTick', () => {
        if (bot.pathfinder.isMoving() ||
            bot.pathfinder.isMining() ||
            bot.pathfinder.isBuilding() ||
            botBusy
        ) return

        const entity= bot.nearestEntity()
        // console.log(entity)
        if (entity) {
            bot.lookAt(entity.position.offset(0,entity.height,0))
            let virtualSelf = bot.entity
            if (virtualSelf.isInWater) bot.setControlState('jump',true)
            else bot.setControlState('jump', false)
            let emote = (entity.metadata[0]&0x02) === 0x02
            if (emote != null) bot.setControlState('sneak', emote)

            if (entity.type === 'hostile') {
                equipSword()
                equipShield()
                bot.pvp.attack(entity)
            }
        }
    })
}

function getNearbyBlocks() {
    const nowPos = bot.entity.position
    const octIterator = new OctahedronIterator(nowPos,16)

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

function getSortedEntities() {
    let nearbyEntities = bot.entities
    const nowPos = bot.entity.position

    let entArr = []

    for (let ek in nearbyEntities) {
        let ent = {
            distance : nowPos.distanceTo(nearbyEntities[ek].position),
            name : nearbyEntities[ek]?.name !== 'player' ? nearbyEntities[ek].name : (nearbyEntities[ek]?.username + ' (player)')
        }
        if (ent.name !== (BOT_USERNAME + ' (player)')) {
            entArr.push(ent)
        }
    }

    entArr.sort((a,b) => a.distance - b.distance)
    entArr.forEach((item, index, arr) => arr[index] = item.name)

    return entArr
}

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

function getInternalState () {
    let stateString = ''
    const biomeId = bot.blockAt(bot.entity.position.offset(0,-1,0)).biome.id
    stateString += `Bioma: ${mcData.biomes[biomeId.toString()].name}\n`
    stateString += `Tiempo: ${bot.time.timeOfDay} \n`
    const nowNearby = getNearbyBlocks()
    stateString += `Bloques cercanos: [${Array.from(nowNearby)}]\n`
    stateString += `Bloques recientes: [${Array.from(getDifference(lastNearby, nowNearby))}]\n`
    stateString += `Entidades cercanas (de mas cercanas a más lejanas): [${getSortedEntities()}]\n`
    stateString += `Vida: ${bot.health}\n`
    stateString += `Hambre: ${bot.food}\n`
    stateString += `Posición: ${bot.entity.position.toString()}\n`

    const equipmentSlots = [5,6,7,8]
    const inv = slotsToDict(bot.inventory.slots, val => val && !equipmentSlots.includes(val?.slot))
    const equip = slotsToDict(bot.inventory.slots, val => val && equipmentSlots.includes(val?.slot))
    const equipArray = []
    for (let k in equip) {equipArray.push(k)}
    stateString += `Equipamento: [${equipArray}]\n`
    stateString += `Inventario: ${JSON.stringify(inv)}`
    lastNearby = nowNearby

    return stateString
}

function botGoto(x,y,z) {
    console.log(x,y,z)
    try {
        bot.pathfinder.setMovements(movements)
        bot.pathfinder.setGoal(new GoalNear(x, y, z, 1))
    } catch (e) {
        console.log("Can't get there :(")
    }
}

function followPlayer(username) {
    const target = bot.players[username]?.entity
    if (!target) {
        return
    }

    const { x: playerX, y: playerY, z: playerZ } = target.position

    bot.pathfinder.setMovements(movements)
    bot.pathfinder.setGoal(new GoalNear(playerX, playerY, playerZ, 2))
}

function gotoBlock(blockName) {
    let blockType = mcData.blocksByName[blockName]
    if (!blockType) {
        return false
    }

    let block = bot.findBlock({
        matching: blockType.id,
        maxDistance: 64,
        count: 1
    })

    if (block) {
        let target = block.position
        bot.pathfinder.setMovements(movements)
        bot.pathfinder.setGoal(new GoalLookAtBlock(target, bot.world))

        return block
    }

    return false
}

function randomExplorer(minDist, maxDist, digDeep = false) {
    return new Promise((resolve, reject) => {
        const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        let xOff = randomInt(-1, 1) * randomInt(minDist, maxDist);
        let yOff = digDeep ? randomInt(-15, -5) : 0;
        let zOff = randomInt(-1, 1) * randomInt(minDist, maxDist);

        let newPos = bot.entity.position.offset(xOff, yOff, zOff);

        bot.pathfinder.setMovements(movements); // Make sure 'movements' is defined
        bot.pathfinder.setGoal(new GoalNear(newPos.x, newPos.y, newPos.z, 2));

        bot.once('goal_reached', () => {
            resolve(true);
        });

        bot.on('path_update', (results) => {
            if (results.status === 'noPath') {
                reject(new Error('No path to target!'));
            }
        });

        bot.on('path_stop', () => {
            reject(new Error('Pathfinding was stopped!'));
        });

        bot.on('block_update', async (oldBlock, newBlock) => {
            if (bot.pathfinder.isMoving() && newBlock.type !== 0 && bot.entity.position.distanceTo(newBlock.position) < 2) {
                try {
                    console.log('Changing tool!')
                    await bot.tool.equipForBlock(newBlock);
                    await bot.dig(newBlock);
                } catch (err) {
                    reject(err);
                }
            }
        });
    });
}

async function mine(toMine, nTarget) {
    let totalMined = 0

    bot.collectBlock.movements.allow1by1towers = false

    let blockTypes = []
    for (let i = 0; i<toMine.length; i++)
    {
        console.log(toMine)
        let nowType = mcData.blocksByName[toMine[i]]
        if (!nowType) {
            return
        }
        blockTypes.push(nowType.id)
    }


    let deeper = toMine.includes('_ore')

    const findOptions = {
        matching: blockTypes,
        maxDistance: 64,
        count: nTarget
    }

    let giveUp = false
    let chances = 0
    const MAX_ATTEMPTS = 5
    while (totalMined < nTarget || giveUp) {
        let blocks = bot.findBlocks(findOptions)

        chances = 0
        while (blocks.length === 0 || giveUp) {
            console.log('exploring...')
            try {
                while (!await randomExplorer(64, 100, deeper)) { /* empty */ }
            } catch (e) {
                // nothing :P
            }
            
            console.log('done exploring!')
            blocks = bot.findBlocks(findOptions)

            chances += 1
            giveUp = chances > MAX_ATTEMPTS
        }

        const targets = []
        for (let i = 0; i < Math.min(blocks.length, nTarget); i++) {
            targets.push(bot.blockAt(blocks[i]))
        }
        let succeeded = false
        chances = 0
        while (!succeeded || giveUp) {
            try {
                await bot.collectBlock.collect(targets)
                succeeded = true
            } catch (err) {
                console.log(err)
                console.log('exploring...')
                while (!await randomExplorer(16, 32)) { /* empty */ }
                console.log('done exploring!')
                succeeded = false
                chances += 1
            }

            giveUp = chances > MAX_ATTEMPTS
        }
        totalMined += targets.length
    }
}

function equipSword() {
    const sword = bot.inventory.items().find( item => item.name.includes('sword'))
    if (sword) bot.equip(sword, 'hand')
}

function equipShield() {
    const sword = bot.inventory.items().find( item => item.name.includes('shield'))
    if (sword) bot.equip(sword, 'off-hand')
}

function attackComplete(entity) {
    return new Promise((resolve, reject) => {
        bot.pvp.attack(entity)

        bot.on('stoppedAttacking', () => {
            resolve(true)
        })

        bot.on('path_stop', () => {
            reject(new Error('Pathfinding was stopped!'));
        })
    })
}

async function huntMob(mobType) {
    let nearbyEntities = bot.entities

    let targetEntities = []
    for (let ek in nearbyEntities) {
        if (nearbyEntities[ek]?.name === mobType) {
            targetEntities.push(nearbyEntities[ek])
        }
    }

    equipSword()
    equipShield()

    for (let i in targetEntities) {
        try {
            await attackComplete(targetEntities[i])
        } catch (err){
            // idk
        }
        // bot.chat('Done attacking!')
    }
}

