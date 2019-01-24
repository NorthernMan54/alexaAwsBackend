var fs = require('fs');
var url = require('url');
var mqtt = require('mqtt');
var http = require('http');
var https = require('https');
var usage = require('./lib/usage.js');
var flash = require('connect-flash');
var morgan = require('morgan');
var express = require('express');
var eventGW = require('./lib/eventGW.js');
var session = require('express-session');
var passport = require('passport');
var mongoose = require('mongoose');
var json2html = require('node-json2html');
var bodyParser = require('body-parser');
var oauthServer = require('./lib/oauth.js');
var Measurement = require('./lib/googleMeasurement.js');
var oauthClient = require('./lib/oauthClient.js');
var cookieParser = require('cookie-parser');
var BasicStrategy = require('passport-http').BasicStrategy;
var LocalStrategy = require('passport-local').Strategy;
var PassportOAuthBearer = require('passport-http-bearer');

const Json2csvParser = require('json2csv').Parser;

var port = (process.env.VCAP_APP_PORT || process.env.PORT || 3000);
var host = (process.env.VCAP_APP_HOST || '0.0.0.0');
var mongo_url = (process.env.MONGO_URL || 'mongodb://localhost/users');

var mqtt_url = (process.env.MQTT_URL || 'mqtt://localhost:1883');
var mqtt_user = (process.env.MQTT_USER || 'mqtt_user');
var mqtt_password = (process.env.MQTT_PASSWORD || 'mqtt_pass');
// console.log(mqtt_url);

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
  mqttClient.subscribe('presense/#');
  mqttClient.subscribe('event/#');
});

console.log(mongo_url);
mongoose.Promise = global.Promise;
var mongoose_options = {
  server: {
    auto_reconnect: true,
    autoReconnect: true,
    reconnectTries: Number.MAX_VALUE,
    reconnectInterval: 1000,
    socketOptions: {
      autoReconnect: true
    }
  }
};
var mongoose_connection = mongoose.connection;

mongoose_connection.on('connecting', function() {
  console.log('connecting to MongoDB...');
});

mongoose_connection.on('error', function(error) {
  console.error('Error in MongoDb connection: ' + error);
  // mongoose.disconnect();
});

mongoose_connection.on('connected', function() {
  console.log('MongoDB connected!');
});

mongoose_connection.once('open', function() {
  console.log('MongoDB connection opened!');
});

mongoose_connection.on('reconnected', function() {
  console.log('MongoDB reconnected!');
});

mongoose_connection.on('disconnected', function() {
  console.log('MongoDB disconnected!');
});

mongoose.connect(mongo_url, mongoose_options);

var Account = require('./models/account');
var oauthModels = require('./models/oauth');
var Devices = require('./models/devices');
var Topics = require('./models/topics');
var LostPassword = require('./models/lostPassword');
var Usage = require('./models/usage');

Account.findOne({
  username: mqtt_user
}, function(error, account) {
  if (!error && !account) {
    Account.register(new Account({
        username: mqtt_user,
        email: '',
        mqttPass: '',
        superuser: 1
      }),
      mqtt_password,
      function(err, account) {
        var topics = new Topics({
          topics: [
            'command/' + account.username + '/#',
            'presence/' + account.username + '/#',
            'response/' + account.username + '/#'
          ]
        });
        topics.save(function(err) {
          if (!err) {

            var s = Buffer.from(account.salt, 'hex').toString('base64');
            var h = Buffer.from(account.hash, 'hex').toString(('base64'));

            var mqttPass = "PBKDF2$sha256$901$" + account.salt + "$" + account.hash;

            Account.update({
                username: account.username
              }, {
                $set: {
                  mqttPass: mqttPass,
                  topics: topics._id
                }
              }, {
                multi: false
              },
              function(err, count) {
                if (err) {
                  console.log("DB Error:", err);
                }
              }
            );
          }
        });
      });
  } else {
    console.log("MQTT account already exists");
  }
});

var app_id = 'https://localhost:' + port;

var cookieSecret = 'ihytsrf334';

var app = express();

