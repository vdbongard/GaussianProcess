function randnArray(size){
  var zs = new Array(size);
  for (var i = 0; i < size; i++) {
    zs[i] = d3.randomNormal()();
  }
  return zs;
}

function squaredExponentialKernel (x, y) {
  var l = 1
  return Math.exp(-0.5 * (Math.pow(x - y, 2) / Math.pow(l, 2)))
}

var length = 21
var samplePoints = d3.range(length).map(function (d) { return d / (length - 1) })

var covarianceMatrix = []

for (var i = 0; i < length; i++) {
  for (var j = 0; j < length; j++) {
    if (covarianceMatrix[i] === undefined) covarianceMatrix[i] = []
    covarianceMatrix[i][j] = squaredExponentialKernel(i, j)
  }
}

var svd = numeric.svd(covarianceMatrix)

var proj = numeric.dot(svd.U, numeric.diag(numeric.sqrt(svd.S)))
var z = randnArray(length);

var datay = numeric.dot(proj, z);


// 2. Use the margin convention practice
var margin = {top: 50, right: 50, bottom: 50, left: 50}
  , width = window.innerWidth - margin.left - margin.right // Use the window's width
  , height = window.innerHeight - margin.top - margin.bottom // Use the window's height

// The number of datapoints
var n = 21

// 5. X scale will use the index of our data
var xScale = d3.scaleLinear()
  .domain([0, n - 1]) // input
  .range([0, width]) // output

// 6. Y scale will use the randomly generate number
var yScale = d3.scaleLinear()
  .domain([-2, 2]) // input
  .range([height, 0]) // output

// 7. d3's line generator
var line = d3.line()
  .x(function (d, i) { return xScale(i) }) // set the x values for the line generator
  .y(function (d) { return yScale(d.y) }) // set the y values for the line generator

// 8. An array of objects of length N. Each object has key -> value pair, the key being "y" and the value is a random number
// var dataset = d3.range(n).map(function(d, i) { return {"y": (i / (n-1))+0.1 } })
var dataset = d3.range(n).map(function (d, i) { return {'y': datay[i]} })

// 1. Add the SVG to the page and employ #2
var svg = d3.select('body').append('svg')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

// 3. Call the x axis in a group tag
svg.append('g')
  .attr('class', 'x axis')
  .attr('transform', 'translate(0,' + height + ')')
  .call(d3.axisBottom(xScale)) // Create an axis component with d3.axisBottom

// 4. Call the y axis in a group tag
svg.append('g')
  .attr('class', 'y axis')
  .call(d3.axisLeft(yScale)) // Create an axis component with d3.axisLeft

// 9. Append the path, bind the data, and call the line generator
svg.append('path')
  .datum(dataset) // 10. Binds data to the line
  .attr('class', 'line') // Assign a class for styling
  .attr('d', line) // 11. Calls the line generator

// 12. Appends a circle for each datapoint
svg.selectAll('.dot')
  .data(dataset)
  .enter().append('circle') // Uses the enter().append() method
  .attr('class', 'dot') // Assign a class for styling
  .attr('cx', function (d, i) { return xScale(i) })
  .attr('cy', function (d) { return yScale(d.y) })
  .attr('r', 5)