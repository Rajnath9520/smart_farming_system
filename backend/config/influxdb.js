
require('dotenv').config();
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const logger = require('../utils/logger');

const INFLUX_URL    = process.env.INFLUX_URL    || 'http://localhost:8086';
const INFLUX_TOKEN  = process.env.INFLUX_TOKEN  || 'my-super-secret-token';
const INFLUX_ORG    = process.env.INFLUX_ORG    || 'agrosense';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'sensor_data';

const client = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });


const writeApi = client.getWriteApi(INFLUX_ORG, INFLUX_BUCKET, 'ms', {
  batchSize:     100,
  flushInterval: 1000,   
  maxRetries:    3,
  maxRetryDelay: 15000,
  minRetryDelay: 1000,
  retryJitter:   1000,
});

writeApi.useDefaultTags({ app: 'agrosense' });

const queryApi = client.getQueryApi(INFLUX_ORG);

async function closeInflux() {
  try {
    await writeApi.close();
    logger.info('InfluxDB write buffer flushed and closed');
  } catch (err) {
    logger.error(`InfluxDB close error: ${err.message}`);
  }
}

process.on('SIGTERM', closeInflux);
process.on('SIGINT',  closeInflux);

logger.info(`InfluxDB → ${INFLUX_URL}  org=${INFLUX_ORG}  bucket=${INFLUX_BUCKET}`);

module.exports = { client, writeApi, queryApi, Point, INFLUX_ORG, INFLUX_BUCKET };