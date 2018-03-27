#! /bin/sh

rm -rf apache2 mosquitto
unzip config.zip

sudo cp apache2/conf/httpd-awsWeb.conf /etc/apache2/sites-available
sudo cp mosquitto/conf/* /etc/mosquitto/conf.d/

sudo systemctl restart apache2
sudo /etc/init.d/mosquitto restart
