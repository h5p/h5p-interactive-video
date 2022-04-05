const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require('terser-webpack-plugin');

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = (nodeEnv === 'production');

module.exports = {
  mode: nodeEnv,
  optimization: {
    minimize: isProd,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress:{
            drop_console: true,
          }
        }
      }),
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'h5p-interactive-video.css'
    })
  ],
  entry: {
    dist: './src/entries/dist.js'
  },
  output: {
    filename: 'h5p-interactive-video.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      },
      {
        test: /\.(s[ac]ss|css)$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: ''
            }
          },
          { loader: "css-loader" },
          {
            loader: "sass-loader"
          }
        ]
      },
      {
        test: /\.eot|\.woff2|\.woff|\.ttf$/,
        include: path.join(__dirname, 'src/fonts'),
        type: 'asset/resource'
      },
      {
        test: /\.(svg)$/,
        include: path.join(__dirname, 'src/gui'),
        type: 'asset/resource'
      }
    ]
  },
  stats: {
    colors: true,
    children: true,
    errorDetails: true
  },
  externals: {
    jquery: 'H5P.jQuery'
  },
  devtool: (isProd) ? undefined : 'eval-cheap-module-source-map'
};

