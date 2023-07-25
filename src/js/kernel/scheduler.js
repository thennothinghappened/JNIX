import { Process } from './process.js';

class Scheduler {

    static #max_processes = 30;
    static #max_user_processes = 20;

    /** @type { Map<number, Process> } */
    #process_table = new Map();
    /** @type { { uid: number, resolve: ( pid: number ) => void }[] } */
    #process_start_queue = new Array();
    #pid_index = 0;

    constructor() {
        
    }

    /**
     * Get a list of processes currently running for a User ID
     * @param { number } uid
     * @returns { Map<number, Process> }
     */
    #user_get_processes = ( uid ) => {

        const processes = new Map();

        for ( const p of this.#process_table.entries() ) {
            if ( p[1].uid === uid ) {
                processes.set( p[0], p[1] );
            }
        }

        return processes;
    }

    /**
     * Must be ran whenever a process ID becomes available,
     * such as a running process ending.
     */
    process_queue_allocate = () => {

        let num_procs = this.#process_start_queue.length;

        while ( 
            num_procs > 0 && 
            this.#process_table.size < Scheduler.#max_processes
        ) {
            num_procs --;

            const req = this.#process_start_queue.shift();

            if ( req === undefined ) {
                return;
            }

            if ( !this.#process_can_allocate( req.uid ) ) {
                // Return the process to the back of the queue
                this.#process_start_queue.push( req );
                continue;
            }

            // Allocate the new process
            const pid = this.#process_id_get();
            req.resolve( pid );
        }

    }

    /**
     * Find a valid available PID.
     * This MUST only be called when the table is known to have
     * available space, or WILL infinitely loop.
     * @returns {number}
     */
    #process_id_get = ( ) => {

        let give_up = 100;

        while ( 
            this.#process_table.get( this.#pid_index ) !== undefined
        ) {
            give_up --;
            this.#pid_index ++;

            if (give_up <= 0) return -1;

            if ( this.#pid_index >= Scheduler.#max_processes ) {
                this.#pid_index = 0;
            }
        }

        return this.#pid_index;

    }

    /**
     * Checks if a process ID is available currently to allocate for a user.
     * @param { number } uid
     * @returns { boolean }
     */
    #process_can_allocate = ( uid ) => {

        // Non-root users are subject to max_user_processes
        if ( 
            uid !== 0 &&
            this.#user_get_processes( uid ).size >= Scheduler.#max_user_processes
        ) {
            return false;
        }

        if ( this.#process_table.size >= Scheduler.#max_processes ) {
            return false;
        }

        return true;
    }

    /**
     * Add a process to the queue to be started.
     * Once successful, the process' PID will be returned.
     * @param { string } url URL or Blob URL of the code
     * @param { number } ppid Parent Process ID of the process
     * @param { number } uid User ID of the process
     * @param { number } gid Group ID of the process
     * @param { { [key: string]: string } } env Environment variables for the process
     * @param { string[] } args Arguments the process was started with
     * @returns { Promise<number> }
     */
    process_start = async ( url, ppid, uid, gid, env, args ) => {
        
        // debug, prevents browser caching result for now
        url += `?a=${Math.round(Math.random() * 100000)}`;

        // some evil stuff that should be rewritten!
        /** @type { (value: number) => void } */
        let _resolve;
        const pid = new Promise((resolve) => { _resolve = resolve; });

        this.#process_start_queue.push({
            uid: uid,
            /** @ts-ignore */
            resolve: ( pid ) => {
                console.log('a');
                const process = new Process( url, ppid, pid, uid, gid, env, args, ( process, call, data ) => {
                    // console.log(process, call, data);
                } );
        
                this.#process_table.set( pid, process );

                _resolve( pid );
            }
        });

        return await pid;

    }

}

export const scheduler = new Scheduler();