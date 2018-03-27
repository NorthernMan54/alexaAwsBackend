# Deployer script for web site

echo
echo "========================== Starting Server Deploy ============================="
echo
rm -rf awsWeb
mkdir awsWeb
cd awsWeb
unzip ../homebridgeWeb.zip
npm install
pkill node
echo
echo "========================== Starting Server ============================="
echo
../startup
