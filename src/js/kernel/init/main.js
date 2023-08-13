import { Scheduler } from '/js/kernel/scheduler/scheduler.js';
import { panic } from '/js/kernel/panic.js';
import { Uint16Circular } from '/js/lib/circular_buffer.js';
import { _scheduler_time_init, scheduler_time_get } from '/js/kernel/scheduler/time.js';
///#endimports

/**
 * Entry point to load the Kernel!
 * @param { string[] } cmdline Commandline parameters passed in by the bootloader
 */
export function start_kernel( cmdline ) {

    _scheduler_time_init();

    const b = Uint16Circular( 20 );
    
    for ( let byte of [...'im so sick of arraybuffers istg'] ) {
        b.write(byte.charCodeAt(0))
    }

    console.log(b.read_section(20).map( v => String.fromCharCode(v) ).join(''));

}