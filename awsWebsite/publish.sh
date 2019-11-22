#!/usr/bin/env bash

# Exit on command failure

set -e

cd awsWebsite
echo
echo "========================== Preparing to Publish ============================="
echo
npm version patch
npm install
#npm audit
echo
echo "========================== Starting Packaging ============================="
echo
npm run-script package
echo
echo "========================== Starting Publishing ============================="
echo
npm run-script publish
echo
echo "========================== Starting Deploy ============================="
echo
ssh $KEY $LOGON "chmod a+x pubDeploy.sh;./pubDeploy.sh"
