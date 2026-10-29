/**
 * A model that is the work itself is written twice.
 *
 * Cleaning's "Fighter-jet" is a toy row only because the catalogue needs one
 * to hang a step on, and that step carries the same name. Printed side by side
 * it reads as a duplicate and the eye stops on it, so wherever the two sit
 * together the pair is said once.
 */
const bare = (text?: string) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const sameJob = (toy?: string, step?: string) => !!bare(toy) && bare(toy) === bare(step);
