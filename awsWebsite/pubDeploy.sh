# Deployer script for web site

echo
echo "========================== Starting Server Deploy ============================="
echo

pkill node
rm -rf awsWeb
mkdir awsWeb
cd awsWeb
unzip ../homebridgeWeb.zip
npm install
echo
echo "========================== Starting Server ============================="
echo
../startup
