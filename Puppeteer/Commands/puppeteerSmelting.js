// puppeteerSmelting.js - Furnace interaction and smelting functionality
const explorer = require('./puppeteerExplorer')
const state = require('../Intrisics/puppeteerState')
const smeltUtil = require('../Intrisics/puppeteerSmeltUtil')

const { createModuleLogger } = require('../System/puppeteerLogger')
const log = createModuleLogger('Smelting')

// Helper function to get fuel value for an item
function getFuelValue(itemName) {
    // Direct lookup
    if (smeltUtil.FUEL_VALUES[itemName]) {
        return smeltUtil.FUEL_VALUES[itemName]
    }

    // Check for partial matches (e.g., any type of log, planks, etc.)
    for (const [fuelType, value] of Object.entries(smeltUtil.FUEL_VALUES)) {
        if (itemName.includes(fuelType.replace('_', '')) ||
            (fuelType.includes('log') && itemName.includes('log')) ||
            (fuelType.includes('wood') && itemName.includes('wood')) ||
            (fuelType.includes('planks') && itemName.includes('planks')) ||
            (fuelType.includes('slab') && itemName.includes('slab') && itemName.includes('wood')) ||
            (fuelType.includes('boat') && itemName.includes('boat'))) {
            return value
        }
    }

    return 0 // Not a fuel item
}

// Helper function to find the best fuel item in inventory
function findBestFuel(bot, requiredBurnTime) {
    const fuelItems = bot.inventory.items().filter(item => getFuelValue(item.name) > 0)

    if (fuelItems.length === 0) {
        return null
    }

    // Group fuel items by type to calculate total available burn time per type
    const fuelGroups = {}
    for (const item of fuelItems) {
        const fuelValue = getFuelValue(item.name)
        const totalBurnTime = item.count * fuelValue

        if (!fuelGroups[item.name]) {
            fuelGroups[item.name] = {
                item: item,
                fuelValue: fuelValue,
                totalCount: item.count,
                totalBurnTime: totalBurnTime
            }
        } else {
            // If we have multiple stacks of the same fuel type, combine them
            fuelGroups[item.name].totalCount += item.count
            fuelGroups[item.name].totalBurnTime += totalBurnTime
        }
    }

    // Convert to array and sort by best choice
    const fuelOptions = Object.values(fuelGroups)

    fuelOptions.sort((a, b) => {
        // Priority 1: Can this fuel type provide enough burn time?
        const aCanProvide = a.totalBurnTime >= requiredBurnTime
        const bCanProvide = b.totalBurnTime >= requiredBurnTime

        if (aCanProvide && !bCanProvide) return -1  // a is better
        if (!aCanProvide && bCanProvide) return 1   // b is better

        if (aCanProvide && bCanProvide) {
            // Both can provide enough, prefer the one with less waste
            const aWaste = a.totalBurnTime - requiredBurnTime
            const bWaste = b.totalBurnTime - requiredBurnTime
            return aWaste - bWaste
        } else {
            // Neither can provide enough, prefer the one with higher total burn time
            return b.totalBurnTime - a.totalBurnTime
        }
    })

    return fuelOptions[0].item
}

// Helper function to check if an item can be smelted
function isSmeltable(itemName) {
    // Get recipe information from minecraft-data
    const Recipe = require('prismarine-recipe')(state.bot.version).Recipe
    const itemType = state.mcData.itemsByName[itemName]

    if (!itemType) return false

    // Check if the item name contains any of the smeltable types
    return smeltUtil.SMELTABLE_ITEMS.some(smeltable =>
        itemName.includes(smeltable) ||
        (smeltable.includes('log') && itemName.includes('log')) ||
        (smeltable.includes('ore') && itemName.includes('ore'))
    )
}

// Helper function to get smelting result
function getSmeltingResult(itemName) {
    // Check for logs -> charcoal
    if (itemName.includes('log') || itemName.includes('wood') ||
        itemName.includes('stem') || itemName.includes('hyphae')) {
        return 'charcoal'
    }

    // Direct lookup
    for (const [input, output] of Object.entries(smeltUtil.SMELTING_RESULTS)) {
        if (itemName.includes(input)) {
            return output
        }
    }

    return null
}

