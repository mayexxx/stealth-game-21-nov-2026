// A small seeded random number generator (splitmix32): the same seed gives the
// same game, which is what makes the screenshot scenes repeatable. The state
// advances by a fixed odd increment and the output is mixed with xorshifts and
// two integer multiplications, so successive values look unrelated.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x9e3779b9) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    value = value ^ (value >>> 15);
    return (value >>> 0) / 4294967296;
  };
}

/** Pick an integer in [min, max) from a seeded generator. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}
