cd awsWebsite
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