// Main smelting function
async function smelt(bot, itemName, amount = 1) {
    log.info(`Attempting to smelt ${amount} ${itemName}`)

    // Validate item exists and is smeltable
    const itemType = state.mcData.itemsByName[itemName]
    if (!itemType) {
        throw new Error(`Unknown item: ${itemName}`)
    }

    if (!isSmeltable(itemName)) {
        throw new Error(`${itemName} cannot be smelted`)
    }

    // Check if we have the items to smelt
    const itemsInInventory = bot.inventory.items().filter(item => item.name === itemName)
    const totalAvailable = itemsInInventory.reduce((sum, item) => sum + item.count, 0)

    if (totalAvailable === 0) {
        throw new Error(`No ${itemName} in inventory`)
    }

    if (totalAvailable < amount) {
        log.warn(`Only have ${totalAvailable} ${itemName}, will smelt what's available`)
        amount = totalAvailable
    }

    // Find nearest furnace
    log.info('Looking for furnace...')
    const furnaceBlock = await explorer.findBlock(bot, 'furnace')
    const blastFurnaceBlock = await explorer.findBlock(bot, 'blast_furnace')
    const smokerBlock = await explorer.findBlock(bot, 'smoker')

    let targetFurnace = furnaceBlock

    // Prefer blast furnace for ores, smoker for food
    if (itemName.includes('ore') || itemName.includes('raw_iron') ||
        itemName.includes('raw_gold') || itemName.includes('raw_copper')) {
        targetFurnace = blastFurnaceBlock || furnaceBlock
    } else if (itemName.includes('raw_') || itemName.includes('potato')) {
        targetFurnace = smokerBlock || furnaceBlock
    }

    if (!targetFurnace) {
        throw new Error('No furnace found nearby')
    }

    log.info(`Found furnace at ${targetFurnace.position}`)

    // Move to furnace
    await explorer.moveToBlock(bot, targetFurnace)

    // Wait a bit to ensure we're in position
    await new Promise(resolve => setTimeout(resolve, 500))

    // Open the furnace
    let furnace
    try {
        furnace = await bot.openFurnace(targetFurnace)
    } catch (error) {
        throw new Error(`Failed to open furnace: ${error.message}`)
    }

    try {
        // Check current furnace state
        const currentFuel = furnace.fuelItem()
        const currentInput = furnace.inputItem()
        const currentOutput = furnace.outputItem()

        log.info(`Furnace state - Fuel: ${currentFuel?.name || 'empty'}, Input: ${currentInput?.name || 'empty'}, Output: ${currentOutput?.name || 'empty'}`)

        // Calculate required burn time
        const requiredBurnTime = amount * smeltUtil.SMELTING_TIME
        let availableBurnTime = 0

        // Check if furnace is already burning
        if (furnace.fuel) {
            availableBurnTime = furnace.fuel
            log.info(`Furnace has ${availableBurnTime} ticks of fuel remaining`)
        }

        // Check fuel slot
        if (currentFuel) {
            const fuelValue = getFuelValue(currentFuel.name)
            availableBurnTime += currentFuel.count * fuelValue
            log.info(`Fuel slot has ${currentFuel.count} ${currentFuel.name} (${currentFuel.count * fuelValue} ticks)`)
        }

        // Add fuel if needed (FIXED VERSION)
        if (availableBurnTime < requiredBurnTime) {
            const neededBurnTime = requiredBurnTime - availableBurnTime
            log.info(`Need ${neededBurnTime} more ticks of fuel`)

            const fuelItem = findBestFuel(bot, neededBurnTime)
            if (!fuelItem) {
                throw new Error('No suitable fuel in inventory')
            }

            const fuelValue = getFuelValue(fuelItem.name)
            const fuelNeeded = Math.ceil(neededBurnTime / fuelValue) // This calculates how many items we need
            const fuelToAdd = Math.min(fuelNeeded, fuelItem.count) // Don't exceed what we have

            log.info(`Adding ${fuelToAdd} ${fuelItem.name} as fuel (${fuelToAdd * fuelValue} ticks total)`)
            await furnace.putFuel(fuelItem.type, null, fuelToAdd)

            // Wait for fuel to register
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        // Put items to smelt
        log.info(`Adding ${amount} ${itemName} to smelt`)
        const itemToSmelt = itemsInInventory[0]
        await furnace.putInput(itemToSmelt.type, null, amount)

        // Wait for smelting to start
        await new Promise(resolve => setTimeout(resolve, 1000))

        // IMPROVED MONITORING SECTION STARTS HERE
        // Monitor smelting progress with furnace stop detection
        let smeltedCount = 0
        const startTime = Date.now()
        const maxWaitTime = (amount * smeltUtil.SMELTING_TIME * 50) + 10000 // Convert ticks to ms, add buffer
        let lastProgress = 0 // Track progress to detect if furnace stopped
        let stuckCounter = 0 // Counter for how many times progress hasn't changed
        const maxStuckChecks = 3 // How many times we allow no progress before considering it stuck

        log.info(`Starting smelting monitor. Expecting ${amount} items over ${maxWaitTime/1000} seconds`)

        while (smeltedCount < amount) {
            // Check if we've waited too long
            if (Date.now() - startTime > maxWaitTime) {
                log.warn('Smelting taking too long, finishing with what we have...')
                break
            }

            // Check furnace state
            const currentProgress = furnace.progress || 0 // Current smelting progress (0-1)
            const currentFuel = furnace.fuel || 0 // Remaining fuel ticks
            const inputItem = furnace.inputItem()
            const outputItem = furnace.outputItem()

            log.debug(`Furnace state - Progress: ${(currentProgress * 100).toFixed(1)}%, Fuel: ${currentFuel} ticks, Input: ${inputItem?.count || 0}, Output: ${outputItem?.count || 0}`)

            // Check if furnace has stopped smelting
            const hasStopped = (
                currentProgress === 0 && // No current progress
                currentFuel === 0 && // No fuel remaining
                inputItem && inputItem.count > 0 // Still has items to smelt
            )

            if (hasStopped) {
                log.warn('Furnace has stopped smelting but still has items to process!')
                log.info('Possible causes: ran out of fuel, furnace blocked, or fuel slot full')

                // Try to diagnose and fix the issue
                try {
                    // Check if we need more fuel
                    const remainingItems = inputItem.count
                    const remainingBurnTime = remainingItems * smeltUtil.SMELTING_TIME

                    if (currentFuel < remainingBurnTime) {
                        log.info('Furnace ran out of fuel, attempting to add more...')

                        const fuelItem = findBestFuel(bot, remainingBurnTime)
                        if (fuelItem) {
                            const fuelValue = getFuelValue(fuelItem.name)
                            const fuelNeeded = Math.ceil(remainingBurnTime / fuelValue)
                            const fuelToAdd = Math.min(fuelNeeded, fuelItem.count)

                            log.info(`Adding ${fuelToAdd} ${fuelItem.name} to restart smelting`)
                            await furnace.putFuel(fuelItem.type, null, fuelToAdd)

                            // Wait for furnace to restart
                            await new Promise(resolve => setTimeout(resolve, 2000))
                            continue // Go back to monitoring
                        } else {
                            log.error('No more fuel available to continue smelting')
                            break // Exit the loop
                        }
                    } else {
                        log.error('Furnace stopped for unknown reasons (has fuel but not smelting)')
                        break // Exit the loop
                    }
                } catch (error) {
                    log.error(`Failed to restart furnace: ${error.message}`)
                    break // Exit the loop
                }
            }

            // Check for progress stagnation (furnace might be stuck)
            if (currentProgress === lastProgress && currentProgress > 0) {
                stuckCounter++
                if (stuckCounter >= maxStuckChecks) {
                    log.warn(`Furnace appears stuck at ${(currentProgress * 100).toFixed(1)}% progress`)
                    log.info('Furnace may be blocked or experiencing issues, finishing with current output...')
                    break
                }
            } else {
                stuckCounter = 0 // Reset counter if progress changed
            }
            lastProgress = currentProgress

            // Check output slot and collect items
            if (outputItem && outputItem.count > 0) {
                try {
                    // Take the output
                    const taken = await furnace.takeOutput()
                    if (taken && taken.count > 0) {
                        smeltedCount += taken.count
                        log.info(`Collected ${taken.count} ${taken.name}. Total: ${smeltedCount}/${amount}`)
                        stuckCounter = 0 // Reset stuck counter on successful collection
                    }
                } catch (error) {
                    log.error(`Failed to take output: ${error.message}`)
                    // Continue monitoring even if we can't take output this time
                }
            }

            // Wait before checking again
            await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // Final collection attempt in case there are items in output slot
        try {
            const finalOutput = furnace.outputItem()
            if (finalOutput && finalOutput.count > 0) {
                log.info('Collecting any remaining output...')
                const taken = await furnace.takeOutput()
                if (taken && taken.count > 0) {
                    smeltedCount += taken.count
                    log.info(`Final collection: ${taken.count} ${taken.name}. Final total: ${smeltedCount}`)
                }
            }
        } catch (error) {
            log.warn(`Failed final output collection: ${error.message}`)
        }
        // IMPROVED MONITORING SECTION ENDS HERE

        // Close the furnace
        furnace.close()

        const resultName = getSmeltingResult(itemName)

        // Check if we completed the full amount
        if (smeltedCount < amount) {
            log.warn(`Smelting incomplete: got ${smeltedCount}/${amount} ${resultName}`)
            throw new Error(`Only able to smelt ${smeltedCount}`)
        }

        log.info(`Successfully smelted ${smeltedCount} ${itemName} into ${resultName}`)

        return {
            success: true,
            itemName: itemName,
            requested: amount,
            smelted: smeltedCount,
            result: resultName,
            message: `Successfully smelted ${smeltedCount} ${itemName} into ${resultName}`
        }

    } catch (error) {
        // Make sure to close furnace on error
        if (furnace) {
            furnace.close()
        }
        throw error
    }
}

module.exports = { smelt }