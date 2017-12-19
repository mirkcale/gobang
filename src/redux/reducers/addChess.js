/**
 * Created by lyy on 2017/12/18.
 */
import initialStore from '../store'
export default (state = initialStore, action) => {
  switch (action.type) {
    case 'ADD_CHESS':
      return {
        ...state,
        player: action.payload.player === 'white' ? 'black' : 'white'
      }
    default:
      return state
  }
}