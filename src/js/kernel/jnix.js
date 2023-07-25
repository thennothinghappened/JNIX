import { scheduler } from '/js/kernel/scheduler.js';

/**
 * @param {string} path 
 */
async function blah(path) {
    const pid = await scheduler.process_start( path, -1, 0, 0, { 'TERM': 'jterm' }, [] );
}

for (let i = 0; i < 31; i ++) {
    blah('/js/lib/programs/test.js');
}

scheduler.process_queue_allocate();