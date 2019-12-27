const EventEmitter = require('eventemitter3')

class Interface extends EventEmitter {
  constructor(dom) {
    super()
    this.question = (question, callback) => {
      const prompt = document.createElement('span')
      const input = document.createElement('input')

      prompt.innerText = question
      dom.appendChild(prompt)

      input.addEventListener('input',
        (e) => {
          const value = input.value || ''

          if (value.length >= 50) {
            input.value = input.value.substr(0, 50)
          }

          const length = value.length || 1
          input.style.width = Math.max(length * 18, 24) + 'px'
        }
      )

      input.addEventListener('keypress',
        (e) => {
          if (e.keyCode == 13) {
            callback(input.value)
          }
        }
      )

      this.on('close',
        () => {
          const span = document.createElement('span')
          const value = input.value

          span.innerText = value
          span.innerHTML += '<br>'
          input.replaceWith(span)
          window.scrollTo(0, document.body.scrollHeight + 100)
        }
      )

      input.type = 'text'
      dom.appendChild(input)
      window.scrollTo(0, document.body.scrollHeight + 100)

      input.select()
      input.focus()
    }

    this.close = () => {
      this.emit('close')
    }
  }
}

module.exports = {
  createInterface: (parent) => new Interface(parent)
}
