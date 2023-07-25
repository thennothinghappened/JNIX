import { scheduler } from '/js/kernel/scheduler.js';

/**
 * @param {string} path 
 */
async function blah(path) {
    const pid = await scheduler.process_start( path, 0, 0, { 'TERM': 'jterm' }, [ path ] );
}

blah('/js/lib/programs/test.js');
scheduler.process_queue_allocate();