app.set('view engine', 'ejs');
app.enable('trust proxy');
app.use(morgan("combined"));
app.use(cookieParser(cookieSecret));
app.use(flash());
app.use(session({
  // genid: function(req) {
  //   return genuuid() // use UUIDs for session IDs
  // },
  secret: cookieSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true
  }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(passport.initialize());
app.use(passport.session());

function requireHTTPS(req, res, next) {
  if (req.get('X-Forwarded-Proto') === 'http') {
    // FYI this should work for local development as well
    var url = 'https://' + req.get('host');
    if (req.get('host') === 'localhost') {
      url += ':' + port;
    }
    url += req.url;
    return res.redirect(url);
  }
  next();
}

app.use(requireHTTPS);

app.use('/', express.static('static'));

passport.use(new LocalStrategy(Account.authenticate()));

passport.use(new BasicStrategy(Account.authenticate()));

passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());

var accessTokenStrategy = new PassportOAuthBearer(function(token, done) {
  oauthModels.AccessToken.findOne({
    token: token
  }).populate('user').populate('grant').exec(function(error, token) {
    // console.log("Passport: ", token);
    if (!error && token && !token.grant) {
      console.log("missing grant token: %j", token);
    }
    if (!error && token && token.active && token.grant && token.grant.active && token.user) {
      // console.log("Token is GOOD!");
      done(null, token.user, {
        scope: token.scope
      });
    } else if (!error) {
      // console.log("TOKEN PROBLEM", token.active );
      done(null, false);
    } else {
      // console.log("TOKEN PROBLEM 2");
      done(error);
    }
  });
});

passport.use(accessTokenStrategy);

app.get('/', function(req, res) {
  res.render('pages/index', {
    user: req.user,
    home: true
  });
});

app.get('/docs', function(req, res) {
  res.render('pages/docs', {
    user: req.user,
    docs: true
  });
});

app.get('/about', function(req, res) {
  res.render('pages/about', {
    user: req.user,
    about: true
  });
});

app.get('/login', function(req, res) {
  res.render('pages/login', {
    user: req.user,
    message: req.flash('error')
  });
});

app.get('/logout', function(req, res) {
  req.logout();
  if (req.query.next) {
    console.log(req.query.next);
    res.redirect(req.query.next);
  } else {
    res.redirect('/');
  }
});

app.post('/login',
  passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true,
    session: true
  }),
  function(req, res) {
    usage.lastUsedWebsite(req.user.username);
    if (req.query.next) {
      res.reconnect(req.query.next);
    } else {
      res.redirect('/about');
    }
  });

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect('/login');
  }
}

app.get('/newuser', function(req, res) {
  res.render('pages/register', {
    user: req.user
  });
});

app.post('/newuser', function(req, res) {
  Account.register(new Account({
    username: req.body.username,
    mqttPass: "foo"
  }), req.body.password, function(err, account) {
    if (err) {
      console.log("DB Error:", err);
      return res.status(400).send(err.message);
    }

    var topics = new Topics({
      topics: [
        'command/' + account.username + '/#',
        'presence/' + account.username + '/#',
        'response/' + account.username + '/#',
        'event/' + account.username + '/#'
      ]
    });
    topics.save(function(err) {
      if (!err) {

        var s = Buffer.from(account.salt, 'hex').toString('base64');
        var h = Buffer.from(account.hash, 'hex').toString(('base64'));

        var mqttPass = "PBKDF2$sha256$901$" + account.salt + "$" + account.hash;

        Account.update({
            username: account.username
          }, {
            $set: {
              mqttPass: mqttPass,
              topics: topics._id
            }
          }, {
            multi: false
          },
          function(err, count) {
            if (err) {
              console.log("DB Error:", err);
            }
          }
        );
      }
    });

    passport.authenticate('local')(req, res, function() {
      console.log("created new user %s", req.body.username);
      measurement.send({
        t: 'event',
        ec: 'web',
        ea: 'NewUser',
        el: req.body.username,
        geoid: 'Amazon',
        uid: req.body.username
      });
      res.status(201).send();
    });
  });
});

app.get('/changePassword/:key', function(req, res, next) {
  var uuid = req.params.key;
  LostPassword.findOne({
    uuid: uuid
  }).populate('user').exec(function(error, lostPassword) {
    if (!error && lostPassword) {
      req.login(lostPassword.user, function(err) {
        if (!err) {
          lostPassword.remove();
          res.redirect('/changePassword');
        } else {
          console.log("DB Error:", err);
          res.redirect('/');
        }
      })
    } else {
      res.redirect('/');
    }
  });
});

app.get('/changePassword', ensureAuthenticated, function(req, res, next) {
  res.render('pages/changePassword', {
    user: req.user
  });
});

