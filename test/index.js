module.exports = process.env.MONGLODB_COV
  ? require('../dist-cov/monglo')
  : require('../dist/monglo');