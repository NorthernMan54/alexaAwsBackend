var Tail = require('tail').Tail;
var Measurement = require('./googleMeasurement.js');

var googleAnalyicsTID = process.env.GOOGLE_ANALYTICS_TID;
var measurement = new Measurement(googleAnalyicsTID);

var options = {
  fromBeginning: false,         // Set to true for testing with a static file
  follow: true
}

try {
var tail = new Tail("/var/log/mosquitto/mosquitto.log", options);

tail.on("error", function(err) {
  console.log('ERROR: ', err);
});

tail.on("line", function(data) {
  //console.log(data);
  process.stdout.write(".");
  var line = data.split(":")[1];

  if (!line)
    line = data;

  if (line.startsWith(" New client connected from")) {
    //console.log(line);
    var fields = line.split(" ");

    measurement.send({
      t: 'event',
      ds: 'broker',
      ec: 'broker',
      ea: 'Connect',
      el: fields[7],
      sc: 'start',
      uid: fields[7],
      uip: fields[5]
    });
    //console.log("Connected uid=%s, ip=%s",fields[7],fields[5]);
  } else if (line.startsWith(" Socket error on client")) {
    //console.log(line);
    var fields = line.split(" ");
    //console.log("Socket Error uid=%s",fields[5]);
    measurement.send({
      t: 'event',
      ds: 'broker',
      ec: 'broker',
      ea: 'Disconnect',
      el: fields[5],
      sc: 'end',
      uid: fields[5]
    });
  } else if (line.startsWith(" Client")) {
    //console.log(line);
    var fields = line.split(" ");
    //console.log("Timeout uid=%s",fields[2]);
    measurement.send({
      t: 'event',
      ds: 'broker',
      ec: 'broker',
      ea: 'Timeout',
      el: fields[2],
      sc: 'end',
      uid: fields[2]
    });
  } else {
    //console.log("Unhandled ", line);
  }

});

} catch ( err ) {
  console.log('ERROR: ', err);
}
