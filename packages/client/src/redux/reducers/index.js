import { combineReducers } from 'redux'
import addChess from './addChess'

const golang = combineReducers({
  golang: addChess
})

export default golang