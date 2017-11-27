class GaussianProcess {
  constructor () {
    this.steps = 200
    this.xLeft = -5
    this.xRight = 5
    this.yTop = 3
    this.yBottom = -3
    this.noise = 0.02
    this.covarianceMatrix = []
    this.graph = new Graph(this.xLeft, this.xRight, this.yTop, this.yBottom, this.steps)
    this.testingPointsX = numeric.linspace(this.xLeft, this.xRight, this.steps)
    this.trainingPointsX = []
    this.trainingPointsY = []
    this.mu = []
    this.sd95 = []
    this.proj = []

    this.init()
  }

  init () {
    this.initCovarianceMatrix()
    this.initMeanAndInterval()
    this.graph.drawMeanAndInterval(this.mu, this.sd95)
    this.sample()

    d3.select('body').append('button').text('Sample').on('click', this.sample.bind(this))
    d3.select('body').append('button').text('Reset Samples').on('click', this.graph.resetSamples.bind(this.graph))

    document.querySelector('svg').addEventListener('click', this.addTrainingPoint.bind(this))
  }

  initCovarianceMatrix () {
    const distanceMatrix = GaussianProcess.computeDistanceMatrix(this.testingPointsX, this.testingPointsX)
    this.covarianceMatrix = GaussianProcess.squaredExponentialKernel(distanceMatrix)
  }

  sample () {
    const z = GaussianProcess.randomNormalArray(this.steps)
    const dataY = numeric.add(numeric.dot(this.proj, z), this.mu)
    this.graph.drawSample(dataY)
  }

  addTrainingPoint (event) {
    const graphPoint = this.graph.toLocal(event.offsetX, event.offsetY)

    if (graphPoint) {
      this.trainingPointsX.push(graphPoint.x)
      this.trainingPointsY.push(graphPoint.y)

      this.computeMeanAndInterval()

      this.graph.drawPoint(graphPoint.x, graphPoint.y)
      this.graph.drawMeanAndInterval(this.mu, this.sd95)
    }
  }

  initMeanAndInterval () {
    const svdCov = numeric.svd(this.covarianceMatrix)
    this.mu = numeric.rep([this.steps], 0)
    this.sd95 = numeric.mul(1.98, numeric.sqrt(numeric.getDiag(this.covarianceMatrix)))
    this.proj = numeric.dot(svdCov.U, numeric.diag(numeric.sqrt(svdCov.S)))
  }

  computeMeanAndInterval () {
    const kx = GaussianProcess.squaredExponentialKernel(
      GaussianProcess.computeDistanceMatrix(this.trainingPointsX, numeric.linspace(this.xLeft, this.xRight, this.steps))
    )
    const kxTranspose = numeric.transpose(kx)
    const covTr = GaussianProcess.squaredExponentialKernel(
      GaussianProcess.computeDistanceMatrix(this.trainingPointsX, this.trainingPointsX)
    )
    const k = numeric.add(covTr, numeric.diag(numeric.rep([covTr.length], this.noise)))
    const kInverse = numeric.inv(k)
    const kxTranspose_x_kInverse = numeric.dot(kxTranspose, kInverse)
    const posteriorCov = numeric.sub(this.covarianceMatrix, numeric.dot(kxTranspose_x_kInverse, kx))
    const svdTmp = numeric.svd(posteriorCov)

    this.mu = numeric.dot(kxTranspose_x_kInverse, this.trainingPointsY)
    this.sd95 = numeric.mul(1.98, numeric.sqrt(numeric.getDiag(posteriorCov)))
    this.proj = numeric.dot(svdTmp.U, numeric.diag(numeric.sqrt(svdTmp.S)))
  }

  static computeDistanceMatrix (xData1, xData2) {
    const distanceMatrix = GaussianProcess.initTwoDimensionalArray(xData1.length, xData2.length)

    for (let i = 0; i < xData1.length; i++) {
      for (let j = 0; j < xData2.length; j++) {
        distanceMatrix[i][j] = Math.abs(xData2[j] - xData1[i])
      }
    }

    return distanceMatrix
  }

  static initTwoDimensionalArray (dim1, dim2) {
    const array = new Array(dim1)
    for (let i = 0; i < dim1; i++) {
      array[i] = new Array(dim2)
    }
    return array
  }

  static randomNormalArray (size) {
    const zs = new Array(size)
    for (let i = 0; i < size; i++) {
      zs[i] = d3.randomNormal()()
    }
    return zs
  }

  static squaredExponentialKernel (distanceMatrix) {
    const l = 1
    const sigma = 1
    return numeric.mul(numeric.exp(numeric.mul(-0.5 / (Math.pow(l, 2)), numeric.pow(distanceMatrix, 2))),
      Math.pow(sigma, 2))
  }
}