app.post('/changePassword', ensureAuthenticated, function(req, res, next) {
  Account.findOne({
    username: req.user.username
  }, function(err, user) {
    if (!err && user) {
      user.setPassword(req.body.password, function(e, u) {
        // var s = Buffer.from(account.salt, 'hex').toString('base64');
        // var h = Buffer.from(account.hash, 'hex').toString(('base64'));
        var mqttPass = "PBKDF2$sha256$901$" + user.salt + "$" + user.hash;
        u.mqttPass = mqttPass;
        u.save(function(error) {
          if (!error) {
            console.log("Chagned %s's password", u.username);
            res.status(200).send();
          } else {
            console.log("Error changing %s's password", u.username);
            console.log(error);
            res.status(400).send("Problem setting new password");
          }
        });
      });
    } else {
      console.log("DB Error:", err);
      res.status(400).send("Problem setting new password");
    }
  });
});

app.get('/lostPassword', function(req, res, next) {
  res.render('pages/lostPassword', {
    user: req.user
  });
});

app.get('/auth/start', function(req, res, next) {
  console.log(req.headers);
  if (req.query.response_type === undefined) {
    res.end();
    //    res.status(400).send("Bad request");
    next(new Error("Bad request"));
  } else {
    next();
  }
}, oauthServer.authorize(function(applicationID, redirectURI, done) {
  oauthModels.Application.findOne({
    oauth_id: applicationID
  }, function(error, application) {
    if (application) {
      var match = false,
        uri = url.parse(redirectURI || '');
      for (var i = 0; i < application.domains.length; i++) {
        if (uri.host == application.domains[i] || (uri.protocol == application.domains[i] && uri.protocol != 'http' && uri.protocol != 'https')) {
          match = true;
          break;
        }
      }
      if (match && redirectURI && redirectURI.length > 0) {
        done(null, application, redirectURI);
      } else {
        done(new Error("You must supply a redirect_uri that is a domain or url scheme owned by your app."), false);
      }
    } else if (!error) {
      // Register Application - Should only be done once Server
      const app = new oauthModels.Application({
        title: "homebridge-alexa",
        oauth_id: '1',
        oauth_secret: '654321',
        domains: ["pitangui.amazon.com", "layla.amazon.com", "alexa.amazon.co.jp"]
      });

      app.save(function(err, account) {
        console.log("oauthModels.Application.register", error, account, application);
      });

      done(new Error("There is no app with the client_id you supplied."), false);
    } else {
      done(error);
    }
  });
}), function(req, res) {
  var scopeMap = {
    // ... display strings for all scope variables ...
    access_devices: 'access you devices',
    create_devices: 'create new devices'
  };

  res.render('pages/oauth', {
    transaction_id: req.oauth2.transactionID,
    currentURL: encodeURIComponent(req.originalUrl),
    response_type: req.query.response_type,
    errors: req.flash('error'),
    scope: req.oauth2.req.scope,
    application: req.oauth2.client,
    user: req.user,
    map: scopeMap
  });
});

app.post('/auth/finish', function(req, res, next) {
  console.log("/auth/finish user: ", req.user);
  // console.log(req.body);
  // console.log(req.params);
  if (req.user) {
    next();
  } else {
    passport.authenticate('local', {
      session: false
    }, function(error, user, info) {
      // console.log("/auth/finish authenting");
      if (user) {
        console.log(user.username);
        req.user = user;
        measurement.send({
          t: 'event',
          ec: 'web',
          ea: 'Linked',
          el: user.username,
          geoid: 'Amazon',
          uid: user.username
        });
        next();
      } else if (!error) {
        console.log("not authed"); // Login not found
        req.flash('error', 'Your logon or password was incorrect. Please try again.');
        res.redirect(req.body['auth_url']);
      }
    })(req, res, next);
  }
}, oauthServer.decision(function(req, done) {
  //console.log("decision user: ", req);
  done(null, {
    scope: req.oauth2.req.scope
  });
}));

app.post('/auth/exchange', function(req, res, next) {
  var appID = req.body['client_id'];
  var appSecret = req.body['client_secret'];

  // console.log("Req: ", req.body);
  oauthModels.Application.findOne({
    oauth_id: appID,
    oauth_secret: appSecret
  }, function(error, application) {
    if (application) {
      req.appl = application;
      next();
    } else if (!error) {
      // console.log("Error-1", appID, appSecret);
      error = new Error("There was no application with the Application ID and Secret you provided.");
      next(error);
    } else {
      // console.log("Error-2", appID, appSecret);
      next(error);
    }
  });
}, oauthServer.token(), oauthServer.errorHandler());

//
// Start of mqtt message handler
//

var onGoingCommands = {};

