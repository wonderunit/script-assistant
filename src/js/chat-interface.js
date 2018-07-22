let agent

const init = (agentParam) => {
  agent = agentParam

  document.querySelector('#chat-input input').addEventListener('keydown', (e) => {
    if (e.keyCode == 13) {
      let inputControl = document.querySelector('#chat-input input')
      if (inputControl.value) {
        userInput(inputControl.value)
        agent.input(inputControl.value)
        inputControl.value = ''
        scrollToBottom()
      }
    }
  })
}

const scrollToBottom = () => {
  let chatWindow = document.querySelector('#chat')
  chatWindow.scrollTop = chatWindow.scrollHeight
}

const userInput = (string) => {
  let content = document.createElement("div")
  content.classList = ['blurb user']
  content.innerHTML = string
  document.querySelector('#chat').appendChild(content)
  scrollToBottom()
}

const agentOutput = (string, id) => {
  agent.clear()
  if (id) {
    let item = document.querySelector('#' + id) 
    if (item) {
      item.innerHTML = string
    } else {
      let content = document.createElement("div")
      content.id = id
      content.className = "blurb"
      content.innerHTML = string
      document.querySelector('#chat').appendChild(content)
    }
  } else {
    let content = document.createElement("div")
    content.className = "blurb"
    content.innerHTML = string
    document.querySelector('#chat').appendChild(content)
  }

  scrollToBottom()
}

const resize = () => {
  scrollToBottom()
}

module.exports = {
  init,
  agentOutput,
  resize
}