class Graph {
  constructor (xLeft, xRight, yTop, yBottom, steps) {
    this.marginAll = 50
    this.margin = {top: this.marginAll, right: this.marginAll, bottom: this.marginAll, left: this.marginAll}
    this.width = window.innerWidth - this.margin.left - this.margin.right
    this.height = window.innerHeight * 0.75 - this.margin.top - this.margin.bottom
    this.xLeft = xLeft
    this.xRight = xRight
    this.yTop = yTop
    this.yBottom = yBottom
    this.linSpace = numeric.linspace(this.xLeft, this.xRight, steps)
    this.xScale = d3.scaleLinear().domain([this.xLeft, this.xRight]).range([0, this.width])
    this.yScale = d3.scaleLinear().domain([this.yBottom, this.yTop]).range([this.height, 0])
    this.svg = d3.select('body').append('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom)
      .append('g')
      .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
    this.meanAndIntervalGroup = this.svg.append('g')
    this.sd95 = this.meanAndIntervalGroup.append('path').attr('class', 'sd95-area')
    this.mean = this.meanAndIntervalGroup.append('path').attr('class', 'mean-line')
    this.showDots = false
    this.sampleGroup = this.svg.append('g')
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

  drawMeanAndInterval (mu, sd95) {
    const line = d3.line()
      .x((d, i) => this.xScale(this.linSpace[i]))
      .y(d => this.yScale(d))

    const area = d3.area()
      .x((d, i) => this.xScale(this.linSpace[i]))
      .y0(d => this.yScale(d.mu - d.sd95))
      .y1(d => this.yScale(d.mu + d.sd95))

    const dataSet = d3.range(mu.length).map((i) => { return {mu: mu[i], sd95: sd95[i]} })

    this.mean.attr('d', line(mu))
    this.sd95.attr('d', area(dataSet))

    this.resetSamples()
  }

  drawSample (data) {
    const randomColor = 'hsl(' + Math.random() * 360 + ',100%,50%)'

    const line = d3.line()
      .x((d, i) => this.xScale(this.linSpace[i]))
      .y(d => this.yScale(d))

    const currentGroup = this.sampleGroup.append('g')

    this.lines.push(
      currentGroup.append('path')
        .attr('class', 'sample-line')
        .attr('stroke', randomColor)
        .attr('d', line(data))
    )

    if (this.showDots) {
      this.lineDots.push(
        currentGroup.append('g').selectAll('.dot')
          .data(data)
          .enter().append('circle')
          .attr('class', 'dot')
          .attr('cx', (d, i) => this.xScale(this.linSpace[i]))
          .attr('cy', d => this.yScale(d))
          .attr('r', 2)
          .attr('fill', randomColor)
      )
    }
  }

  resetSamples () {
    this.lines.forEach(line => line.remove())
    this.lineDots.forEach(dots => dots.remove())
  }

  toLocal (x, y) {
    // check bounds
    if (x < this.margin.left
      || x > this.margin.left + this.width
      || y < this.margin.top
      || y > this.margin.top + this.height) return

    const xRange = Math.abs(this.xRight - this.xLeft)
    const yRange = Math.abs(this.yBottom - this.yTop)

    const newX = (x - this.margin.left) / this.width * xRange + this.xLeft
    const newY = -((y - this.margin.top) / this.height * yRange + this.yBottom)

    return {x: newX, y: newY}
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