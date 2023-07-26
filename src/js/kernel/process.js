import { Signal, heartbeat_interval, Syscall } from '/js/lib/types.js';

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
    /** @type { number[] } */
    #children = new Array();

    #messageHandler;
    #errorHandler;
    #syscallErrorHandler;
    
    #heartbeat;
    #heartbeat_ok = false;

    /**
     * Message queue.
     * 
     * The message queue is a Map containing all tracked messages awaiting
     * a response from the Process. Each message is tied to a unique identifier,
     * which the Process will use when addressing this specific message.
     * 
     * This system is used as messages may be replied to in a different order
     * than they were sent.
     * 
     * When a reply to the message is received, the `Promise` will be resolved
     * with the message data.
     * 
     * @type { Map<number, ( msg: MessageEvent<import('/js/lib/types.js').PMessage> ) => void> }
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
     * @param { ( process: Process, msg: MessageEvent<import('/js/lib/types.js').PMessage> ) => void } messageHandler Callback for syscalls received
     * @param { ( process: Process, error: Error ) => void } errorHandler Callback when a process crashes
     * @param { ( process: Process, msg: MessageEvent<import('/js/lib/types.js').PMessage?> ) => void } syscallErrorHandler Callback when a syscall cannot be decoded or is otherwise invalid
     */
    constructor( url, ppid, pid, uid, gid, env, args, messageHandler, errorHandler, syscallErrorHandler ) {
        this.#ppid = ppid;
        this.#pid = pid;
        this.#uid = uid;
        this.#gid = gid;
        this.#url = url;

        this.#worker = new Worker( url, { type: 'module' } );
        this.#messageHandler = messageHandler;
        this.#errorHandler = errorHandler;
        this.#syscallErrorHandler = syscallErrorHandler;

        this.#worker.onerror = ( event ) => {
            this.#errorHandler( this, event.error );
        };

        this.#worker.onmessageerror = ( event ) => {
            this.#syscallErrorHandler( this, event );
        }

        this.#worker.onmessage = this.#on_message_received;

        // Send the INIT signal with initialisation data.
        /** @type { import('/js/lib/types.js').KInitData } */
        const init_data = {
            ppid: ppid,
            pid: pid,
            uid: uid,
            gid: gid,
            env: env,
            args: args
        };

        const init_reply = this.signal( Signal.INIT, init_data );

        init_reply.then( (msg) => {
            if ( msg.data.syscall !== Syscall.INIT ) {
                this.#syscallErrorHandler( this, msg );
                return;
            }
            
            this.#heartbeat_ok = true;
        } );

        // Start heartbeat messages
        this.#heartbeat = setInterval( () => {
            if ( !this.#heartbeat_ok ) {
                this.#errorHandler( this, new Error( 'Process Worker failed to respond to heartbeat in given period.' ) );
                return;
            }

            this.#heartbeat_ok = false;
            this.signal( Signal.HEARTBEAT ).then(( msg ) => {

                console.log('badum');

                if ( msg.data.syscall === Syscall.HEARTBEAT ) {
                    this.#heartbeat_ok = true;
                }
            })

        }, heartbeat_interval );

    }

    /**
     * Find a new vaild identifier for a message we are sending.
     * @returns { number }
     */
    #queue_new_id = () => {

        let i = 0;
        while ( this.#pmessage_queue.has( i ) ) {
            i ++;
        }

        return i;

    }

    /**
     * Handler for messages received from the Worker.
     * @param { MessageEvent<import('/js/lib/types.js').PMessage> } event Message from Worker
     */
    #on_message_received = ( event ) => {
        /** @type { import('/js/lib/types.js').PMessage } */
        const msg = event.data;

        // Check if this is a tracked id (this is a reply)
        const handler = this.#pmessage_queue.get( msg.identifier );
        if ( handler !== undefined ) {

            this.#pmessage_queue.delete( msg.identifier );
            return handler( event );
        }

        this.#messageHandler( this, event );
    }

    /**
     * Send a signal to the process, expecting a reply.
     * @param { number } signal Signal number
     * @param { any } [data] Data to send
     * @param { Transferable[] } [transferables] Transferable objects
     * @param { number } [identifier] Identifier for this message, if this is an ongoing conversation, expecting another reply.
     * @returns { Promise<MessageEvent<import('/js/lib/types.js').PMessage>> }
     */
    signal = ( signal, data, transferables, identifier = this.#queue_new_id() ) => {

        /** @type { Promise<MessageEvent<import('/js/lib/types.js').PMessage>> } */
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
     * Wrapper to send a signal either as a reply, or not expecting a further response.
     * @param { number } identifier Unique identifier for the message. If -1, the signal is spontanious and expects no acknowledgement.
     * @param { number } signal Signal number
     * @param { any } [data] Data to send
     * @param { Transferable[] } [transferables] Transferable objects
     */
    signal_noreply = ( identifier, signal, data, transferables ) => {
        this.#send_message( identifier, signal, data, transferables );
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

    /**
     * Terminate the process immediately.
     * 
     * This should only ever be called once the process has been unlinked
     * from any resources, and properly cleaned up.
     */
    kill = () => {
        clearInterval( this.#heartbeat );
        this.#worker.terminate();
    }

    set ppid( ppid ) {
        this.#ppid = ppid;
        this.signal_noreply( -1, Signal.NEWPPID, ppid );
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

    get children() {
        return this.#children;
    }

}