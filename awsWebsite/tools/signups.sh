cat _usage-2.csv | awk -F, '{ if ( $3 > 0) print $7 }' | cut -c-11 | cut -c2- | sort | uniq -c
