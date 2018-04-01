var mqtt = require('mqtt');
var Measurement = require('./googleMeasurement.js');

var googleAnalyicsTID = process.env.GOOGLE_ANALYTICS_TID;
var measurement = new Measurement(googleAnalyicsTID);

var mqtt_url = (process.env.MQTT_URL || 'mqtt://localhost:1883');
var mqtt_user = (process.env.MQTT_USER || 'mqtt_user');
var mqtt_password = (process.env.MQTT_PASSWORD || 'mqtt_pass');
console.log(mqtt_url);

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
  mqttClient.subscribe('$SYS/broker/log/#');
  mqttClient.subscribe('$SYS/broker/clients/connected');
});

try {
  mqttClient.on('message', function(topic, message) {
    //console.log(topic, message.toString());
    switch (topic) {
      case "$SYS/broker/clients/connected":
        measurement.send({
          t: 'event',

          ec: 'broker',
          ea: 'Status.connected',
          ev: message.toString(),
          el: message.toString(),
          geoid: 'Amazon',
          uid: 'System'
        });
        //console.log("MESSAGE",message.toString());
        break;
      case "$SYS/broker/log/N":
      case "$SYS/broker/log/E":
        //process.stdout.write(".");
        var line = message.toString().split(":")[1];

        if (!line)
          line = data;

        if (line.startsWith(" New client connected from")) {
          //New client connected from ##.##.##.## as NNN (c1, k60, u'NNN').
          var fields = line.split(" ");

          measurement.send({
            t: 'event',
            ec: 'broker',
            ea: 'Connect',
            el: fields[7],
            sc: 'start',
            uid: fields[7],
            uip: fields[5]
          });
        } else if (line.startsWith(' New connection from')) {
          //New connection from ##.##.##.## on port 1883.
          var fields = line.split(' ');
          measurement.send({
            t: 'event',
            ec: 'broker',
            ea: 'New.connection',
            el: fields[4].split(',')[0],
            uip: fields[4].split(',')[0],
            uid: 'System'
          });
        }else if (line.startsWith(' Socket error on client')) {
          //console.log(line);
          var fields = line.split(' ');
          //console.log("Socket Error uid=%s",fields[5]);
          measurement.send({
            t: 'event',

            ec: 'broker',
            ea: 'Socket.error',
            el: fields[5].split(',')[0],
            sc: 'end',
            geoid: 'Amazon',
            uid: fields[5].split(',')[0]
          });
        } else if (line.includes("has exceeded timeout")) {
          // Client NNNNNN has exceeded timeout, disconnecting
          //console.log(line);
          var fields = line.split(" ");
          //console.log("Timeout uid=%s",fields[2]);
          measurement.send({
            t: 'event',
            ec: 'broker',
            ea: 'Timeout',
            el: fields[2],
            sc: 'end',
            geoid: 'Amazon',
            uid: fields[2]
          });
        } else if (line.includes("already connected")) {
          // Client NNNNNN already connected, closing old connection.
          //console.log(line);
          var fields = line.split(" ");
          //console.log("Timeout uid=%s",fields[2]);
          measurement.send({
            t: 'event',
            ec: 'broker',
            ea: 'Already.connected',
            el: fields[2],
            sc: 'end',
            uid: fields[2]
          });
        }  else {
          //console.log("Unhandled ", line);
        }
        break;
    }
  });
} catch (err) {
  console.log('ERROR: ', err);
}
