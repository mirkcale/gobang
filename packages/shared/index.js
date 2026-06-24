/**
 * Shared game logic for gobang (五子棋)
 * Used by both client and server
 */

export const GRID_COUNT = 15

export const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]]

/**
 * Create a fresh game state
 */
export function createInitialGameState() {
  return {
    player: 'black',  // black goes first
    container: { white: [], black: [] },
    gameOver: false,
    winner: null
  }
}

/**
 * Check if placing a piece at (x, y) for the given player results in a win.
 * @param {number} x - column
 * @param {number} y - row
 * @param {'black'|'white'} player
 * @param {number[][]} pieces - array of [x, y] positions for that player
 * @returns {boolean}
 */
export function checkWin(x, y, player, pieces) {
  for (const [dx, dy] of DIRECTIONS) {
    let count = 1
    // Positive direction
    for (let i = 1; i < 5; i++) {
      if (pieces.some(p => p[0] === x + dx * i && p[1] === y + dy * i)) {
        count++
      } else break
    }
    // Negative direction
    for (let i = 1; i < 5; i++) {
      if (pieces.some(p => p[0] === x - dx * i && p[1] === y - dy * i)) {
        count++
      } else break
    }
    if (count >= 5) return true
  }
  return false
}

/**
 * Check if a position is occupied
 * @param {number} x
 * @param {number} y
 * @param {{ white: number[][], black: number[][] }} container
 * @returns {boolean}
 */
export function isPositionOccupied(x, y, container) {
  return container.black.some(p => p[0] === x && p[1] === y) ||
         container.white.some(p => p[0] === x && p[1] === y)
}

/**
 * Check if a position is within board bounds
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isInBounds(x, y) {
  return x >= 0 && x < GRID_COUNT && y >= 0 && y < GRID_COUNT
}
