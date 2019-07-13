const fs = require('fs')
const path = require('path');
const child_process = require('child_process')
const yaml = require('yaml')
const opted = require('opted')
const getCombinations = require('get-combinations')
const progress = require('cli-progress')
const chalk = require('chalk')

const [configFile, ...command] = process.argv.slice(2)
const app = yaml.parse(fs.readFileSync(configFile, 'utf8'))

const parseValues = (input = {}) => {
  if (Array.isArray(input)) {
    return input.map(i => `"${i}"`)
  }
  const min = input.min || 0
  const max = input.max || 1
  const step = input.step || 0.1
  const values = []
  for (let i = min; i < max; i += step) {
    values.push(i)
  }
  return values
}

const prefix = Object.keys(app)[0]
const parameters = app[prefix]

const combs = getCombinations(Object.entries(parameters).map(([key, values]) => ({
  key, values: parseValues(values)
})))

console.error(chalk.grey('we are going to try ') + chalk.green(combs.length) + chalk.grey(' combinations'))

const bar = new progress.Bar({}, progress.Presets.rect);
 
// start the progress bar with a total value of 200 and start value of 0
// bar.start(combs.length, 0);


// detect if we need to run an external binary (slow)
// or if we can run a node module (fast)

const cmdPrefix = prefix + (command.length ? ` ${command.join(' ')}` : '')

// const [bin, fileName, ...args] = cmdPrefix.split(' ')

// user want to run a node module if executable is Node and we have a file (with no param)
const maybeModule = prefix.match(/require\(['"]([a-zA-Z0-9\-_\.\/]+)['"]\)/)
let nodeModule = maybeModule && maybeModule[1]

let moduleInstance
if (nodeModule) {
  try { 
    moduleInstance = require(path.join(process.cwd(), nodeModule))
  } catch (err) {
    console.error(chalk.red('hmm no, not a valid node module:'), err)
    nodeModule = null
  }
}

let hasHeaders = false
combs.forEach(conf => {
  const params = opted(conf)
  const cmd = cmdPrefix + (params.length ? ` ${params.join(' ')}` : '')
  try {
    let result
    if (nodeModule) {
      const cleanParams = params.map(p => {
        try {
          return JSON.parse(p)
        } catch (err) {
          return p
        }
      })

      moduleInstance.parse(cleanParams)

      console.error(`\n\n\n  ${cleanParams.join(' ')}\n`)
      const command = moduleInstance.commands.filter(c => c.isDefault)[0]
      result = command.callback.call(moduleInstance, moduleInstance)
    } else {
      console.error(chalk.grey(cmd))
      result = JSON.parse(child_process.execSync(cmd))
    }
    if (!hasHeaders) {
      hasHeaders = true
      console.log(Object.keys(conf).concat(Object.keys(result)).join(','))
    }
    console.log(Object.values(conf).concat(Object.values(result)).join(','))
  } catch (err) {
    console.error(chalk.red('failed to run command:'), err)
  }
  // bar.increment();
})

// bar.stop();
