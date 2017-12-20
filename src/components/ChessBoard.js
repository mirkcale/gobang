/**
 * Created by lyy on 2017/12/19.
 */
import React, { Component } from 'react'
import UndoRedo from '../container/UndoRedo'
import addChessCreator from '../redux/actions/addChess'

export default class chessboard extends Component {
  constructor (props) {
    super(props);
    this.drawChessBoard = this.drawChessBoard.bind(this)
    this.oneStep = this.oneStep.bind(this)
  }

  componentDidMount () {
    this.drawChessBoard()
    // document.getElementById('chessboard').addEventListener('click', (e => this.oneStep(e)))
  }

  hasChess (position) {
    let hasChessFlag = false
    let {black, white} = this.props.golang.present.container
    const unique = (position, array) => {
      let length = array && array.length
      if(length === 0){
        return hasChessFlag
      }
      let [x, y] = position
      for (let i = 0; i < length; i++) {
        if(x === array[i][0] && y === array[i][1]){
          hasChessFlag = true
          break
        }
      }
      return hasChessFlag
    }
    return unique(position, black) || unique(position, white)
  }

  drawChessBoard () {
    var chess = document.getElementById("chessboard");
    var context = chess.getContext('2d');
    var width = chess.width
    var height = chess.height

    context.clearRect(0, 0, width, height)
    context.strokeStyle = '#bfbfbf'; // 边框颜色
    for (var i = 0; i < 15; i++) {
      context.moveTo(15 + i * 30, 15);
      context.lineTo(15 + i * 30, 435);
      context.stroke();
      context.moveTo(15, 15 + i * 30);
      context.lineTo(435, 15 + i * 30);
      context.stroke();
    }
  }

  oneStep (e) {
    var x = Math.floor(e.nativeEvent.offsetX / 30);
    var y = Math.floor(e.nativeEvent.offsetY / 30);
    let player = this.props.golang && this.props.golang.present ? this.props.golang.present.player : 'white'
    if(this.hasChess([x, y])){
      return
    }
    this.props.dispatch(addChessCreator([x, y], player))
  }

  drawChess (x, y, player) {
    var chess = document.getElementById("chessboard");
    var context = chess.getContext('2d');
    context.beginPath();
    context.arc(15 + x * 30, 15 + y * 30, 13, 0, 2 * Math.PI);//画圆
    context.closePath();
    //渐变
    var gradient = context.createRadialGradient(15 + x * 30 + 2, 15 + y * 30 - 2, 13, 15 + x * 30 + 2, 15 + y * 30 - 2, 0);
    if (player === 'black') {
      gradient.addColorStop(0, '#0a0a0a');
      gradient.addColorStop(1, '#636766');
    } else {
      gradient.addColorStop(0, '#d1d1d1');
      gradient.addColorStop(1, '#f9f9f9');
    }
    context.fillStyle = gradient;
    context.fill();
    context.beginPath();
  }

  componentWillReceiveProps(nextProps){
    let {black, white} = nextProps.golang.present.container
    this.drawChessBoard()
    black.map(i => this.drawChess(i[0], i[1], 'black'))
    white.map(i => this.drawChess(i[0], i[1], 'white'))
  }

  render () {
    return (
      <div>
        <canvas
          id="chessboard"
          width="450"
          height="450"
          style={{ display: 'block',
            margin: '50px auto',
            boxShadow: '-2px -2px 2px #efefef, 5px 5px 5px #b9b9b9'}}
          onClick={e => {this.oneStep(e)}}
        />
        <UndoRedo/>
      </div>
    )
  }
}