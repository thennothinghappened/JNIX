/**
 * Time in relation to system boot time
 */

///#noimports

/** @type { number } */
let boot_time;

/**
 * To be called from start_kernel at the beginning
 * of startup.
 */
export function _scheduler_time_init() {
    boot_time = Date.now();
}

/**
 * Get the current time in millis from boot time.
 */
export function scheduler_time_get() {
    return Date.now() - boot_time;
}