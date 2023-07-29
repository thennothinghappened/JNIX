import { Signal } from '/js/lib/types.js';

/**
 * Kernel representation of a thread.
 * Wrapper around a Worker instance to make communication
 * simpler. A Thread may be a Kernel thread or a userspace {@link Process}
 */
export class Thread {

    #worker;
    /** @protected */
    _ppid;
    /** @protected */
    _pid;
    /** @protected */
    _uid;
    /** @protected */
    _gid;
    #name;

    #messageHandler;
    /** @protected */
    _errorHandler;
    /** @protected */
    _messageErrorHandler;

    /**
     * Message queue.
     * 
     * The message queue is a Map containing all tracked messages awaiting
     * a response from the Thread. Each message is tied to a unique identifier,
     * which the Thread will use when addressing this specific message.
     * 
     * This system is used as messages may be replied to in a different order
     * than they were sent.
     * 
     * When a reply to the message is received, the `Promise` will be resolved
     * with the message data.
     * 
     * Messages originating from the Thread use **positive** values, while messages from the Kernel use **negative** values.
     * 
     * @type { Map<number, ( event: import('/js/lib/types.js').ThreadMessageEvent<any> ) => void> }
     */
    #thread_message_queue = new Map();

    /**
     * Instantiate the thread
     * @param { string } image Data URL Blob of the Thread, or JS file URL to init with
     * @param { string } name Name to identify the Thread by
     * @param { number } ppid Parent Process ID of the Thread
     * @param { number } pid Process ID of the Thread
     * @param { number } uid User ID of the Thread
     * @param { number } gid Group ID of the Thread
     * @param { ( thread: Thread, event: import('/js/lib/types.js').ThreadMessageEvent<any> ) => void } messageHandler Callback for syscalls received
     * @param { ( thread: Thread, error: Error ) => void } errorHandler Callback if the Thread crashes
     * @param { ( thread: Thread, event: import('/js/lib/types.js').ThreadMessageEvent<any?> ) => void } messageErrorHandler Callback for errors decoding messages
     */
    constructor( image, name, ppid, pid, uid, gid, messageHandler, errorHandler, messageErrorHandler ) {
        this.#name = name;
        this._ppid = ppid;
        this._pid = pid;
        this._uid = uid;
        this._gid = gid;

        this.#worker = new Worker( image, { type: 'module' } );
        this.#messageHandler = messageHandler;
        this._errorHandler = errorHandler;
        this._messageErrorHandler = messageErrorHandler;

        this.#worker.onerror = ( event ) => {
            this._errorHandler( this, event.error );
        };

        this.#worker.onmessageerror = ( event ) => {
            this._messageErrorHandler( this, event );
        }

        this.#worker.onmessage = this._on_message_received;

    }

    /**
     * Find a new vaild identifier for a message we are sending.
     * @returns { number }
     */
    #queue_new_id = () => {

        let i = -1;
        while ( this.#thread_message_queue.has( i ) ) {
            i --;
        }

        return i;

    }

    /**
     * Handler for messages received from the Worker.
     * @param { import('/js/lib/types.js').ThreadMessageEvent<any> } event Message from Worker
     * @protected
     */
    _on_message_received = ( event ) => {
        const msg = event.data;

        // Check if this is a tracked id (this is a reply)
        const handler = this.#thread_message_queue.get( msg.identifier );
        if ( handler !== undefined ) {

            this.#thread_message_queue.delete( msg.identifier );
            return handler( event );
        }

        this.#messageHandler( this, event );
    }

    /**
     * Send a message to the thread, expecting a reply.
     * @param { any } data Data to send
     * @param { Transferable[] } [transferables] Transferable objects
     * @param { number } [identifier] Identifier for this message, if this is an ongoing conversation, expecting another reply.
     * @returns { Promise<import('/js/lib/types.js').ThreadMessageEvent<any>> }
     */
    message = ( data, transferables, identifier = this.#queue_new_id() ) => {

        /** @type { Promise<import('/js/lib/types.js').ThreadMessageEvent<any>> } */
        const promise = new Promise( ( resolve ) => {
            this.#thread_message_queue.set( identifier, ( event ) => {
                this.#thread_message_queue.delete( identifier );
                // @ts-ignore
                resolve( event );
            } );
        } );

        this._send_message( identifier, data, transferables );

        return promise;
    }

    /**
     * Wrapper to send a message either as a reply, or not expecting a further response.
     * @param { number } identifier Unique identifier for the message. If 0, the message is spontanious and expects no acknowledgement.
     * @param { any } data Data to send
     * @param { Transferable[] } [transferables] Transferable objects
     */
    message_noreply = ( identifier, data, transferables ) => {
        this._send_message( identifier, data, transferables );
    }

    /**
     * @protected
     * Wrapper for postMessage to talk to the thread.
     * @param { number } identifier Unique identifier for the message.
     * @param { any } data Data to send
     * @param { Transferable[] } [transferables] Transferable objects
     */
    _send_message = ( identifier, data, transferables = [] ) => {
        /** @type { import('/js/lib/types.js').Message<any> } */
        const msg = {
            data: data,
            identifier: identifier
        };

        this.#worker.postMessage(msg, transferables);
    }

    /**
     * Terminate the thread immediately.
     * 
     * This should only ever be called once the thread has been unlinked
     * from any resources, and properly cleaned up.
     */
    kill = () => {
        this.#worker.terminate();
    }

    get name() {
        return this.#name;
    }

    get ppid() {
        return this._ppid;
    }

    get pid() {
        return this._pid;
    }

    get uid() {
        return this._uid;
    }

    get gid() {
        return this._gid;
    }

}