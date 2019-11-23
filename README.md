This repository contains the backend code for homebridge-alexa

# homebridge-alexa

These are my notes and backlog for the creating of the Skill Based approach for integrating Amazon Alexa with HomeBridge.  Also all code for this version will use this branch of the repository.

<!--ts-->
   * [homebridge-alexa](#homebridge-alexa)
   * [Concept](#concept)
   * [End to End Design](#end-to-end-design)
   * [Plugin Design](#plugin-design)
   * [backlog](#backlog)
   * [Setup Development Toolchain](#setup-development-toolchain)
      * [Alexa Lambda HomeSkill](#alexa-lambda-homeskill)
   * [aws LightSail web website](#aws-lightsail-web-website)
      * [Inital Build](#inital-build)
         * [mosquitto Config](#mosquitto-config)
         * [Growing over 1024 Users](#growing-over-1024-users)
         * [Apache SSL Config](#apache-ssl-config)
         * [Enable storage of more logs](#enable-storage-of-more-logs)
         * [awsWebsite UFW Rules](#awswebsite-ufw-rules)
      * [Nov 2019 Software Upgrades](#nov-2019-software-upgrades)
         * [MongoDB Tuning](#mongodb-tuning)
         * [NodeJS update to 10.17.0](#nodejs-update-to-10170)
         * [mongodb update to 3.4](#mongodb-update-to-34)
         * [mongodb update 3.4 to 3.6](#mongodb-update-34-to-36)
         * [DB Maintenance](#db-maintenance)
            * [Create a BU first](#create-a-bu-first)
            * [Maintenance Commands using mongo](#maintenance-commands-using-mongo)
            * [Update to WiredTiger Storage Engine](#update-to-wiredtiger-storage-engine)
   * [Local version of awsWebsite](#local-version-of-awswebsite)
   * [Amazon AWS Lambda function](#amazon-aws-lambda-function)
      * [Create AWS Lambda function](#create-aws-lambda-function)
   * [Historical Dates](#historical-dates)
   * [Credits](#credits)

<!-- Added by: sgracey, at:  -->

<!--te-->


# Concept

          -------------------
          | Alexa HomeSkill |
          -------------------
                  |
                 \|/
          -------------------
          | website         |
          -------------------
                 /|\
                  |
          ---------------------
          | Homebridge Plugin |
          ---------------------
          | HAPNodeJS         |
          ---------------------

```
Alexa --> HomeBridge --(webservice)--> WebSite <--(MQTT)--> HomeBridge --(WebService)--> (HAP-NodeJS)
          HomeSkill                                         Plugin
```

# End to End Design

![Diagram](docs/Homebridge-Alexa.001.jpeg)

# Plugin Design

![Diagram](docs/Homebridge-Alexa.002.jpeg)

HomeBridge HomeSkill sends alexa directives to website, website uses endpoint.scope.token to lookup account, and mqtt topic of account.  Website sends alexa directive to HomeBridge plugin via MQTT.  Plugin uses endpoint.endpointid to determine HAP instance, and create HAP request.

HomeBridge plugin has a module that generates events for each directive.  Events name based on directive.header.namespace ( ie Alexa.Discovery ), but with 'Alexa.' removed.

My inspiration for the design is based on the work done to create a Alexa Skill for Node Red by Ben Hardill.  You read the details here: http://www.hardill.me.uk/wordpress/2016/11/05/alexa-home-skill-for-node-red/

# backlog

Moved to https://github.com/NorthernMan54/alexaAwsBackend/issues/6

# Setup Development Toolchain

## Alexa Lambda HomeSkill

* Followed this - https://developer.amazon.com/blogs/post/Tx1UE9W1NQ0GYII/Publishing-Your-Skill-Code-to-Lambda-via-the-Command-Line-Interface

1 - Name - AlexaHome
2 - Runtime - NodeJS 6.10

```
deb https://deb.nodesource.com/node_7.x xenial main
deb-src https://deb.nodesource.com/node_7.x xenial main
```

3 - Role - Choose existing
4 - Existing Role - lamba_basic_execution
Create function
5 - Add trigger - Alexa Smart Home
6 - Application ID - Copy from Alexa config
save
7 - Timeout - 10 Seconds

9 - Add ARN to Alexa Skill config

** Environment Variables

ENDPOINT - https://homebridge.cloudwatch.net/
DEBUG - ( empty or true )




# aws LightSail web website

## Inital Build

* Selected Ubuntu OS image, and installed nodejs

```
curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
sudo apt-get install -y nodejs
```

* install mongodb mosquitto mosquitto-auth-plugin

```
sudo apt-get install apache2 mongodb unzip
```

apt-get build-dep mosquitto mosquitto-auth-plugin
sudo apt-get install dpkg-dev
sudo apt-get install libmongoc-developer
sudo apt-get install libbson-dev

Installed from source

mongo-c-driver-1.9.2 - http://mongoc.org/libmongoc/current/installing.html
mosquitto-1.4.14
mosquitto-auth-plug-0.1.2

cd mosquitto-auth-plugin
vi config.mk - enable mongo and files
make
sudo cp auth-plug.so /usr/lib/mosquitto-auth-plugin/auth-plugin.so

### mosquitto Config

cp mosquitto/conf/mosquitto.conf /etc/mosquitto/conf.d/mosquitto.conf

### Growing over 1024 Users

1. Added `ulimit -n 60000` to /etc/init.d/mosquitto

2. Added to /etc/security/limits.conf

```
mosquitto 	hard	nofile 		10000000
mosquitto 	soft	nofile 		10000000
```

### Apache SSL Config

* Registered IP Address at freeDNS - homebridge.cloudwatch.net

1. Followed the instructions here http://freedns.afraid.org/scripts/afraid.aws.sh.txt, but used this script as it worked better.  http://freedns.afraid.org/scripts/update.sh.txt

2. URL/hostname is coded in /etc/cron.d/afraid.aws.sh

* Create SSL at Let's Encrypt

This is wrong

```
sudo apt-get update
sudo apt-get install software-properties-common
sudo add-apt-repository ppa:certbot/certbot
sudo apt-get update
sudo apt-get install python-certbot-apache
sudo /opt/bitnami/ctlscript.sh stop apache
sudo certbot certonly
  2
  homebridge.cloudwatch.net

- Congratulations! Your certificate and chain have been saved at:
   /etc/letsencrypt/live/homebridge.cloudwatch.net/fullchain.pem
   Your key file has been saved at:
   /etc/letsencrypt/live/homebridge.cloudwatch.net/privkey.pem
   Your cert will expire on 2018-04-28. To obtain a new or tweaked
   version of this certificate in the future, simply run certbot
   again. To non-interactively renew *all* of your certificates, run
   "certbot renew"

From https://docs.bitnami.com/google/how-to/generate-install-lets-encrypt-ssl/
```

### Enable storage of more logs ##

```
sudo mkdir /var/log/journal
sudo systemd-tmpfiles --create --prefix /var/log/journal
sudo systemctl restart systemd-journald
```

### awsWebsite UFW Rules

```
ufw allow 22
ufw allow 443/tcp
ufw allow 1883/tcp
ufw allow 80/tcp
```

## Nov 2019 Software Upgrades

### MongoDB Tuning

Add these to "/etc/sysctl.d/15-mongodb.conf"
```
vm.swappiness = 1
net.ipv4.tcp_keepalive_time = 600
```

Create a new file "/etc/init.d/disable-transparent-hugepages"
$ sudo vi /etc/init.d/disable-transparent-hugepages
Add these in it;
```
#!/bin/bash
### BEGIN INIT INFO
# Provides:          disable-transparent-hugepages
# Required-Start:    $local_fs
# Required-Stop:
# X-Start-Before:    mongod mongodb-mms-automation-agent
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Disable Linux transparent huge pages
# Description:       Disable Linux transparent huge pages, to improve
#                    database performance.
### END INIT INFO
case $1 in
  start)
    if [ -d /sys/kernel/mm/transparent_hugepage ]; then
      thp_path=/sys/kernel/mm/transparent_hugepage
    elif [ -d /sys/kernel/mm/redhat_transparent_hugepage ]; then
      thp_path=/sys/kernel/mm/redhat_transparent_hugepage
    else
      return 0
    fi
echo 'never' > ${thp_path}/enabled
    echo 'never' > ${thp_path}/defrag
re='^[0-1]+$'
    if [[ $(cat ${thp_path}/khugepaged/defrag) =~ $re ]]
    then
      # RHEL 7
      echo 0  > ${thp_path}/khugepaged/defrag
    else
      # RHEL 6
      echo 'no' > ${thp_path}/khugepaged/defrag
    fi
unset re
    unset thp_path
    ;;
esac
```
change permission and add this script to boot time
$ sudo chmod 755 /etc/init.d/disable-transparent-hugepages
$ sudo update-rc.d disable-transparent-hugepages defaults


### NodeJS update to 10.17.0

```
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### mongodb update to 3.4

```
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 0C49F3730359A14518585931BC711F9BA15703C6

echo "deb [ arch=amd64,arm64 ] http://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.4 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-3.4.list

apt update

apt install mongodb-org -y

sudo systemctl enable mongod.service
sudo systemctl start mongod

mongo
db.adminCommand( { setFeatureCompatibilityVersion: "3.4" } )
```

### mongodb update 3.4 to 3.6

```
echo 'deb [ arch=amd64,arm64 ] http://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.6 multiverse' | sudo tee /etc/apt/sources.list.d/mongodb-org-3.6.list
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com --recv 2930ADAE8CAF5059EE73BB4B58712A2291FA4AD5
sudo rm /etc/apt/sources.list.d/mongodb-org-3.4.list
sudo apt-get update
sudo systemctl stop homebridge
sudo pkill node
sudo apt-get remove mongodb-org
sudo apt autoremove
sudo apt-get install -y mongodb-org
mongo --version
sudo systemctl enable mongod.service
sudo systemctl restart mongod
sudo systemctl start homebridge

mongo
db.adminCommand( { setFeatureCompatibilityVersion: "3.6" } )
```

### DB Maintenance

#### Create a BU first

```
cd /var/lib
sudo systemctl stop mongod
sudo tar cvf ./mongodb_bu.tar mongodb
sudo systemctl start mongod
```

#### Maintenance Commands using mongo

```
use admin
db.createUser(
  {
    user: "XXXXX",
    pwd: "XXXXXX",
    roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
  }
)
db.createUser(
  {
    user: "XXXXX",
    pwd: "XXXXXX",
    roles: [ { role: "root", db: "admin" } ]
  }
)
db.createUser(
  {
    user: "XXXXXXXX",
    pwd: "XXXXXXXX",
    roles: [ { role: "readWrite", db: "users" } ]
  }
)
```

To /etc/mongod.conf add

```
security:
  authorization: enabled
```

sudo systemctl restart mongod

Add to ~/passwordAwsWebsite

```
export MONGO_URL=mongodb://XXXXXXX:XXXXXXX@localhost/users?authSource=admin
```

#### Update to WiredTiger Storage Engine

```
sudo mkdir /var/lib/mongodbWired
sudo chown mongodb.mongodb /var/lib/mongodbWired
sudo systemctl stop homebridge
sudo pkill node
sudo systemctl stop mongod
mongodump -u XXXXX -p XXXXXX --out=/home/ubuntu/preUpgradeDump
mongod --storageEngine wiredTiger --dbpath /var/lib/mongodbWired --bind_ip localhost
```

In a different window
```
mongorestore /home/ubuntu/preUpgradeDump
```
Kill mongod

sudo vi /etc/mongod.conf

Change dbPath to
```
dbPath: /var/lib/mongodbWired
```

```
sudo chown -R mongodb.mongodb /var/lib/mongodbWired
sudo systemctl start mongod
sudo systemctl start homebridge
```

# Local version of awsWebsite

```
brew install mongo; brew services start mongodb
brew install mosquitto; brew services start mosquitto
```

# Amazon AWS Lambda function

## Create AWS Lambda function

1. Name - AlexaHome
2. Version - Node.js 6.1.0
3. Role - Choose an existing Role
4. Existing Role - lambda_basic_execution
5. Trigger - Alexa Smart Home

# Historical Dates

* Beta test started - Feb 19, 2018
* Initial Lightsail Server - Small 512 Mb Ram / 1 vCPU / 20 Gb SSD
* Production launch - English (CA), English (US) and English (UK) - March 14, 2018
* Added Germany and France - March 28, 2018
* Moved from cloudwatch.net to homebridge.ca - Dec 2018
* Added Italian (IT), English (IN), English (AU), Spanish (ES), Japanese (JP), Spanish (MX), French (CA) - Feb 13th, 2019
* Upgraded lightsail server to Large - 4Gb / 2 vCPUs / 80 Gb SSD - April 20, 2019
* Added Portuguese (BR), Spanish (US) - May 16th, 2019

# Credits

* Ben Hardill - For the inspiration behind the design.
