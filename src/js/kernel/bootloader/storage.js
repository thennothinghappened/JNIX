/**
 * Data storage in localStorage for
 * the bootloader.
 */

/**
 * @param { string } key 
 * @returns { string? }
 */
export function storage_get( key ) {
    return localStorage.getItem( key );
}

/**
 * @param { string } key 
 * @param { string } val
 * @returns { string }
 */
export function storage_set( key, val ) {
    localStorage.setItem( key, val );
    return val;
}

/**
 * @param { string } key 
 * @returns { boolean? }
 */
export function storage_get_bool( key ) {
    const v = storage_get( key );
    return v === null ? null : Boolean( v );
}

/**
 * @param { string } key 
 * @param { boolean } val
 * @returns { boolean }
 */
export function storage_set_bool( key, val ) {
    storage_set( key, val.toString() );
    return val;
}