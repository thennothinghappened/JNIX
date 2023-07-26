import { Signal, heartbeat_interval, heartbeat_grace_period, Syscall } from '/js/lib/types.js';

/**
 * Kernel representation of a process.
 * Wrapper around a Worker instance to make communication
 * simpler.
 */
export class Process {

    #worker;
    #ppid;
    #pid;
    #uid;
    #gid;
    #url;

    #messageHandler;
    #initialised = false;

    /**
     * Message queue.
     * 
     * The message queue is a Map containing all tracked messages awaiting
     * a response from the Kernel. Each message is tied to a unique identifier,
     * which the Kernel will use when addressing this specific message.
     * 
     * This system is used as messages may be replied to in a different order
     * than they were sent.
     * 
     * When a reply to the message is received, the `Promise` will be resolved
     * with the message data.
     * 
     * @type { Map<number, ( msg: import('/js/lib/types.js').PMessage ) => void> }
     */
    #pmessage_queue = new Map();

    /**
     * Instantiate the process
     * @param { string } url URL or data blob URL for the Worker
     * @param { number } ppid Parent Process ID of the process
     * @param { number } pid Process ID of the process
     * @param { number } uid User ID of the process
     * @param { number } gid Group ID of the process
     * @param { { [key: string]: string } } env Environment variables for the process
     * @param { string[] } args Arguments the process was started with
     * @param { ( process: Process, call: number, data?: any ) => void } messageHandler Callback for messages received
     */
    constructor( url, ppid, pid, uid, gid, env, args, messageHandler ) {
        this.#ppid = ppid;
        this.#pid = pid;
        this.#uid = uid;
        this.#gid = gid;
        this.#url = url;

        this.#worker = new Worker( url, { type: 'module' } );
        this.#messageHandler = messageHandler;

        // End the process if it doesn't respond in the grace period.
        setTimeout( () => {
            if ( this.#initialised ) {
                return;
            }

            // TODO: handle failed response in grace period!
            console.warn(`PID ${this.#pid} failed to make handshake.`);

        }, heartbeat_grace_period );

        this.#worker.onmessage = this.#on_message_received;

        // Send the INIT signal with initialisation data.
        const init_reply = this.signal( Signal.INIT, {
            ppid: ppid,
            pid: pid,
            uid: uid,
            gid: gid,
            env: env,
            args: args
        } );

        init_reply.then( (msg) => {
            if ( msg.syscall !== Syscall.INIT ) {
                console.log(msg);
                return;
            }
            
            this.#initialised = true;
        } )

    }

    /**
     * Find a new vaild identifier for a message we are sending.
     * @returns { number }
     */
    #get_identifier = () => {

        let i = 0;
        while ( this.#pmessage_queue.has( i ) ) {
            i ++;
        }

        return i;

    }

    /**
     * Handler for messages received from the Worker.
     * @param { MessageEvent } event Message from Worker
     */
    #on_message_received = ( event ) => {
        /** @type { import('/js/lib/types.js').PMessage } */
        const msg = event.data;

        // First check if we are expecting a response already:
        const handler = this.#pmessage_queue.get( msg.identifier );
        if ( handler !== undefined ) {

            this.#pmessage_queue.delete( msg.identifier );
            return handler( msg );
        }

        this.#messageHandler( this, msg.syscall, msg.data );
    }

    /**
     * Send a signal to the process, expecting a reply.
     * @param { number } signal Signal number
     * @param { any } [data] Data to send
     * @param { Transferable[] } [transferables] Transferable objects
     * @returns { Promise<import('/js/lib/types.js').PMessage> }
     */
    signal = ( signal, data, transferables ) => {

        const identifier = this.#get_identifier();

        /** @type { Promise<import('/js/lib/types.js').PMessage> } */
        const promise = new Promise( ( resolve ) => {
            this.#pmessage_queue.set( identifier, ( msg ) => {
                this.#pmessage_queue.delete( identifier );
                resolve( msg );
            } );
        } );

        this.#send_message( identifier, signal, data, transferables );

        return promise;
    }

    /**
     * Wrapper for postMessage to talk to the process.
     * @param { number } identifier Unique identifier for the message.
     * @param { number } signal Signal number
     * @param { any } [data] Data to send
     * @param { Transferable[] } [transferables] Transferable objects
     */
    #send_message = ( identifier, signal, data, transferables = [] ) => {
        this.#worker.postMessage({
            signal: signal,
            data: data,
            identifier: identifier
        }, transferables);
    }

    get ppid() {
        return this.#ppid;
    }

    get pid() {
        return this.#pid;
    }

    get uid() {
        return this.#uid;
    }

    get gid() {
        return this.#gid;
    }

}