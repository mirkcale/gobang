/**
 * Created by lyy on 2017/12/20.
 */
import React from 'react'
import { ActionCreators as UndoActionCreators } from 'redux-undo'
import { connect } from 'react-redux'

let UndoRedo = ({ canUndo, canRedo, onUndo, onRedo }) => (
  <p>
    <button onClick={onUndo} disabled={!canUndo}>
      悔棋
    </button>
    <button onClick={onRedo} disabled={!canRedo}>
      撤销
    </button>
  </p>
)

const mapStateToProps = (state) => ({
  canUndo: state.golang.past.length > 0,
  canRedo: state.golang.future.length > 0
})

const mapDispatchToProps = ({
  onUndo: UndoActionCreators.undo,
  onRedo: UndoActionCreators.redo
})

UndoRedo = connect(
  mapStateToProps,
  mapDispatchToProps
)(UndoRedo)

export default UndoRedo