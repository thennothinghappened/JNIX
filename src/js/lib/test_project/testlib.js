import { write } from '/js/lib/fs.js';
import { say_hi } from '/js/lib/stdlib.js';
///#endimports

export function do_stuff() {
    say_hi();
    write( 0, 'doing stuff' );
}