class CLI {
  start(game) {
    process.on(
      'SIGINT',
      () => {
        this.exiting = true

        try {
          game.exit()
        } catch (err) {
          console.warn(err)
        }

        process.exit()
      }
    )

    this.game = game
    this.exiting = false
    this.prompter = null

    this.show = async (passage) => await this.say(passage.message)
    this.say = async (message) => {
      console.log('')
      if (typeof (message) == 'function') {
        console.log(
          '\x1b[33m%s\x1b[0m',
          message(this.game)
        )
      } else {
        console.log(
          '\x1b[33m%s\x1b[0m',
          message
        )
      }
    }

    this.close = async () => {
      if (!this.exiting) {
        await process.exit()
      }
    }

    this.prompt = (defaultValue, autoPlay) => new Promise(
      (resolve, reject) => {
        if (this.prompter !== null) {
          this.prompter.close()

          reject(
            new Error(
              'Prompt already displayed. This shouldn\'t happen.'
            )
          )
        }

        const readline = require('readline')
        const ask = () => {
          this.prompter = readline.createInterface(
            {
              input: process.stdin,
              output: process.stdout
            }
          )

          this.prompter.on('close',
            () => {
              this.prompter = null

              if (defaultValue && autoPlay) {
                resolve(defaultValue)
              }
            }
          )

          let q = '> '

          if (defaultValue) {
            q += `(${defaultValue})`
          }

          this.prompter.question(
            q,
            (action) => {
              this.prompter.close()

              if (action) {
                resolve(action)
              } else if (defaultValue) {
                resolve(defaultValue)
              } else {
                ask()
              }
            }
          )

          if (defaultValue && autoPlay) {
            this.prompter.close()
          }
        }

        ask()
      }
    )

    this.clear = () => {
      console.log('\x1b[33m%s\x1b[0m', '\n\n---------\n\n')
    }
  }
}

module.exports = CLI
