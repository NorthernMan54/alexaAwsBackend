#! /bin/sh

. ./passwordTest

cd awsWebsite

export DEBUG_HIDE_DATE

echo "Start mongod --config /usr/local/etc/mongod.conf"

export MQTT_URL=mqtt://leonard.local:1883
export MONGO_URL=mongodb://localhost/users
export APP_URL=http://localhost:
DEBUG=-express:*,-body-parser:json,-body-parser:urlencoded,* node index.js
