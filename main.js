function randnArray (size) {
  const zs = new Array(size)
  for (let i = 0; i < size; i++) {
    zs[i] = d3.randomNormal()()
  }
  return zs
}

function squaredExponentialKernel (x, y) {
  const l = 4
  const sigma = 1
  return Math.pow(sigma, 2) * Math.exp(-0.5 * (Math.pow(x - y, 2) / Math.pow(l, 2)))
}

const length = 41

const covarianceMatrix = []

for (let i = 0; i < length; i++) {
  for (let j = 0; j < length; j++) {
    if (covarianceMatrix[i] === undefined) covarianceMatrix[i] = []
    covarianceMatrix[i][j] = squaredExponentialKernel(i, j)
  }
}

console.log('Covariance Matrix: ', covarianceMatrix)

const svd = numeric.svd(covarianceMatrix)

console.log('Singular value decomposition: ', svd)

const squareRootCovarianceMatrix = numeric.dot(svd.U, numeric.diag(numeric.sqrt(svd.S)))

console.log('Square root of the covariance matrix: ', squareRootCovarianceMatrix)

const z = randnArray(length)

console.log('z is an array of normally distributed values: ', z)

const dataY = numeric.dot(squareRootCovarianceMatrix, z)

console.log('Data points y: ', dataY)

class Graph {
  constructor (xLeft, xRight, yTop, yBottom) {
    this.marginAll = 50
    this.margin = {top: this.marginAll, right: this.marginAll, bottom: this.marginAll, left: this.marginAll}
    this.width = window.innerWidth - this.margin.left - this.margin.right
    this.height = window.innerHeight - this.margin.top - this.margin.bottom
    this.xLeft = xLeft
    this.xRight = xRight
    this.xRange = Math.abs(this.xLeft) + Math.abs(this.xRight)
    this.yTop = yTop
    this.yBottom = yBottom
    this.yRange = Math.abs(this.yTop) + Math.abs(this.yBottom)
    this.xScale = d3.scaleLinear().domain([this.xLeft, this.xRight]).range([0, this.width])
    this.yScale = d3.scaleLinear().domain([this.yBottom, this.yTop]).range([this.height, 0])
    this.svg = d3.select('body').append('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom)
      .append('g')
      .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')

    this.init()
  }

  init () {
    this.svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + this.height + ')')
      .call(d3.axisBottom(this.xScale))

    this.svg.append('g')
      .attr('class', 'y axis')
      .call(d3.axisLeft(this.yScale))
  }

  drawLine (data, xLeft, xRight) {
    const n = data.length
    const range = Math.abs(xLeft) + Math.abs(xRight)
    const dataSet = d3.range(n).map(function (i) { return {'y': data[i]} })

    const line = d3.line()
      .x((d, i) => { return this.xScale(i / (n - 1) * range + xLeft) })
      .y((d) => { return this.yScale(d.y) })

    this.svg.append('path')
      .datum(dataSet)
      .attr('class', 'line')
      .attr('d', line)
  }

  drawMousePoint (x, y) {
    // check bounds
    if (x < this.margin.left
      || x > this.margin.left + this.width
      || y < this.margin.top
      || y > this.margin.top + this.height) return

    const newX = (x - this.margin.left) / this.width * this.xRange + this.xLeft
    const newY = -((y - this.margin.top) / this.height * this.yRange + this.yBottom)

    this.drawPoint(newX, newY)
  }

  drawPoint (x, y) {
    this.svg.selectAll()
      .data([{x, y}])
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', (d) => { return this.xScale(d.x) })
      .attr('cy', (d) => { return this.yScale(d.y) })
      .attr('r', 4)
  }
}

const xLeft = -5
const xRight = 5

const graph = new Graph(xLeft, xRight, 3, -3)

graph.drawLine(dataY, xLeft, xRight)

graph.drawPoint(2, 2.5)
graph.drawPoint(0, 1.111)
graph.drawPoint(-2, -1.4234)

document.querySelector('svg').addEventListener('click', (event) => graph.drawMousePoint(event.offsetX, event.offsetY))