mqttClient.on('message', function(topic, message) {
  try {
    console.log("mqtt message: ", topic, message.toString());
    if (topic.startsWith('response/')) {
      var payload = JSON.parse(message.toString());
      var waiting = onGoingCommands[payload.event.header.messageId];
      // console.log("mqtt response: msgId ", payload.event.header.messageId);
      if (waiting) {
        //        console.log("mqtt response: " + JSON.stringify(payload, null, " "));
        waiting.res.send(payload);
        delete onGoingCommands[payload.event.header.messageId];
        // should really parse uid out of topic
        measurement.send({
          t: 'event',
          ec: 'message',
          ea: payload.event.header.name,
          el: waiting.user,
          sc: 'end',
          geoid: 'Amazon',
          uid: waiting.user
        });
        usage.lastUsedBroker(waiting.user);
      }
    } else if (topic.startsWith('event/')) {
      var payload = JSON.parse(message.toString());
      var user = topic.split("/")[1];
      eventGW.send(user, payload);
      // should really parse uid out of topic

      usage.lastEvent(user);
    } else if (topic.startsWith('presence/')) {
      var payload = JSON.parse(message.toString());
      var user = topic.split("/")[1];
      usage.presence(user, payload);
      // should really parse uid out of topic
      measurement.send({
        t: 'event',
        ec: 'presence',
        ea: payload.event.header.name,
        el: user,
        sc: 'end',
        geoid: 'Amazon',
        uid: user
      });
      // usage.lastUsedBroker(user);
    }
  } catch (err) {
    console.log("Processing Error", err);
    measurement.send({
      t: 'event',
      ec: 'message',
      ea: 'error',
      geoid: 'Amazon',
      el: err.message,
      uid: 'System'
    });
  }
});

var timeout = setInterval(function() {
  var now = Date.now();
  var keys = Object.keys(onGoingCommands);
  for (key in keys) {
    var waiting = onGoingCommands[keys[key]];
    console.log(keys[key]);
    if (waiting) {
      var diff = now - waiting.timestamp;
      if (diff > 6000) {
        console.log("timed out");
        waiting.res.status(504).send('{"error": "timeout"}');
        delete onGoingCommands[keys[key]];
        measurement.send({
          t: 'event',
          ec: 'message',
          ea: 'Timeout',
          el: waiting.user,
          sc: 'end',
          geoid: 'Amazon',
          uid: waiting.user
        });
      }
    }
  }
}, 500);

//
// Start of Alexa message handler
//

app.post('/api/v2/messages',
  passport.authenticate('bearer', {
    session: false
  }),
  function(req, res, next) {
    measurement.send({
      t: 'event',
      ec: 'message',
      ea: req.body.directive.header.name,
      el: req.user.username,
      sc: 'start',
      geoid: 'Amazon',
      uid: req.user.username
    });

    if (req.body.directive.header.namespace === "Alexa.Authorization") {
      // console.log("Auth:", req.body);
      oauthClient.retrieve(req, function(err, reply) {
        // console.log("Reply-1:", reply);
        if (!err) {
          res.send(reply);
        }
      });
    } else {
      var topic = "command/" + req.user.username + "/1";
      //  delete req.body.directive.payload.scope;  // Remove scope from message
      var message = JSON.stringify(req.body);
      try {
        console.log("MQTT Message", topic, message);
        mqttClient.publish(topic, message);
        usage.lastUsedAlexa(req.user.username);
      } catch (err) {

      }
      var command = {
        user: req.user.username,
        res: res,
        timestamp: Date.now()
      };
      onGoingCommands[req.body.directive.header.messageId] = command;

      if (req.body.directive.header.namespace === "Alexa.Discovery") {
        cleanUpTopics(req.user.username);
      }
    }
  }
);

app.get('/admin',
  ensureAuthenticated,
  function(req, res) {
    if (req.user.username == mqtt_user) {
      Account.count({}, function(err, count) {
        res.render('pages/admin', {
          user: req.user,
          userCount: count
        });
      });
    } else {
      res.redirect('/');
    }
  });

app.get('/admin/services',
  ensureAuthenticated,
  function(req, res) {
    if (req.user.username === mqtt_user) {
      oauthModels.Application.find({}, function(error, data) {
        if (!error) {
          res.render('pages/services', {
            user: req.user,
            services: data
          });
        }
      });
    } else {
      res.status(401).send();
    }
  });

app.get('/status',
  ensureAuthenticated,
  function(req, res) {
    Account.findOne({
      username: req.user.username
    }, function(error, data) {
      if (!error) {
        Usage.findOne({
          user: data._id
        }).populate('user', 'username').exec(function(error, data) {
          if (!error) {
            var transform = {
              "<>": "div",
              "html": "<tr><td>${user.username}</td><td>${created}</td><td>${lastUsedAlexa}</td><td>${alexaCount}</td><td>${lastUsedBroker}</td><td>${brokerCount}</td><td>${lastEvent}</td><td>${eventCount}</td></tr>"
            };
            res.send("<table border='1'><tr><th>Username</th><th>Created</th><th>Last Used Alexa</th><th>Alexa Count</th><th>Last Plugin Response</th><th>Response Count</th><th>Last Event</th><th>Event Count</th></tr>" + json2html.transform(data, transform) + "</table>");
          }
        });
      }
    });
  });

