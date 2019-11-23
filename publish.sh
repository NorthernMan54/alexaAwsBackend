#! /bin/sh

./gh-md-toc --insert README.md
rm *orig* *toc\.*
git add .
git commit -m "$1"
git push origin master --tags
