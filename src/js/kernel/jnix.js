import { scheduler } from '/js/kernel/scheduler.js';

async function blah() {
    const pid = await scheduler.process_start( '/js/lib/programs/test.js', 0, 0, {}, ['test'] );
}

blah()
scheduler.process_queue_allocate();