/**
 * Created by lyy on 2017/12/19.
 */
import { SWITCH_PLAYER } from './actionTypes'

export default function switchPlayer (play) {
  return {
    type: SWITCH_PLAYER,
    play
  }
}