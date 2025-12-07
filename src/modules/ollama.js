const OLLAMA_API_URL = 'http://localhost:11434/api/generate'
const DEFAULT_OLLAMA_MODEL = 'llama3.2:latest'

export default class OllamaClient {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || OLLAMA_API_URL
    this.defaultModel = options.defaultModel || DEFAULT_OLLAMA_MODEL
  }

  async generate(prompt, options = {}) {
    const model = options.model || this.defaultModel
    const temperature = options.temperature || 0.7
    const stream = options.stream || false

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt,
        temperature,
        stream
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    if (stream) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let result = ''

      while (true) {
        const {done, value} = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          const data = JSON.parse(line)
          if (data.response) {
            result += data.response
            if (options.onChunk) options.onChunk(data.response)
          }
          if (data.done) break
        }
      }

      return result
    } else {
      const data = await response.json()
      return data.response
    }
  }

  async generateWithContext(prompt, context, options = {}) {
    const contextPrompt = context.join('\n') + '\n' + prompt
    return this.generate(contextPrompt, options)
  }
}
