const EventEmitter = require('eventemitter3')
const CLI = require('../ui/cli')

class GameObject extends EventEmitter {
  constructor({name, alternates, description, verbs, take, plural, points, callbacks}) {
    let flags = {}
    super()

    this.name = name
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

    this.alternates = alternates
    this.description = description
    this.plural = plural === true
    this.points = isNaN(points) ? 0 : points
    this.verbs = {
      '^(?:look|examine)': (game, passage) => {
        this.describe(game, passage)
        this.emit('examined', game, passage, this)
      }
    }

    if (take === true || typeof (take) === 'undefined') {
      this.verbs[GameObject.TAKE] = async (
        game,
        passage,
        obj,
        noun
      ) => await this.take(
        game,
        passage,
        noun
      )

      this.verbs[GameObject.DISCARD] = async (
        game,
        passage,
        obj,
        noun
      ) => await this.discard(
        game,
        passage,
        noun
      )
    }

    if (typeof (verbs) !== 'undefined') {
      if (typeof (verbs) === 'object' && !Array.isArray(verbs)) {
        Object.keys(verbs).forEach(
          (key) => {
            const verb = verbs[key]

            if (verb === false) {
              if (this.verbs[key]) {
                delete this.verbs[key]
              }
            } else {
              this.verbs[key] = verb
            }
          }
        )
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

    this.describe = (game, passage) => {
      if (this.description) {
        if (typeof (this.description) === 'function') {
          game.say(this.description(game, passage))
        } else {
          game.say(this.description)
        }
      } else {
        game.say('It\'s just this thing, you know?')
      }
    }

    this.take = async (game, passage, noun) => {
      if (await game.take(noun, this)) {
        delete passage.objects[noun]
        await this.emit('taken', game, passage, this)
        await passage.emit(noun + '.taken', game, passage)
      }
    }

    this.discard = async (game, passage, noun) => {
      if (await game.discard(noun, this)) {
        passage.objects[noun] = this
        await this.emit('discarded', game, passage, this)
        await passage.emit(noun + '.discarded', game, passage)
      }
    }

    this.do = async (game, passage, verb, noun) => {
      let matchedVerb = null
      let result = null

      const matchVerb = () => {
        let returned = null

        Object.keys(this.verbs).map(
          (key) => {
            return {
              regex: new RegExp(key),
              func: this.verbs[key]
            }
          }
        ).forEach(
          (v) => {
            if (verb.match(v.regex)) {
              returned = v
              return false
            }
          }
        )

        return returned
      }

      matchedVerb = matchVerb()
      if (matchedVerb) {
        return await matchedVerb.func(game, passage, this, noun)
      }
    }
  }
}

GameObject.TAKE = '^(?:take|pick.+up|get|pocket|collect)'
GameObject.DISCARD = '^(?:discard|put.+down|drop|leave)'
GameObject.extend = (opts) => {
  return new GameObject(opts)
}

module.exports = GameObject
