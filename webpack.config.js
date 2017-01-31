module.exports = {
  entry: "./js/index.js",
  module: {
    loaders: [
      { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" }
    ]
  },
  output: {
    filename: "index_bundle.js",
    path: "./js/"
  }
};
