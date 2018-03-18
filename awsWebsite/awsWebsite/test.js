var fs = require('fs');
var url = require('url');
var mqtt = require('mqtt');
var http = require('http');
var https = require('https');
var flash = require('connect-flash');
var morgan = require('morgan');
var express = require('express');
var session = require('express-session');
var passport = require('passport');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var Measurement = require('./lib/googleMeasurement.js');
var cookieParser = require('cookie-parser');
var BasicStrategy = require('passport-http').BasicStrategy;
var LocalStrategy = require('passport-local').Strategy;
var PassportOAuthBearer = require('passport-http-bearer');
var json2html = require('node-json2html');

var oauthServer = require('./lib/oauth.js');

var port = (process.env.VCAP_APP_PORT || process.env.PORT || 3000);
var host = (process.env.VCAP_APP_HOST || '0.0.0.0');
var mongo_url = (process.env.MONGO_URL || 'mongodb://localhost/users');

var mqtt_url = (process.env.MQTT_URL || 'mqtt://localhost:1883');
var mqtt_user = (process.env.MQTT_USER || 'mqtt_user');
var mqtt_password = (process.env.MQTT_PASSWORD || 'mqtt_pass');
console.log(mqtt_url);

var googleAnalyicsTID = process.env.GOOGLE_ANALYTICS_TID;
var measurement = new Measurement(googleAnalyicsTID);

var brokerMonitor = require('./lib/broker-monitor.js');

var mqttClient;

var mqttOptions = {
  reconnectPeriod: 3000,
  keepAlive: 10,
  clean: true,
  clientId: 'webApp_' + Math.random().toString(16).substr(2, 8)
};

if (mqtt_user) {
  mqttOptions.username = mqtt_user;
  mqttOptions.password = mqtt_password;
}

mqttClient = mqtt.connect(mqtt_url, mqttOptions);

mqttClient.on('error', function(err) {});

mqttClient.on('reconnect', function() {

});

mqttClient.on('connect', function() {
  mqttClient.subscribe('response/#');
});

console.log("Running");
