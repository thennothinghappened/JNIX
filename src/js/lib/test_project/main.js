import { do_stuff } from '/js/lib/test_project/testlib.js';
import { write } from '/js/lib/fs.js';
///#endimports

do_stuff();
write(0, 'hi from main :)');