/**
 * Created by lyy on 2017/12/20.
 */
import React from 'react'
import { ActionCreators as UndoActionCreators } from 'redux-undo'
import { connect } from 'react-redux'

const buttonStyle = {
  padding: '8px 20px',
  margin: '0 5px',
  border: '2px solid #5a4a2a',
  borderRadius: '4px',
  background: '#5a4a2a',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '14px'
}

const disabledButtonStyle = {
  ...buttonStyle,
  background: 'transparent',
  color: '#5a4a2a',
  cursor: 'not-allowed'
}

let UndoRedo = ({ canUndo, canRedo, onUndo, onRedo, onCustomUndo }) => (
  <p style={{display:'flex',justifyContent:'center'}}>
    <button onClick={onCustomUndo || onUndo} disabled={!canUndo} style={canUndo ? buttonStyle : disabledButtonStyle}>
      ↩️ 悔棋
    </button>
    <button onClick={onRedo} disabled={!canRedo} style={canRedo ? buttonStyle : disabledButtonStyle}>
      ↪️ 撤销
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