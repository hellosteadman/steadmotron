class Browser {
  start(game) {
    this.game = game
    this.exiting = false
    this.prompter = null

    const write = (message) => {
      const dom = document.querySelector('body')
      const span = document.createElement('span')

      span.innerText = message
      span.innerHTML += '<br>'

      dom.appendChild(span)
      window.scrollTo(0, document.body.scrollHeight + 100)
    }

    this.show = async (passage) => await this.say(passage.message)
    this.say = async (message) => {
      write('')
      if (typeof (message) == 'function') {
        write(
          message(this.game)
        )
      } else {
        write(message)
      }
    }

    this.close = async () => {
      if (!this.exiting) {
        if (this.prompter) {
          this.prompter.close();
        }
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

        const readline = require('./promptline')
        const ask = () => {
          this.prompter = readline.createInterface(
            document.querySelector('body')
          )

          this.prompter.on('close',
            () => {
              this.prompter = null

              if (defaultValue && autoPlay) {
                setTimeout(
                  () => {
                    resolve(defaultValue)
                  },
                  300
                )
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
      const dom = document.querySelector('body')
      const span = document.createElement('span')

      span.innerHTML = '<br><br><br>'
      span.innerHTML += '---------'
      span.innerHTML += '<br><br><br>'
      dom.appendChild(span)

      window.scrollTo(0, document.body.scrollHeight + 100)
    }
  }
}

module.exports = Browser
