const EventEmitter = require('eventemitter3')

class Game extends EventEmitter {
  constructor({title, passage, callbacks}) {
    let flags = {}
    let ui = null
    let score = 0
    let skipLines = []
    let autoPlay = false
    let inventory = {}
    let timers = {}
    let timerFuncs = {}

    super()
    this.title = title

    if (typeof (callbacks) !== 'undefined') {
      if (typeof (callbacks) === 'object' && !Array.isArray(callbacks)) {
        Object.keys(callbacks).forEach(
          (eventName) => {
            this.on(
              eventName,
              function() {
                try {
                  callbacks[eventName].apply(
                    this,
                    Array.from(arguments)
                  )
                } catch (err) {
                  console.error(err)
                }
              }
            )
          }
        )
      }
    }

    this.passage = passage
    this.get = key => flags[key]
    this.set = async (key, value) => {
      if (value !== flags[key]) {
        flags[key] = value

        try {
          await this.emit(`set.${key}`, value, this)
        } catch (err) {
          console.error(err)
          return
        }

        if (this.passage) {
          try {
            await this.passage.emit(`game.set.${key}`, value, this, this.passage)
            await this.passage.emit('game.set', key, value, this, this.passage)
          } catch (err) {
            console.error(err)
            return
          }
        }
      }
    }

    this.play = async (uiName, script, playAuto) => {
      const CLI = require(`../ui/${uiName}`)
      ui = new CLI(this)

      if (typeof (script) !== 'undefined') {
        skipLines = script
      }

      if (typeof (playAuto) === 'boolean') {
        autoPlay = playAuto
      }

      await this.emit('starting', this)
      await ui.start(this)
      await this.emit('started', this)

      if (this.passage) {
        await ui.show(this.passage)
        this.emit('ready', this)
      }
    }

    this.restart = async () => {
      await this.emit('restarting', this)
      flags = {}
      score = 0
      await this.emit('reset', this)
      await ui.clear()

      this.passage = passage

      await this.emit('started', this)
      if (this.passage) {
        await ui.show(this.passage)
      }
    }

    this.moveTo = async (p) => {
      if (this.passage) {
        await this.passage.emit('exited', this)
      }

      this.passage = p

      const response = await ui.show(p)
      await p.emit('entered', this)
      return response
    }

    this.die = async (p) => {
      if (this.passage) {
        await this.passage.emit('exited', this)
      }

      this.passage = p

      await ui.show(this.passage)
      await this.passage.emit('entered', this)
      await this.restart()
    }

    this.prompt = async () => {
      if (skipLines.length) {
        let line = ''
        let matches = null
        let timerName = null

        try {
          line = skipLines.shift()
          matches = line.match(/^wait ([a-z0-9_]+)$/)

          if (matches) {
            timerName = matches[1]
            if (typeof (timerFuncs[timerName]) !== 'undefined') {
              timerFuncs[timerName]()
              return await this.prompt()
            }
          }
        } catch (err) {
          console.error(err)
          return
        }

        await this.emit('prompting')
        return await ui.prompt(line, autoPlay)
      }

      await this.emit('prompting')
      return await ui.prompt()
    }

    this.say = message => ui.say(message)
    this.plus = (number) => {
      score += number

      if (number) {
        this.emit('score', score, this)
      }
    }

    this.minus = (number) => {
      score -= number

      if (number) {
        this.emit('score', score, this)
      }
    }

    this.take = async (noun, obj) => {
      if (typeof (noun) === 'undefined') {
        throw new Error('Undefined noun')
      }

      const name = obj.name || noun

      if (inventory[noun]) {
        this.say(`You already have the ${name}.`)
        return false
      }

      inventory[noun] = obj
      this.plus(obj.points)
      this.say(`You take the ${name}.`)
      return true
    }

    this.discard = async (noun, obj) => {
      if (typeof (noun) === 'undefined') {
        throw new Error('Undefined noun')
      }

      let name = obj.name || noun
      let plural = obj.plural === true

      if (!inventory[noun]) {
        if (plural) {
          name = `any ${name}`
        } else if (name.match('^[aeiou]')) {
          name = `an ${name}`
        } else {
          name = `a ${name}`
        }

        this.say(`You don't have ${name}.`)
        return false
      }

      delete inventory[noun]
      this.minus(obj.points)
      this.say(`You drop the ${name}.`)
      return true
    }

    this.has = noun => typeof (inventory[noun]) !== 'undefined'

    this.showInventory = () => {
      if (!Object.keys(inventory).length) {
        this.say('You don\'t have anything.')
        return
      }

      let text = 'You have:\n'

      Object.keys(inventory).forEach(
        (noun) => {
          const obj = inventory[noun]
          const plural = obj.plural === true
          let name = obj.name || noun

          if (plural) {
            name = `some ${name}`
          } else if (name.match('^[aeiou]')) {
            name = `an ${name}`
          } else {
            name = `a ${name}`
          }

          text += `  - ${name}\n`
        }
      )

      this.say(text)
    }

    this.withInventory = (func) => Object.keys(inventory).forEach(
      (key) => func(inventory[key], key)
    )

    this.timer = (seconds, name) => new Promise(
      (resolve) => {
        if (typeof (name) === 'undefined') {
          name = 'timer_' + new Date().getTime()
        }

        const go = () => {
          delete timers[name]
          delete timerFuncs[name]
          // console.debug('Timer', name, 'elapsed')
          resolve()
        }

        // console.debug('Set a timer for', seconds, 'second(s)')
        timers[name] = setTimeout(go, seconds * 1000)
        timerFuncs[name] = go
      }
    )

    this.clearTimer = (name) => {
      const timer = timers[name]
      const timerFunc = timerFuncs[name]

      if (typeof (timer) !== 'undefined') {
        // console.debug('Timer', name, 'cleared')
        clearTimeout(timer)
        delete timers[name]
      }

      if (typeof (timerFunc) !== 'undefined') {
        delete timerFuncs[name]
      }
    }

    this.exit = () => {
      while (Object.keys(timers).length) {
        this.clearTimer(
          Object.keys(timers).pop()
        )
      }

      ui.close()
    }

    this.on('action.notfound',
      () => this.say('You try, but it just doesn\'t make sense.')
    )

    this.on('ready',
      async () => {
        let action = null
        let result = null

        try {
          action = await this.prompt()
        } catch (err) {
          console.error(err)
          return
        }

        if (action) {
          try {
            result = await this.passage.do(this, action)
          } catch (err) {
            console.error(err)
            return
          }

          if (result === null) {
            await this.emit('action.notfound')
          }
        }

        await this.emit('ready')
      }
    )

    this.on('score',
      (number) => {
        // console.debug('Score:', number)
      }
    )
  }
}

Game.extend = (opts) => {
  return new Game(opts)
}

module.exports = Game
