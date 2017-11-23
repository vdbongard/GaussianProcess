class GaussianProcess {
  constructor () {
    this.steps = 200
    this.xLeft = -5
    this.xRight = 5
    this.yTop = 3
    this.yBottom = -3
    this.covarianceMatrix = []
    this.graph = new Graph(this.xLeft, this.xRight, this.yTop, this.yBottom)
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
    this.computeProjection(0, 0, 0)
    this.drawMeanAndInterval()
    this.sample()

    d3.select('body').append('button').text('Sample').on('click', this.sample.bind(this))

    document.querySelector('svg').addEventListener('click', this.addTrainingPoint.bind(this))
  }

  initCovarianceMatrix () {
    const dm = GaussianProcess.computeDistanceMatrix(this.testingPointsX, this.testingPointsX)
    this.covarianceMatrix = GaussianProcess.squaredExponentialKernel(dm)

    console.log('Covariance Matrix: ', this.covarianceMatrix)
  }

  drawMeanAndInterval () {
    this.graph.drawLine(this.mu)
    this.graph.drawLine(numeric.add(this.mu, this.sd95))
    this.graph.drawLine(numeric.sub(this.mu, this.sd95))
  }

  sample () {
      const z = GaussianProcess.randomNormalArray(this.steps)
      const dataY = numeric.add(numeric.dot(this.proj, z), this.mu)
      this.graph.drawLine(dataY, false, false, true)
  }

  addTrainingPoint (event) {
    const graphPoint = this.graph.toLocal(event.offsetX, event.offsetY)

    if (graphPoint) {
      this.trainingPointsX.push(graphPoint.x)
      this.trainingPointsY.push(graphPoint.y)

      const dmTr = GaussianProcess.computeDistanceMatrix(this.trainingPointsX, this.trainingPointsX)
      const dmTeTr = GaussianProcess.computeDistanceMatrix(this.testingPointsX, this.trainingPointsX)

      this.computeProjection(dmTr, dmTeTr, this.trainingPointsY)
      this.graph.drawPoint(graphPoint.x, graphPoint.y)
      this.drawMeanAndInterval()
      this.sample()
    }
  }

  static computeDistanceMatrix (xData1, xData2) {
    const distanceMatrix = GaussianProcess.initTwoDimensionalArray(xData1.length, xData2.length)

    for (let i = 0; i < xData1.length; i++){
      for (let j = 0; j < xData2.length; j++){
        distanceMatrix[i][j] = Math.abs(xData2[j] - xData1[i])
      }
    }

    return distanceMatrix
  }

  computeProjection(dmTr, dmTeTr, trY) {
    const Mtr = numeric.dim(dmTr)[0]
    const Mte = this.steps

    if (Mtr > 0) {
      const Kxx = GaussianProcess.squaredExponentialKernel(dmTr)

      for (let i = 0; i < Mtr; i++){
        Kxx[i][i] += 0.2;
      }

      const KxxSvd = numeric.svd(Kxx)

      for (let i = 0; i < Mtr; i++){
        if (KxxSvd.S[i] > numeric.epsilon){
          KxxSvd.S[i] = 1.0/KxxSvd.S[i];
        } else {
          KxxSvd.S[i] = 0.0;
        }
      }

      const Kx = GaussianProcess.squaredExponentialKernel(dmTeTr)

      const tmp = numeric.dot(Kx, KxxSvd.U);

      // there seems to be a bug in numeric.svd: svd1.U and transpose(svd1.V) are not always equal for a symmetric matrix
      this.mu = numeric.dot(tmp, numeric.mul(KxxSvd.S, numeric.dot(numeric.transpose(KxxSvd.U), trY)));
      let cov = numeric.dot(tmp, numeric.diag(numeric.sqrt(KxxSvd.S)));
      cov = numeric.dot(cov, numeric.transpose(cov));
      cov = numeric.sub(this.covarianceMatrix, cov);
      const covSvd = numeric.svd(cov);
      for (let i = 0; i < Mte; i++){
        if (covSvd.S[i] < numeric.epsilon){
          covSvd.S[i] = 0.0;
        }
      }
      this.proj = numeric.dot(covSvd.U, numeric.diag(numeric.sqrt(covSvd.S)));
      this.sd95 = numeric.mul(1.98, numeric.sqrt(numeric.getDiag(numeric.dot(this.proj, numeric.transpose(this.proj)))));

    } else {
      this.mu = numeric.rep([this.steps], 0)
      this.sd95 = numeric.mul(1.98, numeric.sqrt(numeric.getDiag(this.covarianceMatrix)))
      const covSvd = numeric.svd(this.covarianceMatrix)
      this.proj = numeric.dot(covSvd.U, numeric.diag(numeric.sqrt(covSvd.S)))
    }
  }

  static initTwoDimensionalArray(dim1, dim2) {
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

    // if (resetLines) {
    //   this.lines.forEach(line => line.remove())
    //   this.lineDots.forEach(dots => dots.remove())
    // }

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

  toLocal(x, y) {
    // check bounds
    if (x < this.margin.left
      || x > this.margin.left + this.width
      || y < this.margin.top
      || y > this.margin.top + this.height) return

    const xRange = Math.abs(this.xRight - this.xLeft)
    const yRange = Math.abs(this.yBottom - this.yTop)

    const newX = (x - this.margin.left) / this.width * xRange + this.xLeft
    const newY = -((y - this.margin.top) / this.height * yRange + this.yBottom)

    return { x: newX, y: newY }
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