const EventEmitter = require('eventemitter3')
const parsers = [
  require('../parsers/movement'),
  require('../parsers/action'),
  require('../parsers/object'),
  require('../parsers/inventory'),
  require('../parsers/quit')
]

const callable = require('../utils/callable')

class Passage extends EventEmitter {
  constructor({message, actions, objects, set, exits, callbacks}) {
    let flags = {}

    super()
    this.message = message
    this.get = key => flags[key]
    this.set = async (key, value) => {
      if (value !== flags[key]) {
        flags[key] = value

        try {
          await this.emit(`set.${key}`, value, this)
        } catch (err) {
          console.error(err)
        }
      }
    }

    this.actions = {
      '(?:look(?: around)?|examine)$': game => this.describe(game)
    }

    if (typeof (actions) !== 'undefined') {
      if (typeof (actions) === 'object' && !Array.isArray(actions)) {
        Object.keys(actions).forEach(
          (key) => {
            const action = actions[key]

            if (action === false) {
              if (this.actions[key]) {
                delete this.actions[key]
              }
            } else {
              this.actions[key] = action
            }
          }
        )
      }
    }

    this.objects = {}

    if (typeof (objects) !== 'undefined') {
      if (typeof (objects) === 'object' && !Array.isArray(objects)) {
        this.objects = objects
      }
    }

    this.exits = {}

    if (typeof (exits) !== 'undefined') {
      if (typeof (exits) === 'object' && !Array.isArray(exits)) {
        this.exits = exits
      }
    }

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

    this.describe = game => game.say(this.message)
    this.do = async (game, action) => {
      let result = null

      parsers.forEach(
        (parser, i) => {
          if (!callable(result)) {
            result = parser(action, this, game)
          }
        }
      )

      if (callable(result)) {
        return await result()
      } else {
        return null
      }
    }

    this.wait = game => game.prompt().then(
      action => this.do(game, action)
    ).catch(
      console.error
    )

    this.exit = (direction, game) => new Promise(
      (resolve, reject) => {
        if (this.exits[direction]) {
          let movement = null
          let result = null

          try {
            movement = this.exits[direction]
            result = movement(game, this)
          } catch (err) {
            console.error(err)
            reject(err)
            return
          }

          return resolve(result)
        }
      }
    )

    if (typeof (set) !== 'undefined') {
      if (typeof (set) === 'object' && !Array.isArray(set)) {
        this.on('entered',
          async (game) => {
            await Object.keys(set).forEach(
              async (key) => {
                await game.set(key, set[key])
              }
            )
          }
        )
      }
    }
  }
}

Passage.extend = (opts) => {
  return new Passage(opts)
}

module.exports = Passage
