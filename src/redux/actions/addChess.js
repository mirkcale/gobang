/**
 * Created by lyy on 2017/12/18.
 */
import { ADD_CHESS } from './actionTypes'

export default function addChess (position, player) {
  return {
    type: ADD_CHESS,
    payload: {
      position,
      player
    }
  }
}
