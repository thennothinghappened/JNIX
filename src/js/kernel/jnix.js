import { scheduler } from '/js/kernel/scheduler.js';
import { moduleLoader } from '/js/kernel/module_loader.js';

moduleLoader.load('textdrawer');

setTimeout(() => { moduleLoader.unload('textdrawer'); }, 2000);

scheduler.process_start( '/js/lib/programs/test.js', 'test', 1, 0, 0, {}, [] );
scheduler.process_queue_allocate();