app.get('/admin/users',
  ensureAuthenticated,
  function(req, res) {
    if (req.user.username === mqtt_user) {
      Usage.find().sort('-lastUsedBroker').populate('user', 'username').exec(function(error, data) {
        if (!error) {
          var transform = {
            "<>": "div",
            "html": "<tr><td>${user.username}</td><td>${created}</td><td>${lastUsedAlexa}</td><td>${alexaCount}</td><td>${lastUsedBroker}</td><td>${brokerCount}</td><td>${lastEvent}</td><td>${eventCount}</td></tr>"
          };
          res.send("<a href=\"/usage.csv\" download=\"/usage.csv\">Download the data</a><table border='1'><tr><th>Username</th><th>Created</th><th>Last Used Alexa</th><th>Alexa Count</th><th>Last Plugin Response</th><th>Response Count</th><th>Last Event</th><th>Event Count</th></tr>" + json2html.transform(data, transform) + "</table>");
        }
      });
    } else {
      res.status(401).send();
    }
  });

app.get('/usage.csv',
  ensureAuthenticated,
  function(req, res) {
    if (req.user.username === mqtt_user) {
      Account.find({}, function(error, data) {
        try {
          const fields = ['username', 'lastUsedWebsite', 'brokerCount', 'lastUsedBroker', 'alexaCount', 'lastUsedAlexa', 'created'];
          const opts = {
            fields
          };
          const parser = new Json2csvParser(opts);
          res.send(parser.parse(data));
        } catch (err) {
          console.error(err);
        }
      });
    } else {
      res.status(401).send();
    }
  });

app.get('/admin/devices',
  ensureAuthenticated,
  function(req, res) {
    if (req.user.username === mqtt_user) {
      Devices.find({}, function(error, data) {
        res.send(data);
      });
    } else {
      res.status(401).send();
    }
  });

app.put('/services',
  ensureAuthenticated,
  function(req, res) {
    if (req.user.username === mqtt_user) {
      var application = oauthModels.Application(req.body);
      application.save(function(err, application) {
        if (!err) {
          res.status(201).send(application);
        }
      });
    } else {
      res.status(401).send();
    }
  });

app.post('/service/:id',
  ensureAuthenticated,
  function(req, res) {
    var service = req.body;
    oauthModels.Application.findOne({
        _id: req.params.id
      },
      function(err, data) {
        if (err) {
          res.status(500);
          res.send(err);
        } else {
          data.title = service.title;
          data.oauth_secret = service.oauth_secret;
          data.domains = service.domains;
          data.save(function(err, d) {
            res.status(201);
            res.send(d);
          });
        }
      });
  });

app.delete('/service/:id',
  ensureAuthenticated,
  function(req, res) {
    oauthModels.Application.remove({
        _id: req.params.id
      },
      function(err) {
        if (!err) {
          res.status(200).send();
        } else {
          res.status(500).send();
        }
      });
  });

var server = http.Server(app);
if (app_id.match(/^https:\/\/localhost:/)) {
  var options = {
    key: fs.readFileSync('./key/server.key'),
    cert: fs.readFileSync('./key/server.crt')
  };
  server = https.createServer(options, app);
}

server.listen(port, host, function() {
  console.log('App listening on  %s:%d!', host, port);
  console.log("App_ID -> %s", app_id);

  setTimeout(function() {

  }, 5000);
});

function cleanUpTopics(username) {
  // Add additional event topics to existing users when discovering devices

  Account.findOne({
    username: username
  }, function(error, account) {
    if (!error) {
      Topics.findOne({
        _id: account.topics
      }, function(error, topics) {
        if (!error && topics && topics.topics.length < 4) {
          // populate topics
          console.log("Updating Topics", account.username);
          topics.topics = [
            'command/' + account.username + '/#',
            'presence/' + account.username + '/#',
            'response/' + account.username + '/#',
            'event/' + account.username + '/#'
          ];
          topics.save(function(error) {
            if (!error) {
              console.log("Topics Saved", account.username);
            } else {
              console.log("save Topics Error", error);
            }
          });
        } else if (error) {
          console.log("find Topics Error", error);
        } else {
          // No need to update
        }
      });
    } else {
      console.log("find User Error", error);
    }
  });
}
