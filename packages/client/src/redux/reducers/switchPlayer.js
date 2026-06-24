/**
 * Created by lyy on 2017/12/19.
 */
export default (state = 'white', action) => {
  switch (action.type) {
    case 'SWITCH_PLAYER':
      return action.play === 'white' ? 'black' : 'white'
    default:
      return state
  }
}