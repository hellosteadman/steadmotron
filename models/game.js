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

      while (Object.keys(timers).length) {
        this.clearTimer(
          Object.keys(timers)[0]
        )
      }

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
      await p.emit('entering', this)

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

    this.end = async (p) => {
      if (this.passage) {
        await this.passage.emit('exited', this)
      }

      this.passage = p
      this.ended = true

      while (Object.keys(timers).length) {
        this.clearTimer(
          Object.keys(timers).pop()
        )
      }

      await ui.show(this.passage)
      await this.passage.emit('entered', this)

      await ui.say(
        `Thank you for playing ${title}. ` +
        'You scored ' + score + ' point' + (score != 1 ? 's' : '') + '.\n'
      )
    }

    this.prompt = async () => {
      if (skipLines.length) {
        let line = ''
        let matches = null
        let timerName = null

        try {
          line = skipLines.shift()
          matches = line.match(/^wait ([a-z0-9_\.]+)$/)

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

    const take = async (noun, obj, quietly) => {
      if (typeof (quietly) === 'undefined') {
        quietly = false
      }

      if (typeof (noun) === 'undefined') {
        throw new Error('Undefined noun')
      }

      const name = obj.name || noun
      let pronoun = 'the'

      if (obj.multiple) {
        if (typeof (inventory[noun]) === 'undefined') {
          inventory[noun] = []

          if (name.match('^[aeiou]')) {
            pronoun = 'an'
          } else {
            pronoun = 'a'
          }
        } else {
          pronoun = 'another'
        }

        inventory[noun].push(obj)
      } else if (inventory[noun]) {
        this.say(`You already have the ${name}.`)
        return false
      } else {
        inventory[noun] = obj
      }

      this.plus(obj.points)

      if (!quietly) {
        this.say(`You take ${pronoun} ${name}.`)
      }

      return true
    }

    this.take = async (noun, obj) => await take(noun, obj, false)
    this.takeSilently = async (noun, obj) => await take(noun, obj, true)

    const discard = async (noun, obj, quietly) => {
      if (typeof (quietly) === 'undefined') {
        quietly = false
      }

      if (typeof (noun) === 'undefined') {
        throw new Error('Undefined noun')
      }

      if (typeof (obj) === 'undefined') {
        if (Array.isArray(inventory[noun]) && inventory[noun].length) {
          obj = inventory[noun][0]
        } else {
          obj = inventory[noun]

          if (typeof (obj) === 'undefined') {
            throw new Error('Undefined object', noun)
          }
        }
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

      if (Array.isArray(inventory[noun])) {
        if (inventory[noun].length) {
          name = inventory[noun][0].name
          this.minus(obj.points)

          if (!quietly) {
            this.say(obj.dropped)
          }

          inventory[noun].pop()

          return true
        } else {
          name = obj.plural_name || obj.name
          this.say(`You don't have any more ${name}.`)
          return false
        }
      }

      delete inventory[noun]
      this.minus(obj.points)

      if (!quietly) {
        this.say(obj.dropped)
      }

      return true
    }

    this.discard = async (noun, obj) => await discard(noun, obj, false)
    this.discardSilently = async (noun, obj) => await discard(noun, obj, true)

    this.has = noun => {
      if (typeof (inventory[noun]) !== 'undefined') {
        if (Array.isArray(inventory[noun])) {
          return inventory[noun].length > 0
        }

        return true
      }

      return false
    }

    this.showInventory = () => {
      if (!Object.keys(inventory).length) {
        this.say('You don\'t have anything.')
        return
      }

      let text = 'You have:'
      let itemDescriptions = []

      Object.keys(inventory).forEach(
        (noun) => {
          const obj = inventory[noun]
          let name = null

          if (Array.isArray(obj)) {
            if (obj.length > 1) {
              name = obj[0].plural_name || obj[0].name
              itemDescriptions.push(`${obj.length} ${name}`)
            } else if (obj.length === 1) {
              name = obj[0].name

              if (name.match('^[aeiou]')) {
                itemDescriptions.push(`an ${name}`)
              } else {
                itemDescriptions.push(`a ${name}`)
              }
            } else {
              return
            }
          } else {
            let plural = obj.plural === true
            let name = obj.name || noun

            if (plural) {
              itemDescriptions.push(`some ${name}`)
            } else if (name.match('^[aeiou]')) {
              itemDescriptions.push(`an ${name}`)
            } else {
              itemDescriptions.push(`a ${name}`)
            }
          }
        }
      )

      itemDescriptions.forEach(
        (t) => {
          text += `\n    - ${t}`
        }
      )

      this.say(text)
    }

    this.withInventory = (func) => Object.keys(inventory).forEach(
      (key) => {
        const obj = inventory[key]

        if (Array.isArray(obj)) {
          if (obj.length) {
            func(obj[0], key)
          }
        } else {
          func(obj, key)
        }
      }
    )

    this.getScore = () => {
      return score
    }

    this.timer = (seconds, name) => new Promise(
      (resolve) => {
        if (typeof (name) === 'undefined') {
          name = 'timer_' + new Date().getTime()
        }

        const go = () => {
          delete timers[name]
          delete timerFuncs[name]

          resolve()
        }

        timers[name] = setTimeout(go, seconds * 1000)
        timerFuncs[name] = go
      }
    )

    this.clearTimer = (name) => {
      const timer = timers[name]
      const timerFunc = timerFuncs[name]

      if (typeof (timer) !== 'undefined') {
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

        if (!this.ended) {
          await this.emit('ready')
        }
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
