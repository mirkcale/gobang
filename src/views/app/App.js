import React, { Component } from 'react'
import { connect } from 'react-redux'
import ChessBoard from '../../components/ChessBoard'

class App extends Component {
  render() {
    // Injected by connect() call:
    let {dispatch, state} = this.props
    return (
      <div>
        <ChessBoard dispatch={dispatch} state={state} />
      </div>
    )
  }
}


// Which props do we want to inject, given the global state?
// Note: use https://github.com/faassen/reselect for better performance.
function select(state) {
  return {
    state
  }
}

// 包装 component ，注入 dispatch 和 state 到其默认的 connect(select)(App) 中；
export default connect(select)(App)