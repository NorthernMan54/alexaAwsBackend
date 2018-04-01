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
echo "========================== Systemctl Starting Server ============================="
echo
# ../startup
sudo journalctl -f -o cat -u homebridge
