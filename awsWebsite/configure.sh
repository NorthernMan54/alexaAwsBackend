#! /bin/sh

zip -r -u config.zip apache2 mosquitto
sftp $KEY -b config.sftp $LOGON
ssh $KEY $LOGON "chmod a+x config.sh;./config.sh"
