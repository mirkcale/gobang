/**
 * Created by lyy on 2017/12/18.
 */
import undoable from 'redux-undo'
import initialStore from '../store'
const addChess =  (state = initialStore, action) => {
  console.log(action)
  switch (action.type) {
    case 'ADD_CHESS':
      return {
        player: action.payload.player === 'white' ? 'black' : 'white',
        container: {...state.container, ...{[action.payload.player]: [...state.container[action.payload.player].concat([action.payload.position])]}}
      }
    default:
      return state
  }
}

export default undoable(addChess)