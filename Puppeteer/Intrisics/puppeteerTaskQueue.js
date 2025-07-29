// puppeteerTaskQueue.js - Task queue management for sequential command processing
const EventEmitter = require('events')

class TaskQueue extends EventEmitter {
    constructor() {
        super()
        this.queue = []
        this.isProcessing = false
        this.currentTask = null
        this.shouldStop = false
    }

    // Add a task to the queue
    enqueue(task) {
        console.log(`Adding task to queue: ${task.name}`)
        this.queue.push(task)
        this.emit('taskAdded', task)

        // Start processing if not already doing so
        if (!this.isProcessing) {
            this.processNext()
        }
    }

    // Process the next task in the queue
    async processNext() {
        // Check if we should stop or if queue is empty
        if (this.shouldStop || this.queue.length === 0) {
            this.isProcessing = false
            this.currentTask = null
            return
        }

        this.isProcessing = true
        this.currentTask = this.queue.shift()

        console.log(`Processing task: ${this.currentTask.name}`)
        this.emit('taskStarted', this.currentTask)

        try {
            // Execute the task
            await this.currentTask.execute()

            console.log(`Task completed: ${this.currentTask.name}`)
            this.emit('taskCompleted', this.currentTask)
        } catch (error) {
            console.error(`Task failed: ${this.currentTask.name}`, error)
            this.emit('taskFailed', this.currentTask, error)
        }

        this.currentTask = null

        // Process next task
        if (this.queue.length > 0 && !this.shouldStop) {
            // Small delay to prevent tight loops
            setTimeout(() => this.processNext(), 100)
        } else {
            this.isProcessing = false
        }
    }

    // Stop processing tasks
    stop() {
        console.log('Stopping task queue')
        this.shouldStop = true
        this.emit('queueStopped')
    }

    // Resume processing tasks
    resume() {
        console.log('Resuming task queue')
        this.shouldStop = false
        if (!this.isProcessing && this.queue.length > 0) {
            this.processNext()
        }
        this.emit('queueResumed')
    }

    // Clear all pending tasks
    clear() {
        console.log('Clearing task queue')
        this.queue = []
        this.emit('queueCleared')
    }

    // Get current queue status
    getStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            currentTask: this.currentTask ? this.currentTask.name : null,
            shouldStop: this.shouldStop,
            pendingTasks: this.queue.map(task => task.name)
        }
    }

    // Cancel current task if possible
    cancelCurrent() {
        if (this.currentTask && this.currentTask.cancel) {
            console.log(`Cancelling current task: ${this.currentTask.name}`)
            this.currentTask.cancel()
            this.emit('taskCancelled', this.currentTask)
        }
    }
}

// Task factory for creating different types of tasks
class Task {
    constructor(name, executeFn, cancelFn = null) {
        this.name = name
        this.execute = executeFn
        this.cancel = cancelFn
        this.createdAt = Date.now()
    }
}

// Export singleton instance
module.exports = new TaskQueue()