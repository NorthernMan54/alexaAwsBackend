#! /bin/sh

cat $1 | awk -F, '{ print $7 }' | cut -c-11 | cut -c2- | sort | uniq -c | grep -v created > output.$$.tmp

cat $1 | awk -F, '{ if ( $5 > 0) print $7 }' | cut -c-11 | cut -c2- | sort | uniq -c | join -1 2 -2 2 -a 1 output.$$.tmp - > output.$$.1.tmp

cat $1 | awk -F, '{ if ( $3 > 0) print $7 }' | cut -c-11 | cut -c2- | sort | uniq -c | join -1 1 -2 2 -a 1 output.$$.1.tmp -

rm output.$$.tmp output.$$.1.tmp
