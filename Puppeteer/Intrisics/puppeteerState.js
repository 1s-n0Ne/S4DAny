// state.js - Centralized state management
class BotState {
    constructor() {
        // Connection state
        this.ANY_READY = false
        this.ANY_SHOULD_LOG_IN = false

        // Bot references
        this.bot = null
        this.mcData = null
        this.movements = null

        // Physical environment variables
        this.lastNearby = new Set(String())

        // Activity tracking
        this.lastActivityTime = Date.now()

        // Wandering behavior state
        this.isWandering = false
        this.wanderingStartTime = 0
        this.targetMob = null

        // Item pickup behavior state
        this.isPickingUpItem = false
        this.targetItem = null

        // Combat behavior state
        this.isInCombat = false
        this.isRetreating = false
        this.retreatStartTime = 0

        this.isFollowing = false
        this.followingTarget = null
        this.followingStartTime = 0
        this.targetLastPosition = null
        this.targetStationaryStartTime = 0
        this.targetStationaryArea = null
    }

    // Reset all idle behaviors
    resetAllIdleBehaviors() {
        if (this.isWandering) {
            console.log('Stopping wandering')
            this.isWandering = false
            this.targetMob = null
        }

        this.stopItemPickup()
        this.stopCombat()

        if (this.bot && this.bot.pathfinder) {
            this.bot.pathfinder.setGoal(null)
        }

        this.lastActivityTime = Date.now()
    }

    // Stop item pickup behavior
    stopItemPickup() {
        if (this.isPickingUpItem) {
            console.log('Stopping item pickup')
            this.isPickingUpItem = false
            this.targetItem = null
            if (this.bot && this.bot.pathfinder) {
                this.bot.pathfinder.setGoal(null)
            }
        }
    }

    // Stop combat behavior
    stopCombat() {
        if (this.isInCombat || this.isRetreating) {
            console.log('Stopping combat')
            this.isInCombat = false
            this.isRetreating = false
            if (this.bot && this.bot.pathfinder) {
                this.bot.pathfinder.setGoal(null)
            }
        }
    }

    // Update activity time
    updateActivity() {
        this.lastActivityTime = Date.now()
    }

    // Get time since last activity
    getTimeSinceLastActivity() {
        return Date.now() - this.lastActivityTime
    }
}

// Export singleton instance
module.exports = new BotState()