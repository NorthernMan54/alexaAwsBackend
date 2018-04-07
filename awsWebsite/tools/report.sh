#! /bin/sh

cat $1 | awk -F, '{ print $7 }' | cut -c-11 | cut -c2- | sort | uniq -c > output.$$.tmp

cat $1 | awk -F, '{ if ( $5 > 0) print $7 }' | cut -c-11 | cut -c2- | sort | uniq -c | join -1 2 -2 2 output.$$.tmp - > output.$$.1.tmp

cat $1 | awk -F, '{ if ( $3 > 0) print $7 }' | cut -c-11 | cut -c2- | sort | uniq -c | join -1 1 -2 2 output.$$.1.tmp -

rm output.$$.tmp output.$$.1.tmp
