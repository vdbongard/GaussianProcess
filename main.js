class GaussianProcess {
  constructor () {
    this.steps = 200
    this.xLeft = -5
    this.xRight = 5
    this.yTop = 3
    this.yBottom = -3
    this.covarianceMatrix = new Array(this.steps)
    this.graph = new Graph(this.xLeft, this.xRight, this.yTop, this.yBottom)
    this.testingPointsX = numeric.linspace(this.xLeft, this.xRight, this.steps)

    this.init()
  }

  init () {
    this.initCovarianceMatrix()
    this.initMeanAndInterval()
    this.sampleFromPrior()

    d3.select('body').append('button').text('Sample').on('click', () => this.sampleFromPrior())

    document.querySelector('svg').addEventListener('click', (event) => this.graph.drawMousePoint(event.offsetX, event.offsetY))
  }

  initCovarianceMatrix () {
    for (let i = 0; i < this.steps; i++) {
      this.covarianceMatrix[i] = new Array(this.steps) // initialize the two dimensional array
    }

    for (let i = 0; i < this.steps; i++) {
      for (let j = i; j < this.steps; j++) {
        const covariance = GaussianProcess.squaredExponentialKernel(this.testingPointsX[i], this.testingPointsX[j])
        this.covarianceMatrix[i][j] = covariance
        if (i !== j) {
          this.covarianceMatrix[j][i] = covariance // symmetric matrix so we only need to calculate one triangle of the matrix
        }
      }
    }

    console.log('Covariance Matrix: ', this.covarianceMatrix)
  }

  initMeanAndInterval () {
    const mu = numeric.rep([this.steps], 0)
    const sd95 = numeric.mul(1.98, numeric.sqrt(numeric.getDiag(this.covarianceMatrix)));
    this.graph.drawLine(mu)
    this.graph.drawLine(sd95)
    this.graph.drawLine(numeric.neg(sd95))
  }

  sampleFromPrior () {
    const svd = numeric.svd(this.covarianceMatrix)
    const squareRootCovarianceMatrix = numeric.dot(svd.U, numeric.diag(numeric.sqrt(svd.S)))
    const z = GaussianProcess.randomNormalArray(this.steps)
    const dataY = numeric.dot(squareRootCovarianceMatrix, z)

    this.graph.drawLine(dataY, false, false, true)

    console.log('Singular value decomposition: ', svd)
    console.log('Square root of the covariance matrix: ', squareRootCovarianceMatrix)
    console.log('z is an array of normally distributed values: ', z)
    console.log('Data points y: ', dataY)
  }

  static randomNormalArray (size) {
    const zs = new Array(size)
    for (let i = 0; i < size; i++) {
      zs[i] = d3.randomNormal()()
    }
    return zs
  }

  static squaredExponentialKernel (x, y) {
    const l = 1
    const sigma = 1
    return Math.pow(sigma, 2) * Math.exp(-0.5 * (Math.pow(x - y, 2) / Math.pow(l, 2)))
  }
}

class Graph {
  constructor (xLeft, xRight, yTop, yBottom) {
    this.marginAll = 50
    this.margin = {top: this.marginAll, right: this.marginAll, bottom: this.marginAll, left: this.marginAll}
    this.width = window.innerWidth - this.margin.left - this.margin.right
    this.height = window.innerHeight / 2 - this.margin.top - this.margin.bottom
    this.xLeft = xLeft
    this.xRight = xRight
    this.yTop = yTop
    this.yBottom = yBottom
    this.xScale = d3.scaleLinear().domain([this.xLeft, this.xRight]).range([0, this.width])
    this.yScale = d3.scaleLinear().domain([this.yBottom, this.yTop]).range([this.height, 0])
    this.svg = d3.select('body').append('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom)
      .append('g')
      .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')

    this.lines = []
    this.lineDots = []

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

  drawLine (data, showDots, resetLines, randomColors) {
    const linSpace = numeric.linspace(this.xLeft, this.xRight, data.length)
    const dataSet = d3.range(data.length).map(function (i) { return {'y': data[i]} })
    const randomColor = randomColors ? 'hsl(' + Math.random() * 360 + ',100%,50%)' : '#ccc'

    if (resetLines) {
      this.lines.forEach(line => line.remove())
      this.lineDots.forEach(dots => dots.remove())
    }

    const line = d3.line()
      .x((d, i) => { return this.xScale(linSpace[i]) })
      .y((d) => { return this.yScale(d.y) })

    this.lines.push(
      this.svg.append('path')
        .datum(dataSet)
        .attr('class', 'line')
        .attr('stroke', randomColor)
        .attr('d', line)
    )

    if (showDots) {
      this.lineDots.push(
        this.svg.selectAll('.dot')
          .data(dataSet)
          .enter().append('circle')
          .attr('class', 'dot')
          .attr('cx', (d, i) => { return this.xScale(linSpace[i]) })
          .attr('cy', (d) => { return this.yScale(d.y) })
          .attr('r', 3)
          .attr('fill', randomColor)
      )
    }
  }

  drawMousePoint (x, y) {
    // check bounds
    if (x < this.margin.left
      || x > this.margin.left + this.width
      || y < this.margin.top
      || y > this.margin.top + this.height) return

    const xRange = Math.abs(this.xLeft) + Math.abs(this.xRight)
    const yRange = Math.abs(this.yTop) + Math.abs(this.yBottom)

    const newX = (x - this.margin.left) / this.width * xRange + this.xLeft
    const newY = -((y - this.margin.top) / this.height * yRange + this.yBottom)

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
      .attr('fill', '#7eff00')
  }
}

new GaussianProcess()