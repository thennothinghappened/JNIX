import { scheduler } from '/js/kernel/scheduler.js';
import { moduleLoader } from '/js/kernel/module_loader.js';

moduleLoader.load('textdrawer');

setTimeout(() => { moduleLoader.unload('ktext_drawer'); }, 2000)